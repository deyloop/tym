export interface Task {
  id: string;
  parent: string | null;
  title: string;
  completed: boolean;
  createdAt: number;
}
