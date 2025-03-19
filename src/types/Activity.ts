export enum ActivityType {
    ExerciseSaved = "You saved some exercise",
    Sweatlist = "You created a sweatlist",
    WeightTraining = "You completed a lift workout",
    Speed = "You completed a speed workout",
    Yoga = "You completed a yoga workout",
    Mobility = "You completed a mobility workout",
    Cardio = "You completed a cardio workout",
    Following = "You followed some members",
    Follower = "Some members followed you",
    Checkin = "You completed a weigh-in",
    Liked = "You liked some exercises",
    ExercisePosted = "You posted a new exercise"
  }
  
export interface UserActivity {
    id: string;
    type: ActivityType;
    title: string;
    correspondingId: string;
    value: string;
    date: Date;
}
  
export interface ActivityGroup {
    id: string;
    activities: UserActivity[];
}
  