/**
 * localStorage-backed storage for every synced collection, with change
 * tracking for sync.
 *
 * Each write is diffed against what was stored before; records that changed
 * (or disappeared) get a new version timestamp and are marked dirty until the
 * server acknowledges them. Remote changes are written without tracking.
 */

export type CollectionName = 'tasks' | 'people' | 'taskTypes' | 'workflow';

interface CollectionSpec {
  key: string;
  /** A list of records with ids, or one document stored as a single record. */
  kind: 'list' | 'doc';
}

export const COLLECTIONS: Record<CollectionName, CollectionSpec> = {
  tasks: { key: 'tym_tasks_v1', kind: 'list' },
  people: { key: 'tym_people_v1', kind: 'list' },
  taskTypes: { key: 'tym_task_types_v1', kind: 'list' },
  workflow: { key: 'tym_workflow_v1', kind: 'doc' },
};

const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];
const DOC_ID = 'doc';
const META_KEY = 'tym_sync_meta_v1';

/** A record as exchanged with the server. */
export interface SyncRecord {
  collection: CollectionName;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
}

interface SyncMeta {
  /** Highest server sequence number already pulled. */
  cursor: number;
  /** Version (timestamp of the last change) of each record, by collection and id. */
  versions: Record<string, Record<string, number>>;
  /** Records changed locally and not yet acknowledged by the server. */
  dirty: Record<string, Record<string, true>>;
}

type Listener = (collection: CollectionName) => void;

export class LocalStore {
  private meta: SyncMeta;
  private listeners = new Set<Listener>();
  private lastVersion = 0;

  constructor() {
    this.meta = this.loadMeta();
  }

  read<T>(collection: CollectionName): T | null {
    const data = localStorage.getItem(COLLECTIONS[collection].key);
    return data ? JSON.parse(data) : null;
  }

  /** Saves a collection and records what changed for the next sync. */
  write(collection: CollectionName, value: unknown) {
    const before = this.toRecords(collection, this.read(collection));
    const after = this.toRecords(collection, value);
    localStorage.setItem(COLLECTIONS[collection].key, JSON.stringify(value));

    let changed = false;
    for (const [id, json] of after) {
      if (before.get(id) !== json) {
        this.markDirty(collection, id);
        changed = true;
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) {
        this.markDirty(collection, id);
        changed = true;
      }
    }
    if (changed) {
      this.saveMeta();
      for (const listener of this.listeners) listener(collection);
    }
  }

  /** Saves without marking anything for sync, e.g. built-in defaults another device may already have customised. */
  writeUntracked(collection: CollectionName, value: unknown) {
    localStorage.setItem(COLLECTIONS[collection].key, JSON.stringify(value));
  }

  /** Called after every tracked local change. */
  onLocalChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get cursor(): number {
    return this.meta.cursor;
  }

  pendingCount(): number {
    return Object.values(this.meta.dirty).reduce((n, ids) => n + Object.keys(ids).length, 0);
  }

  /** Every unacknowledged local change, ready to push. */
  pendingChanges(): SyncRecord[] {
    const changes: SyncRecord[] = [];
    for (const collection of COLLECTION_NAMES) {
      const dirty = Object.keys(this.meta.dirty[collection] ?? {});
      if (dirty.length === 0) continue;
      const current = this.toRecords(collection, this.read(collection));
      for (const id of dirty) {
        const json = current.get(id);
        changes.push({
          collection,
          id,
          updatedAt: this.meta.versions[collection]?.[id] ?? 0,
          deleted: json === undefined,
          data: json === undefined ? null : JSON.parse(json),
        });
      }
    }
    return changes;
  }

  /**
   * Applies a server response: clears pushed changes (unless they were edited
   * again in the meantime), stores remote changes, and advances the cursor.
   * Returns the collections whose local data changed.
   */
  applySyncResult(pushed: SyncRecord[], remote: SyncRecord[], cursor: number): Set<CollectionName> {
    for (const change of pushed) {
      if (this.meta.versions[change.collection]?.[change.id] === change.updatedAt) {
        delete this.meta.dirty[change.collection]?.[change.id];
      }
    }

    const changed = new Set<CollectionName>();
    for (const collection of COLLECTION_NAMES) {
      const records = remote.filter(
        (r) => r.collection === collection && !this.meta.dirty[collection]?.[r.id],
      );
      if (records.length === 0) continue;
      if (this.applyRemote(collection, records)) changed.add(collection);
      for (const r of records) (this.meta.versions[collection] ??= {})[r.id] = r.updatedAt;
    }

    this.meta.cursor = cursor;
    this.saveMeta();
    return changed;
  }

  /** Forgets the sync position so the next sync pulls everything again (local changes are kept). */
  resetCursor() {
    this.meta.cursor = 0;
    this.saveMeta();
  }

  private applyRemote(collection: CollectionName, records: SyncRecord[]): boolean {
    const before = localStorage.getItem(COLLECTIONS[collection].key);

    if (COLLECTIONS[collection].kind === 'doc') {
      const doc = records.findLast((r) => r.id === DOC_ID && !r.deleted);
      if (doc) this.writeUntracked(collection, doc.data);
    } else {
      // Local items keep their position; remote items carry the position they had on the sender.
      const items = this.read<Record<string, unknown>[]>(collection) ?? [];
      const entries = new Map(items.map((item, i) => [item.id as string, { item, order: i }]));
      for (const r of records) {
        if (r.deleted || !r.data) {
          entries.delete(r.id);
        } else {
          const { _order, ...item } = r.data;
          entries.set(r.id, { item, order: typeof _order === 'number' ? _order : Number.MAX_SAFE_INTEGER });
        }
      }
      const next = [...entries.values()].sort((a, b) => a.order - b.order).map((e) => e.item);
      this.writeUntracked(collection, next);
    }

    return localStorage.getItem(COLLECTIONS[collection].key) !== before;
  }

  /**
   * Serialised records by id; list items include their position so reordering syncs too.
   * Keys are sorted so that the same data always serialises the same way, whichever
   * order its keys were written in (the server, for one, sends them sorted).
   */
  private toRecords(collection: CollectionName, value: unknown): Map<string, string> {
    if (value === null || value === undefined) return new Map();
    if (COLLECTIONS[collection].kind === 'doc') return new Map([[DOC_ID, canonicalJson(value)]]);
    return new Map(
      (value as { id: string }[]).map((item, i) => [item.id, canonicalJson({ ...item, _order: i })]),
    );
  }

  private markDirty(collection: CollectionName, id: string) {
    // Strictly increasing, so two edits in the same millisecond are still ordered.
    this.lastVersion = Math.max(Date.now(), this.lastVersion + 1);
    (this.meta.versions[collection] ??= {})[id] = this.lastVersion;
    (this.meta.dirty[collection] ??= {})[id] = true;
  }

  private loadMeta(): SyncMeta {
    const stored = localStorage.getItem(META_KEY);
    if (stored) return JSON.parse(stored);

    // First run with sync: everything already stored locally still needs pushing.
    const meta: SyncMeta = { cursor: 0, versions: {}, dirty: {} };
    this.meta = meta;
    for (const collection of COLLECTION_NAMES) {
      for (const id of this.toRecords(collection, this.read(collection)).keys()) {
        this.markDirty(collection, id);
      }
    }
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return meta;
  }

  private saveMeta() {
    localStorage.setItem(META_KEY, JSON.stringify(this.meta));
  }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
