export type KanbanLane = 'signals' | 'meanings';
export type KanbanColor = 'blue' | 'green' | 'yellow' | 'red';

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
  lane: KanbanLane;
  color: KanbanColor;
  objectiveCode: string;
  actOne: string;
  actTwo: string;
  actThree: string;
  lastWorkBeatAt?: Date;
  idleThresholdMinutes: number;
  notes?: string;
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
  lane: KanbanLane;
  color: KanbanColor;
  objectiveCode: string;
  actOne: string;
  actTwo: string;
  actThree: string;
  lastWorkBeatAt?: Date;
  idleThresholdMinutes: number;
  notes: string;
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
    this.lane = data.lane || 'signals';
    this.color = data.color || 'blue';
    this.objectiveCode = data.objectiveCode || '';
    this.actOne = data.actOne || '';
    this.actTwo = data.actTwo || '';
    this.actThree = data.actThree || '';
    this.lastWorkBeatAt = data.lastWorkBeatAt || data.updatedAt || new Date();
    this.idleThresholdMinutes = typeof data.idleThresholdMinutes === 'number' ? data.idleThresholdMinutes : 120;
    this.notes = data.notes || '';
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

  getMinutesSinceWorkBeat(referenceDate: Date = new Date()): number {
    const lastBeat = this.lastWorkBeatAt || this.updatedAt || this.createdAt;
    return Math.floor((referenceDate.getTime() - lastBeat.getTime()) / 60000);
  }

  getNeedsIdleAlert(referenceDate: Date = new Date()): boolean {
    if (!['yellow', 'red'].includes(this.color)) return false;
    return this.getMinutesSinceWorkBeat(referenceDate) >= this.idleThresholdMinutes;
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
      lane: this.lane,
      color: this.color,
      objectiveCode: this.objectiveCode,
      actOne: this.actOne,
      actTwo: this.actTwo,
      actThree: this.actThree,
      lastWorkBeatAt: this.lastWorkBeatAt || null,
      idleThresholdMinutes: this.idleThresholdMinutes,
      notes: this.notes,
      subtasks: this.subtasks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromFirestore(data: any, id: string): KanbanTask {
    return new KanbanTask({
      id,
      ...data,
      notes: data.notes || '',
      subtasks: data.subtasks || [],
      objectiveCode: data.objectiveCode || '',
      actOne: data.actOne || '',
      actTwo: data.actTwo || '',
      actThree: data.actThree || '',
      lastWorkBeatAt: data.lastWorkBeatAt?.toDate?.() || (data.lastWorkBeatAt ? new Date(data.lastWorkBeatAt) : undefined),
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    });
  }
}
