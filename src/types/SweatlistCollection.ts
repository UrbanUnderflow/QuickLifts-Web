import { SweatlistIdentifiers } from './SweatlistIdentifiers';

export interface SweatlistCollection {
    id: string;
    title: string;
    subtitle: string;
    sweatlistIds: SweatlistIdentifiers[];
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }

  