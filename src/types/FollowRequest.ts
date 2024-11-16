// Add to existing interfaces
export interface FollowRequest {
    fromUser: {
      id: string;
      username: string;
      displayName: string;
    };
    toUser: {
      id: string;
      username: string;
      displayName: string;
    };
    status: string;
    createdAt: Date;
    updatedAt: Date
  }