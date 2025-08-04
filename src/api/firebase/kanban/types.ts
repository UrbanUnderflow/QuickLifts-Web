export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface KanbanTaskData {
  id: string;
  name: string;
  description: string;
  project: string;
  theme: string;
  assignee: string;
  status: 'todo' | 'in-progress' | 'done';
  subtasks: Subtask[];
  createdAt: Date;
  updatedAt: Date;
}

export class KanbanTask {
  id: string;
  name: string;
  description: string;
  project: string;
  theme: string;
  assignee: string;
  status: 'todo' | 'in-progress' | 'done';
  subtasks: Subtask[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<KanbanTaskData> & { id: string }) {
    this.id = data.id;
    this.name = data.name || '';
    this.description = data.description || '';
    this.project = data.project || '';
    this.theme = data.theme || '';
    this.assignee = data.assignee || '';
    this.status = data.status || 'todo';
    this.subtasks = data.subtasks || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Helper method to get subtask progress
  getSubtaskProgress(): { completed: number; total: number; percentage: number } {
    const total = this.subtasks.length;
    const completed = this.subtasks.filter(subtask => subtask.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  toDictionary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      project: this.project,
      theme: this.theme,
      assignee: this.assignee,
      status: this.status,
      subtasks: this.subtasks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromFirestore(data: any, id: string): KanbanTask {
    return new KanbanTask({
      id,
      ...data,
      subtasks: data.subtasks || [],
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    });
  }
} 