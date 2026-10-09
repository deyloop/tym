//! SQLite storage for synced records.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, Row, params};

use crate::sync::{Record, merge};

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    data       TEXT,
    seq        INTEGER NOT NULL,
    PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS records_by_seq ON records (seq);
";

pub struct Store {
    conn: Mutex<Connection>,
}

impl Store {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> rusqlite::Result<Self> {
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Applies `changes`, then returns the new cursor and every record changed after `cursor`.
    ///
    /// Each stored change gets the next sequence number, so a client only has to
    /// remember the highest one it has seen.
    pub fn sync(&self, cursor: i64, changes: &[Record]) -> rusqlite::Result<(i64, Vec<Record>)> {
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;

        let mut seq: i64 = tx.query_row("SELECT COALESCE(MAX(seq), 0) FROM records", [], |r| {
            r.get(0)
        })?;
        for change in changes {
            let stored = tx
                .query_row(
                    "SELECT collection, id, updated_at, deleted, data FROM records WHERE collection = ?1 AND id = ?2",
                    params![change.collection, change.id],
                    read_record,
                )
                .optional()?;
            if let Some(next) = merge(stored.as_ref(), change) {
                seq += 1;
                tx.execute(
                    "INSERT INTO records (collection, id, updated_at, deleted, data, seq)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT (collection, id) DO UPDATE SET
                         updated_at = excluded.updated_at, deleted = excluded.deleted,
                         data = excluded.data, seq = excluded.seq",
                    params![
                        next.collection,
                        next.id,
                        next.updated_at,
                        next.deleted,
                        next.data.as_ref().map(|d| d.to_string()),
                        seq
                    ],
                )?;
            }
        }

        let changed = {
            let mut stmt = tx.prepare(
                "SELECT collection, id, updated_at, deleted, data FROM records WHERE seq > ?1 ORDER BY seq",
            )?;
            stmt.query_map([cursor], read_record)?
                .collect::<rusqlite::Result<Vec<_>>>()?
        };
        tx.commit()?;
        Ok((seq, changed))
    }
}

fn read_record(row: &Row) -> rusqlite::Result<Record> {
    let data: Option<String> = row.get(4)?;
    Ok(Record {
        collection: row.get(0)?,
        id: row.get(1)?,
        updated_at: row.get(2)?,
        deleted: row.get(3)?,
        data: data.and_then(|d| serde_json::from_str(&d).ok()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn person(id: &str, updated_at: i64, name: &str) -> Record {
        Record {
            collection: "people".into(),
            id: id.into(),
            updated_at,
            deleted: false,
            data: Some(json!({ "id": id, "name": name })),
        }
    }

    #[test]
    fn cursor_returns_only_newer_changes() {
        let store = Store::open_in_memory().unwrap();
        let (c1, _) = store.sync(0, &[person("a", 1, "Ann")]).unwrap();
        let (c2, changes) = store.sync(c1, &[person("b", 1, "Bo")]).unwrap();
        assert_eq!(c2, c1 + 1);
        assert_eq!(
            changes.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
            vec!["b"]
        );
    }

    #[test]
    fn stale_change_is_not_stored_or_resent() {
        let store = Store::open_in_memory().unwrap();
        let (c1, _) = store.sync(0, &[person("a", 5, "New")]).unwrap();
        let (c2, changes) = store.sync(c1, &[person("a", 3, "Old")]).unwrap();
        assert_eq!(c2, c1);
        assert!(changes.is_empty());
        let (_, all) = store.sync(0, &[]).unwrap();
        assert_eq!(all[0].data.as_ref().unwrap()["name"], "New");
    }
}
