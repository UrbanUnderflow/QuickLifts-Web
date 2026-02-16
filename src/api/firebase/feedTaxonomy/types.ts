import { ConfidenceColor } from '../progressTimeline/service';
import { KanbanLane } from '../kanban/types';

export interface FeedTaxonomyEntry {
  id?: string;
  taskType: string;
  description: string;
  lane: KanbanLane;
  typicalDurationMinutes: number;
  artifactRequirement: string;
  idleThresholdMinutes: number;
  defaultColor: ConfidenceColor;
  cadence: 'flash' | 'slow';
  ownerAgentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
