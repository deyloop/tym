/** Reads and writes one JSON value under a localStorage key. */
export class LocalStorageDataSource<T> {
  constructor(private key: string) {}

  /** The stored value, or null if nothing has been saved under this key yet. */
  async load(): Promise<T | null> {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : null;
  }

  async save(value: T): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(value));
  }
}
