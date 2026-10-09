import type { CrudRepository } from '../../domain/repositories/crud.repository';
import type { LocalStorageDataSource } from '../datasources/local_storage.datasource';

export class LocalCrudRepository<T extends { id: string }> implements CrudRepository<T> {
  /** `defaults` seeds the list the first time it is read (never after the user empties it). */
  constructor(
    private dataSource: LocalStorageDataSource<T[]>,
    private defaults: T[] = [],
  ) {}

  async getAll(): Promise<T[]> {
    const items = await this.dataSource.load();
    if (items) return items;
    await this.dataSource.seed(this.defaults);
    return [...this.defaults];
  }

  async create(item: Omit<T, 'id'>): Promise<T> {
    const items = await this.getAll();
    const created = { ...item, id: crypto.randomUUID() } as T;
    items.push(created);
    await this.dataSource.save(items);
    return created;
  }

  async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<T> {
    const items = await this.getAll();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Item not found');
    items[index] = { ...items[index], ...changes };
    await this.dataSource.save(items);
    return items[index];
  }

  async delete(id: string): Promise<void> {
    const items = await this.getAll();
    await this.dataSource.save(items.filter((i) => i.id !== id));
  }
}
