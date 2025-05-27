import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../config';
import { Meal, MealData } from './types';
import { userService } from '../user/service';

class MealService {
  private static instance: MealService;

  static getInstance(): MealService {
    if (!MealService.instance) {
      MealService.instance = new MealService();
    }
    return MealService.instance;
  }

  /**
   * Create a new meal log for a user
   */
  async createMealLog(userId: string, mealData: Partial<MealData>): Promise<Meal> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const mealRef = doc(collection(db, 'users', userId, 'mealLogs'));
      const now = new Date();
      
      const meal = new Meal({
        id: mealRef.id,
        name: mealData.name || '',
        categories: mealData.categories || [],
        ingredients: mealData.ingredients || [],
        caption: mealData.caption || '',
        calories: mealData.calories || 0,
        protein: mealData.protein || 0,
        fat: mealData.fat || 0,
        carbs: mealData.carbs || 0,
        image: mealData.image || '',
        entryMethod: mealData.entryMethod || 'unknown',
        servingSize: mealData.servingSize,
        servingsPerContainer: mealData.servingsPerContainer,
        sugars: mealData.sugars,
        dietaryFiber: mealData.dietaryFiber,
        sodium: mealData.sodium,
        cholesterol: mealData.cholesterol,
        saturatedFat: mealData.saturatedFat,
        unsaturatedFat: mealData.unsaturatedFat,
        vitamins: mealData.vitamins,
        minerals: mealData.minerals,
        createdAt: now,
        updatedAt: now
      });

      await setDoc(mealRef, meal.toDictionary());
      console.log('Meal log created successfully:', meal.id);
      
      return meal;
    } catch (error) {
      console.error('Error creating meal log:', error);
      throw error;
    }
  }

  /**
   * Get a specific meal log by ID
   */
  async getMealLog(userId: string, mealId: string): Promise<Meal | null> {
    if (!userId || !mealId) {
      throw new Error('User ID and Meal ID are required');
    }

    try {
      const mealRef = doc(db, 'users', userId, 'mealLogs', mealId);
      const mealDoc = await getDoc(mealRef);

      if (!mealDoc.exists()) {
        console.log('Meal log not found');
        return null;
      }

      const mealData = mealDoc.data() as MealData;
      return new Meal({ ...mealData, id: mealDoc.id });
    } catch (error) {
      console.error('Error fetching meal log:', error);
      throw error;
    }
  }

  /**
   * Get all meal logs for a user
   */
  async getUserMealLogs(userId: string, limitCount?: number): Promise<Meal[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const mealsRef = collection(db, 'users', userId, 'mealLogs');
      let q = query(mealsRef, orderBy('createdAt', 'desc'));
      
      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const querySnapshot = await getDocs(q);
      const meals: Meal[] = [];

      querySnapshot.forEach((doc) => {
        const mealData = doc.data() as MealData;
        meals.push(new Meal({ ...mealData, id: doc.id }));
      });

      return meals;
    } catch (error) {
      console.error('Error fetching user meal logs:', error);
      throw error;
    }
  }

  /**
   * Update an existing meal log
   */
  async updateMealLog(userId: string, mealId: string, updates: Partial<MealData>): Promise<void> {
    if (!userId || !mealId) {
      throw new Error('User ID and Meal ID are required');
    }

    try {
      const mealRef = doc(db, 'users', userId, 'mealLogs', mealId);
      
      // Add updatedAt timestamp
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await updateDoc(mealRef, updateData);
      console.log('Meal log updated successfully:', mealId);
    } catch (error) {
      console.error('Error updating meal log:', error);
      throw error;
    }
  }

  /**
   * Delete a meal log
   */
  async deleteMealLog(userId: string, mealId: string): Promise<void> {
    if (!userId || !mealId) {
      throw new Error('User ID and Meal ID are required');
    }

    try {
      const mealRef = doc(db, 'users', userId, 'mealLogs', mealId);
      await deleteDoc(mealRef);
      console.log('Meal log deleted successfully:', mealId);
    } catch (error) {
      console.error('Error deleting meal log:', error);
      throw error;
    }
  }

  /**
   * Get meal logs for a specific date range
   */
  async getMealLogsByDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<Meal[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const mealsRef = collection(db, 'users', userId, 'mealLogs');
      const q = query(
        mealsRef,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const meals: Meal[] = [];

      querySnapshot.forEach((doc) => {
        const mealData = doc.data() as MealData;
        meals.push(new Meal({ ...mealData, id: doc.id }));
      });

      return meals;
    } catch (error) {
      console.error('Error fetching meal logs by date range:', error);
      throw error;
    }
  }

  /**
   * Get daily nutrition totals for a user
   */
  async getDailyNutritionTotals(userId: string, date: Date): Promise<{
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    mealCount: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const meals = await this.getMealLogsByDateRange(userId, startOfDay, endOfDay);

    const totals = meals.reduce((acc, meal) => {
      acc.totalCalories += meal.calories;
      acc.totalProtein += meal.protein;
      acc.totalCarbs += meal.carbs;
      acc.totalFat += meal.fat;
      acc.mealCount += 1;
      return acc;
    }, {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      mealCount: 0
    });

    return totals;
  }

  /**
   * Batch create multiple meal logs (useful for importing data)
   */
  async batchCreateMealLogs(userId: string, meals: Partial<MealData>[]): Promise<string[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (meals.length === 0) {
      return [];
    }

    try {
      const batch = writeBatch(db);
      const mealIds: string[] = [];
      const now = new Date();

      meals.forEach((mealData) => {
        const mealRef = doc(collection(db, 'users', userId, 'mealLogs'));
        const meal = new Meal({
          id: mealRef.id,
          name: mealData.name || '',
          categories: mealData.categories || [],
          ingredients: mealData.ingredients || [],
          caption: mealData.caption || '',
          calories: mealData.calories || 0,
          protein: mealData.protein || 0,
          fat: mealData.fat || 0,
          carbs: mealData.carbs || 0,
          image: mealData.image || '',
          entryMethod: mealData.entryMethod || 'unknown',
          servingSize: mealData.servingSize,
          servingsPerContainer: mealData.servingsPerContainer,
          sugars: mealData.sugars,
          dietaryFiber: mealData.dietaryFiber,
          sodium: mealData.sodium,
          cholesterol: mealData.cholesterol,
          saturatedFat: mealData.saturatedFat,
          unsaturatedFat: mealData.unsaturatedFat,
          vitamins: mealData.vitamins,
          minerals: mealData.minerals,
          createdAt: mealData.createdAt || now,
          updatedAt: mealData.updatedAt || now
        });

        batch.set(mealRef, meal.toDictionary());
        mealIds.push(mealRef.id);
      });

      await batch.commit();
      console.log(`Batch created ${meals.length} meal logs successfully`);
      
      return mealIds;
    } catch (error) {
      console.error('Error batch creating meal logs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const mealService = MealService.getInstance(); 