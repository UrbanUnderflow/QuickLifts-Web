export type SignUpStep = 'initial' | 'password' | 'profile' | 'quiz-prompt' | 'quiz';

export interface QuizData {
    gender: 'Man' | 'Woman' | 'Self Describe' | null;
    height: {
        feet: number;
        inches: number;
    };
    weight: number;
    gymExperience: 'Novice' | 'Intermediate' | 'Expert' | null;
    fitnessGoals: FitnessGoal[]; // Now properly typed as an array of FitnessGoal
    birthdate: Date | null;

}

export type FitnessGoal = 'Lose weight' | 'Gain muscle mass' | 'Tone up' | 'General Fitness';
