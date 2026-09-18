export interface Task {
  id: string;
  parent: string;
  title: string;
  completed: boolean;
  createdAt: number;
}
