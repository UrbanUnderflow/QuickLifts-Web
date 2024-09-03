export enum BodyPart {
    Biceps = 'biceps',
    Triceps = 'triceps',
    Chest = 'chest',
    Calves = 'calves',
    Abs = 'abs',
    Hamstrings = 'hamstrings',
    Back = 'back',
    Glutes = 'glutes',
    Quadriceps = 'quadriceps',
    Forearms = 'forearms',
    Shoulders = 'shoulders',
    Lowerback = 'lowerback',
    // advanced
    Lats = 'lats',
    Traps = 'traps',
    Rhomboids = 'rhomboids',
    Deltoids = 'deltoids',
    Fullbody = 'fullbody'
  }
  
  // Function to check if a body part is advanced
  export function isAdvancedBodyPart(bodyPart: BodyPart): boolean {
    return [BodyPart.Traps, BodyPart.Lats, BodyPart.Rhomboids, BodyPart.Deltoids].includes(bodyPart);
  }