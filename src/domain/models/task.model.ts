export interface Task {
  id: string;
  parent: string | null;
  title: string;
  completed: boolean;
  createdAt: number;
}

/** Ids of every task nested (at any depth) under the task with the given id. */
export function descendantIds(tasks: Task[], id: string): string[] {
  const result: string[] = [];
  const queue = [id];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of tasks) {
      if (t.parent === current && !seen.has(t.id)) {
        seen.add(t.id);
        result.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}
