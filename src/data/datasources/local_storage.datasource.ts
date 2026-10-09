import type { CollectionName, LocalStore } from '../sync/local_store';

/** Reads and writes one synced collection in local storage. */
export class LocalStorageDataSource<T> {
  constructor(
    private store: LocalStore,
    private collection: CollectionName,
  ) {}

  /** The stored value, or null if nothing has been saved yet. */
  async load(): Promise<T | null> {
    return this.store.read<T>(this.collection);
  }

  async save(value: T): Promise<void> {
    this.store.write(this.collection, value);
  }

  /** Stores built-in defaults without syncing them, so they never overwrite another device's edits. */
  async seed(value: T): Promise<void> {
    this.store.writeUntracked(this.collection, value);
  }
}
