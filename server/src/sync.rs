//! Sync protocol types and conflict resolution.
//!
//! Every synced record is identified by `(collection, id)` and carries the
//! client timestamp of its last change (`updated_at`). The newest write wins,
//! with one exception: a task's `history` is an append-only audit trail, so
//! events from both sides of a conflict are kept.

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const COLLECTIONS: [&str; 4] = ["tasks", "people", "taskTypes", "workflow"];
const MAX_ID_LEN: usize = 200;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub collection: String,
    pub id: String,
    /// Milliseconds since the Unix epoch, set by the client that made the change.
    pub updated_at: i64,
    #[serde(default)]
    pub deleted: bool,
    /// The record itself; `None` for deletions (tombstones).
    pub data: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    /// The highest sequence number the client has already seen.
    #[serde(default)]
    pub cursor: i64,
    /// Local changes the client hasn't pushed yet.
    #[serde(default)]
    pub changes: Vec<Record>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    /// Pass this back as `cursor` on the next sync.
    pub cursor: i64,
    /// Every record changed since the request's cursor, including the
    /// client's own changes as the server resolved them.
    pub changes: Vec<Record>,
}

impl Record {
    pub fn validate(&self) -> Result<(), String> {
        if !COLLECTIONS.contains(&self.collection.as_str()) {
            return Err(format!("unknown collection {:?}", self.collection));
        }
        if self.id.is_empty() || self.id.len() > MAX_ID_LEN {
            return Err(format!("invalid id in {}", self.collection));
        }
        if !self.deleted && !matches!(self.data, Some(Value::Object(_))) {
            return Err(format!(
                "{}/{} must have object data unless deleted",
                self.collection, self.id
            ));
        }
        Ok(())
    }
}

/// Decides what to store when `incoming` arrives and `stored` is the current
/// server copy. Returns `None` when the stored record should stay as it is.
pub fn merge(stored: Option<&Record>, incoming: &Record) -> Option<Record> {
    let Some(stored) = stored else {
        return Some(tombstoned(incoming.clone()));
    };

    // Ties go to the stored copy so replaying the same change is a no-op.
    let incoming_wins = incoming.updated_at > stored.updated_at;
    let (mut winner, loser) = if incoming_wins {
        (tombstoned(incoming.clone()), stored)
    } else {
        (stored.clone(), incoming)
    };

    if winner.collection == "tasks"
        && let (Some(target), Some(other)) = (winner.data.as_mut(), loser.data.as_ref())
    {
        merge_history(target, other);
    }

    (winner != *stored).then_some(winner)
}

fn tombstoned(mut record: Record) -> Record {
    if record.deleted {
        record.data = None;
    }
    record
}

/// Adds any events from `other.history` missing in `target.history`, keeping them in time order.
fn merge_history(target: &mut Value, other: &Value) {
    let Some(theirs) = other.get("history").and_then(Value::as_array) else {
        return;
    };
    let Some(Value::Array(ours)) = target.get_mut("history") else {
        return;
    };
    let missing: Vec<Value> = theirs
        .iter()
        .filter(|e| !ours.contains(e))
        .cloned()
        .collect();
    if missing.is_empty() {
        return;
    }
    ours.extend(missing);
    ours.sort_by(|a, b| {
        let at = |v: &Value| v.get("at").and_then(Value::as_f64).unwrap_or(0.0);
        at(a).total_cmp(&at(b))
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn task(updated_at: i64, title: &str, history: Value) -> Record {
        Record {
            collection: "tasks".into(),
            id: "t1".into(),
            updated_at,
            deleted: false,
            data: Some(json!({ "id": "t1", "title": title, "history": history })),
        }
    }

    #[test]
    fn new_record_is_stored() {
        let incoming = task(1, "a", json!([]));
        assert_eq!(merge(None, &incoming), Some(incoming));
    }

    #[test]
    fn newer_write_wins() {
        let stored = task(1, "old", json!([]));
        let incoming = task(2, "new", json!([]));
        assert_eq!(
            merge(Some(&stored), &incoming).unwrap().data.unwrap()["title"],
            "new"
        );
    }

    #[test]
    fn older_or_equal_write_is_ignored() {
        let stored = task(2, "kept", json!([]));
        assert_eq!(merge(Some(&stored), &task(1, "stale", json!([]))), None);
        assert_eq!(merge(Some(&stored), &task(2, "replay", json!([]))), None);
    }

    #[test]
    fn task_history_is_kept_from_both_sides() {
        let stored = task(
            2,
            "server",
            json!([{ "at": 1, "kind": "created" }, { "at": 5, "kind": "note", "text": "a" }]),
        );
        let incoming = task(
            1,
            "stale",
            json!([{ "at": 1, "kind": "created" }, { "at": 3, "kind": "note", "text": "b" }]),
        );
        let merged = merge(Some(&stored), &incoming).expect("history changed");
        assert_eq!(merged.updated_at, 2);
        assert_eq!(merged.data.as_ref().unwrap()["title"], "server");
        let ats: Vec<i64> = merged.data.unwrap()["history"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["at"].as_i64().unwrap())
            .collect();
        assert_eq!(ats, vec![1, 3, 5]);
    }

    #[test]
    fn newer_delete_leaves_a_tombstone() {
        let stored = task(1, "a", json!([]));
        let delete = Record {
            deleted: true,
            data: Some(json!({})),
            ..task(2, "", json!([]))
        };
        let merged = merge(Some(&stored), &delete).unwrap();
        assert!(merged.deleted);
        assert_eq!(merged.data, None);
    }

    #[test]
    fn validation_rejects_unknown_collections_and_missing_data() {
        let mut r = task(1, "a", json!([]));
        r.collection = "secrets".into();
        assert!(r.validate().is_err());
        let mut r = task(1, "a", json!([]));
        r.data = None;
        assert!(r.validate().is_err());
        r.deleted = true;
        assert!(r.validate().is_ok());
    }
}
