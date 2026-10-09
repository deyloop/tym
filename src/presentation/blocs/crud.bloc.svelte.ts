import type { CrudRepository } from '../../domain/repositories/crud.repository';

/** State for a simple editable list of named records (people, task types, ...). */
export class CrudBloc<T extends { id: string; name: string }> {
  items = $state<T[]>([]);
  error = $state<string | null>(null);
  byId = $derived(new Map(this.items.map((i) => [i.id, i])));

  constructor(private repository: CrudRepository<T>) {
    this.load();
  }

  async load() {
    try {
      this.items = await this.repository.getAll();
    } catch (err: any) {
      this.error = err.message;
    }
  }

  nameOf(id: string | null | undefined): string | null {
    return id ? (this.byId.get(id)?.name ?? null) : null;
  }

  async create(item: Omit<T, 'id'>) {
    if (!item.name.trim()) return;
    try {
      const created = await this.repository.create({ ...item, name: item.name.trim() });
      this.items.push(created);
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async update(id: string, changes: Partial<Omit<T, 'id'>>) {
    if (changes.name !== undefined && !changes.name.trim()) return;
    try {
      const updated = await this.repository.update(id, changes);
      this.items = this.items.map((i) => (i.id === id ? updated : i));
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async delete(id: string) {
    try {
      await this.repository.delete(id);
      this.items = this.items.filter((i) => i.id !== id);
    } catch (err: any) {
      this.error = err.message;
    }
  }
}
