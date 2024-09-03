
export interface ExerciseAuthor {
    userId: string;
    username: string;
  }
  
  // If you need a function to convert ExerciseAuthor to a plain object (similar to toDictionary in Swift)
  export function exerciseAuthorToDictionary(author: ExerciseAuthor): { [key: string]: any } {
    return {
      userId: author.userId,
      username: author.username
    };
  }