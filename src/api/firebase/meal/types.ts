import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';

export enum MealEntryMethod {
  Photo = "photo",
  Text = "text",
  Voice = "voice",
  Unknown = "unknown"
}

export enum FoodIcons {
  Unknown = "unknown",
  Protein = "protein",
  Carbs = "carbs",
  Vegetables = "vegetables",
  Fruits = "fruits",
  Dairy = "dairy",
  Fats = "fats",
  Grains = "grains",
  Snacks = "snacks",
  Beverages = "beverages"
}

export interface MealData {
  id: string;
  name: string;
  categories: string[];
  ingredients: string[];
  caption: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  image: string;
  entryMethod: string;
  servingSize?: string;
  servingsPerContainer?: number;
  sugars?: number;
  dietaryFiber?: number;
  sodium?: number;
  cholesterol?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
  createdAt: any;
  updatedAt: any;
  userId?: string; // Added for root collection sync
}

export class Meal {
  id: string;
  name: string;
  categories: FoodIcons[];
  ingredients: string[];
  caption: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  image: string;
  entryMethod: MealEntryMethod;
  servingSize?: string;
  servingsPerContainer?: number;
  sugars?: number;
  dietaryFiber?: number;
  sodium?: number;
  cholesterol?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // Added for root collection sync

  constructor(data: MealData) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.caption = data.caption || '';
    
    // Convert categories from strings to FoodIcons enum
    this.categories = (data.categories || []).map(category => {
      const foodIcon = Object.values(FoodIcons).find(icon => icon === category);
      return foodIcon || FoodIcons.Unknown;
    });
    
    this.ingredients = data.ingredients || [];
    this.protein = data.protein || 0;
    this.fat = data.fat || 0;
    this.carbs = data.carbs || 0;
    
    // Use provided calories or calculate from macros
    if (data.calories && data.calories > 0) {
      this.calories = data.calories;
    } else {
      this.calories = this.calculateCalories(this.carbs, this.fat, this.protein);
    }
    
    // Handle entry method with fallback to unknown
    const entryMethodValue = Object.values(MealEntryMethod).find(method => method === data.entryMethod);
    this.entryMethod = entryMethodValue || MealEntryMethod.Unknown;
    
    this.servingSize = data.servingSize;
    this.servingsPerContainer = data.servingsPerContainer;
    this.sugars = data.sugars;
    this.dietaryFiber = data.dietaryFiber;
    this.sodium = data.sodium;
    this.cholesterol = data.cholesterol;
    this.saturatedFat = data.saturatedFat;
    this.unsaturatedFat = data.unsaturatedFat;
    this.vitamins = data.vitamins;
    this.minerals = data.minerals;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    this.image = data.image || '';
    this.userId = data.userId;
  }

  private calculateCalories(carbs: number, fat: number, protein: number): number {
    const caloriesFromCarbs = carbs * 4;
    const caloriesFromFat = fat * 9;
    const caloriesFromProtein = protein * 4;
    return caloriesFromCarbs + caloriesFromFat + caloriesFromProtein;
  }

  toDictionary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      categories: this.categories.map(category => category),
      ingredients: this.ingredients,
      caption: this.caption,
      calories: this.calories,
      protein: this.protein,
      fat: this.fat,
      carbs: this.carbs,
      image: this.image,
      entryMethod: this.entryMethod,
      servingSize: this.servingSize || '',
      servingsPerContainer: this.servingsPerContainer || 0,
      sugars: this.sugars || 0,
      dietaryFiber: this.dietaryFiber || 0,
      sodium: this.sodium || 0,
      cholesterol: this.cholesterol || 0,
      saturatedFat: this.saturatedFat || 0,
      unsaturatedFat: this.unsaturatedFat || 0,
      vitamins: this.vitamins || {},
      minerals: this.minerals || {},
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      ...(this.userId && { userId: this.userId })
    };
  }

  // Static fixture data for testing (similar to Swift fixtures)
  static chickenAlfredoFixture = new Meal({
    id: '',
    name: 'Chicken Alfredo',
    categories: [FoodIcons.Unknown.toString()],
    ingredients: [],
    caption: '',
    calories: 400,
    protein: 30,
    fat: 10,
    carbs: 45,
    image: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/food%2FChicken-Alfredo-bowl.jpg?alt=media&token=4157cf98-a800-4de5-8bb8-52522cda8763',
    entryMethod: MealEntryMethod.Photo.toString(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  static beefBroccoliFixture = new Meal({
    id: '',
    name: 'Broccoli Beef',
    categories: [FoodIcons.Unknown.toString()],
    ingredients: [],
    caption: '',
    calories: 200,
    protein: 40,
    fat: 10,
    carbs: 35,
    image: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/food%2Fground-turkey-stir-fry-recipe_2c018df3966aff7e9d5669c2ea0b2162.jpeg?alt=media&token=861b02f9-4d67-44e9-aa2d-c9ba8124faac',
    entryMethod: MealEntryMethod.Photo.toString(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  static broccoliTurkey = new Meal({
    id: '',
    name: 'Broccoli Turkey',
    categories: [FoodIcons.Unknown.toString()],
    ingredients: [],
    caption: '',
    calories: 300,
    protein: 25,
    fat: 14,
    carbs: 29,
    image: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/food%2FOrange-Ground-Turkey-8b.jpg?alt=media&token=9fa45976-3cff-42a2-98ac-16ee9218200f',
    entryMethod: MealEntryMethod.Photo.toString(),
    createdAt: new Date(),
    updatedAt: new Date()
  });
} 