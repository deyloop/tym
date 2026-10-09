/** Persistence for a simple list of named records (people, task types, ...). */
export interface CrudRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<T>;
  delete(id: string): Promise<void>;
}
