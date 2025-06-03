const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Firebase config - you'll need to add your actual config
const firebaseConfig = {
  // Add your Firebase config here
  // This would typically come from environment variables in production
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Comprehensive mock user data cards
const mockUserDataCards = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    profileImage: 'https://example.com/profiles/sarah.jpg',
    age: 28,
    gender: 'female',
    fitnessLevel: 'intermediate',
    experienceYears: 3,
    primaryGoals: ['strength', 'hypertrophy'],
    preferredWorkoutTypes: ['weight-training', 'functional'],
    preferredIntensity: 'moderate',
    injuries: [],
    limitations: [],
    healthConditions: [],
    availableEquipment: ['full-gym'],
    preferredDuration: 60,
    trainingFrequency: 4,
    availableDays: ['monday', 'tuesday', 'thursday', 'friday'],
    timeOfDay: ['evening'],
    favoriteExercises: ['Deadlift', 'Bench Press', 'Pull-ups'],
    dislikedExercises: ['Burpees'],
    pastChallengesCompleted: 3,
    averageWorkoutCompletionRate: 85,
    height: 165,
    weight: 60,
    motivationStyle: ['competitive', 'collaborative'],
    preferredFeedback: ['encouraging', 'detailed'],
    recentWorkoutTypes: ['strength', 'hypertrophy'],
    currentChallengeParticipation: []
  },
  {
    name: 'Mike Chen',
    email: 'mike.chen@example.com',
    profileImage: 'https://example.com/profiles/mike.jpg',
    age: 32,
    gender: 'male',
    fitnessLevel: 'advanced',
    experienceYears: 8,
    primaryGoals: ['athletic-performance', 'strength'],
    preferredWorkoutTypes: ['weight-training', 'sports-specific'],
    preferredIntensity: 'high',
    injuries: ['Previous shoulder injury (2019)'],
    limitations: ['Avoid overhead pressing with heavy weight'],
    healthConditions: [],
    availableEquipment: ['full-gym'],
    preferredDuration: 75,
    trainingFrequency: 5,
    availableDays: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
    timeOfDay: ['morning'],
    favoriteExercises: ['Squats', 'Rows', 'Olympic Lifts'],
    dislikedExercises: ['Overhead Press', 'High-rep Cardio'],
    pastChallengesCompleted: 8,
    averageWorkoutCompletionRate: 95,
    height: 178,
    weight: 82,
    motivationStyle: ['competitive', 'independent'],
    preferredFeedback: ['technical', 'minimal'],
    recentWorkoutTypes: ['strength', 'athletic-performance'],
    currentChallengeParticipation: ['challenge-123']
  },
  {
    name: 'Emma Rodriguez',
    email: 'emma.rodriguez@example.com',
    profileImage: 'https://example.com/profiles/emma.jpg',
    age: 24,
    gender: 'female',
    fitnessLevel: 'beginner',
    experienceYears: 1,
    primaryGoals: ['general-fitness', 'weight-loss'],
    preferredWorkoutTypes: ['cardio', 'weight-training'],
    preferredIntensity: 'low',
    injuries: [],
    limitations: [],
    healthConditions: [],
    availableEquipment: ['home-gym'],
    preferredDuration: 30,
    trainingFrequency: 3,
    availableDays: ['tuesday', 'thursday', 'saturday'],
    timeOfDay: ['morning', 'afternoon'],
    favoriteExercises: ['Walking', 'Bodyweight Squats', 'Yoga'],
    dislikedExercises: ['Heavy Lifting', 'High-Intensity Cardio'],
    pastChallengesCompleted: 1,
    averageWorkoutCompletionRate: 70,
    height: 160,
    weight: 65,
    motivationStyle: ['collaborative', 'coach-guided'],
    preferredFeedback: ['encouraging', 'detailed'],
    recentWorkoutTypes: ['cardio', 'general-fitness'],
    currentChallengeParticipation: []
  },
  {
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    profileImage: 'https://example.com/profiles/james.jpg',
    age: 35,
    gender: 'male',
    fitnessLevel: 'expert',
    experienceYears: 12,
    primaryGoals: ['strength', 'athletic-performance'],
    preferredWorkoutTypes: ['weight-training', 'functional'],
    preferredIntensity: 'high',
    injuries: ['Previous knee surgery (2018)'],
    limitations: ['Avoid deep squats', 'Limited jumping movements'],
    healthConditions: [],
    availableEquipment: ['full-gym'],
    preferredDuration: 90,
    trainingFrequency: 6,
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    timeOfDay: ['early-morning'],
    favoriteExercises: ['Deadlift', 'Box Squats', 'Farmer Walks'],
    dislikedExercises: ['Jump Squats', 'Running'],
    pastChallengesCompleted: 15,
    averageWorkoutCompletionRate: 98,
    height: 185,
    weight: 95,
    motivationStyle: ['independent', 'competitive'],
    preferredFeedback: ['technical'],
    recentWorkoutTypes: ['strength', 'powerlifting'],
    currentChallengeParticipation: ['challenge-456', 'challenge-789']
  },
  {
    name: 'Lisa Park',
    email: 'lisa.park@example.com',
    profileImage: 'https://example.com/profiles/lisa.jpg',
    age: 29,
    gender: 'female',
    fitnessLevel: 'intermediate',
    experienceYears: 4,
    primaryGoals: ['endurance', 'general-fitness'],
    preferredWorkoutTypes: ['cardio', 'yoga'],
    preferredIntensity: 'moderate',
    injuries: [],
    limitations: [],
    healthConditions: ['Mild asthma'],
    availableEquipment: ['minimal-equipment'],
    preferredDuration: 45,
    trainingFrequency: 4,
    availableDays: ['monday', 'wednesday', 'friday', 'sunday'],
    timeOfDay: ['morning', 'flexible'],
    favoriteExercises: ['Running', 'Yoga Flow', 'Cycling'],
    dislikedExercises: ['Heavy Weightlifting', 'High-Intensity Sprints'],
    pastChallengesCompleted: 5,
    averageWorkoutCompletionRate: 80,
    height: 162,
    weight: 58,
    motivationStyle: ['collaborative', 'coach-guided'],
    preferredFeedback: ['encouraging'],
    recentWorkoutTypes: ['endurance', 'yoga'],
    currentChallengeParticipation: ['challenge-321']
  },
  {
    name: 'David Thompson',
    email: 'david.thompson@example.com',
    profileImage: 'https://example.com/profiles/david.jpg',
    age: 42,
    gender: 'male',
    fitnessLevel: 'beginner',
    experienceYears: 0.5,
    primaryGoals: ['weight-loss', 'general-fitness'],
    preferredWorkoutTypes: ['cardio', 'weight-training'],
    preferredIntensity: 'low',
    injuries: [],
    limitations: ['Lower back sensitivity'],
    healthConditions: ['Type 2 Diabetes'],
    availableEquipment: ['bodyweight-only'],
    preferredDuration: 25,
    trainingFrequency: 3,
    availableDays: ['tuesday', 'thursday', 'sunday'],
    timeOfDay: ['evening'],
    favoriteExercises: ['Walking', 'Modified Push-ups'],
    dislikedExercises: ['Running', 'Jump Exercises'],
    pastChallengesCompleted: 0,
    averageWorkoutCompletionRate: 60,
    height: 175,
    weight: 95,
    motivationStyle: ['coach-guided'],
    preferredFeedback: ['encouraging', 'detailed'],
    recentWorkoutTypes: ['walking', 'bodyweight'],
    currentChallengeParticipation: []
  }
];

async function populateUserDataCards() {
  try {
    console.log('Starting to populate user data cards...');
    
    for (const userData of mockUserDataCards) {
      const docRef = await addDoc(collection(db, 'user-datacards'), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Created user data card for ${userData.name} with ID: ${docRef.id}`);
    }
    
    console.log(`Successfully created ${mockUserDataCards.length} user data cards!`);
    console.log('\n🎉 Firestore collection "user-datacards" is now populated with mock data.');
    console.log('\n📋 Users created:');
    mockUserDataCards.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.fitnessLevel}, ${user.primaryGoals.join(' & ')})`);
    });
    
  } catch (error) {
    console.error('Error populating user data cards:', error);
  }
}

// Run the population script
populateUserDataCards().then(() => {
  console.log('\n✅ Script completed. You can now use the real user data cards in your app!');
  process.exit(0);
}); 