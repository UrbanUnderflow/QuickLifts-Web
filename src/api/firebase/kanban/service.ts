import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { KanbanTask, KanbanTaskData } from './types';
import { adminMethods } from '../admin/methods';

class KanbanService {
  private static instance: KanbanService;

  static getInstance(): KanbanService {
    if (!KanbanService.instance) {
      KanbanService.instance = new KanbanService();
    }
    return KanbanService.instance;
  }

  /**
   * Create a new kanban task
   */
  async createTask(taskData: Omit<KanbanTaskData, 'id' | 'createdAt' | 'updatedAt'>): Promise<KanbanTask> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const taskRef = doc(tasksRef);
      const now = new Date();

      const task = new KanbanTask({
        id: taskRef.id,
        ...taskData,
        createdAt: now,
        updatedAt: now
      });

      await setDoc(taskRef, task.toDictionary());
      console.log('Kanban task created successfully:', task.id);
      
      return task;
    } catch (error) {
      console.error('Error creating kanban task:', error);
      throw error;
    }
  }

  /**
   * Fetch all kanban tasks
   */
  async fetchAllTasks(): Promise<KanbanTask[]> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const q = query(tasksRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const tasks = querySnapshot.docs.map(doc => 
        KanbanTask.fromFirestore(doc.data(), doc.id)
      );

      console.log(`Fetched ${tasks.length} kanban tasks`);
      return tasks;
    } catch (error) {
      console.error('Error fetching kanban tasks:', error);
      throw error;
    }
  }

  /**
   * Fetch tasks by status
   */
  async fetchTasksByStatus(status: 'todo' | 'in-progress' | 'done'): Promise<KanbanTask[]> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const q = query(tasksRef, where('status', '==', status), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const tasks = querySnapshot.docs.map(doc => 
        KanbanTask.fromFirestore(doc.data(), doc.id)
      );

      return tasks;
    } catch (error) {
      console.error(`Error fetching ${status} tasks:`, error);
      throw error;
    }
  }

  /**
   * Update a kanban task
   */
  async updateTask(taskId: string, updates: Partial<Omit<KanbanTaskData, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const taskRef = doc(db, 'kanbanTasks', taskId);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await updateDoc(taskRef, updateData);
      console.log('Kanban task updated successfully:', taskId);
    } catch (error) {
      console.error('Error updating kanban task:', error);
      throw error;
    }
  }

  /**
   * Delete a kanban task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const taskRef = doc(db, 'kanbanTasks', taskId);
      await deleteDoc(taskRef);
      console.log('Kanban task deleted successfully:', taskId);
    } catch (error) {
      console.error('Error deleting kanban task:', error);
      throw error;
    }
  }

  /**
   * Update task status (for drag & drop)
   */
  async updateTaskStatus(taskId: string, status: 'todo' | 'in-progress' | 'done'): Promise<void> {
    try {
      await this.updateTask(taskId, { status });
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  /**
   * Fetch tasks by project
   */
  async fetchTasksByProject(project: string): Promise<KanbanTask[]> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const q = query(tasksRef, where('project', '==', project), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const tasks = querySnapshot.docs.map(doc => 
        KanbanTask.fromFirestore(doc.data(), doc.id)
      );

      return tasks;
    } catch (error) {
      console.error(`Error fetching tasks for project ${project}:`, error);
      throw error;
    }
  }

  /**
   * Fetch tasks by assignee
   */
  async fetchTasksByAssignee(assignee: string): Promise<KanbanTask[]> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const q = query(tasksRef, where('assignee', '==', assignee), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const tasks = querySnapshot.docs.map(doc => 
        KanbanTask.fromFirestore(doc.data(), doc.id)
      );

      return tasks;
    } catch (error) {
      console.error(`Error fetching tasks for assignee ${assignee}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all admin users for assignee autocomplete
   */
  async fetchAdminUsers(): Promise<Array<{id: string; email: string; displayName: string; username: string}>> {
    try {
      console.log('[KanbanService] Fetching admin users...');
      
      // Fetch all users
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('displayName'));
      const querySnapshot = await getDocs(q);
      
      console.log(`[KanbanService] Found ${querySnapshot.docs.length} total users`);
      
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || '',
        username: doc.data().username || '',
      })).filter(user => user.email); // Only users with email addresses

      console.log(`[KanbanService] Filtering ${allUsers.length} users for admin status...`);

      // Filter to only admin users with better error handling
      const adminUsers = [];
      let checkedCount = 0;
      
      for (const user of allUsers) {
        try {
          checkedCount++;
          console.log(`[KanbanService] Checking admin status ${checkedCount}/${allUsers.length}: ${user.email}`);
          
          const isAdmin = await adminMethods.isAdmin(user.email);
          if (isAdmin) {
            adminUsers.push(user);
            console.log(`[KanbanService] ✓ Admin user found: ${user.displayName || user.username} (${user.email})`);
          }
        } catch (userError) {
          console.warn(`[KanbanService] Error checking admin status for ${user.email}:`, userError);
          // Continue with next user instead of failing completely
        }
      }

      console.log(`[KanbanService] ✅ Found ${adminUsers.length} admin users out of ${allUsers.length} total users`);
      return adminUsers;
    } catch (error) {
      console.error('[KanbanService] ❌ Error fetching admin users:', error);
      throw error;
    }
  }

  /**
   * Fetch tasks by theme
   */
  async fetchTasksByTheme(theme: string): Promise<KanbanTask[]> {
    try {
      const tasksRef = collection(db, 'kanbanTasks');
      const q = query(tasksRef, where('theme', '==', theme), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const tasks = querySnapshot.docs.map(doc => 
        KanbanTask.fromFirestore(doc.data(), doc.id)
      );

      return tasks;
    } catch (error) {
      console.error(`Error fetching tasks for theme ${theme}:`, error);
      throw error;
    }
  }
}

export const kanbanService = KanbanService.getInstance(); 