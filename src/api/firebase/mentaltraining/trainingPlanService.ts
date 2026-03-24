import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../config';
import { PULSECHECK_TRAINING_PLANS_COLLECTION } from './collections';
import {
  type PulseCheckTrainingPlan,
  type PulseCheckTrainingPlanStatus,
  pulseCheckTrainingPlanFromFirestore,
  pulseCheckTrainingPlanToFirestore,
} from './types';

const COLLECTION = PULSECHECK_TRAINING_PLANS_COLLECTION;
const ACTIVE_STATUSES: PulseCheckTrainingPlanStatus[] = ['active', 'paused'];

const sortPlans = (left: PulseCheckTrainingPlan, right: PulseCheckTrainingPlan) => {
  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }

  if ((right.updatedAt || right.createdAt) !== (left.updatedAt || left.createdAt)) {
    return (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);
  }

  return String(left.title || '').localeCompare(String(right.title || ''));
};

export const trainingPlanService = {
  async getById(id: string): Promise<PulseCheckTrainingPlan | null> {
    const snapshot = await getDoc(doc(db, COLLECTION, id));
    if (!snapshot.exists()) return null;
    return pulseCheckTrainingPlanFromFirestore(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async listForAthlete(athleteId: string): Promise<PulseCheckTrainingPlan[]> {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), where('athleteId', '==', athleteId))
    );

    return snapshot.docs
      .map((docSnap) => pulseCheckTrainingPlanFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortPlans);
  },

  async listActiveForAthlete(athleteId: string): Promise<PulseCheckTrainingPlan[]> {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTION),
        where('athleteId', '==', athleteId),
        where('status', 'in', ACTIVE_STATUSES)
      )
    );

    return snapshot.docs
      .map((docSnap) => pulseCheckTrainingPlanFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortPlans);
  },

  async getPrimaryForAthlete(athleteId: string): Promise<PulseCheckTrainingPlan | null> {
    const plans = await this.listActiveForAthlete(athleteId);
    return plans.find((plan) => plan.isPrimary) || null;
  },

  async listSecondaryForAthlete(athleteId: string): Promise<PulseCheckTrainingPlan[]> {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTION),
        where('athleteId', '==', athleteId),
        where('isPrimary', '==', false),
        where('status', 'in', ACTIVE_STATUSES)
      )
    );

    return snapshot.docs
      .map((docSnap) => pulseCheckTrainingPlanFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortPlans);
  },

  async save(plan: PulseCheckTrainingPlan): Promise<PulseCheckTrainingPlan> {
    const payload = pulseCheckTrainingPlanToFirestore(plan);
    await setDoc(doc(db, COLLECTION, plan.id), payload, { merge: true });
    return plan;
  },

  async upsert(plan: PulseCheckTrainingPlan): Promise<PulseCheckTrainingPlan> {
    return this.save(plan);
  },
};
