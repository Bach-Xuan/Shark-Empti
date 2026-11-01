import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { isActivityDay } from '@/lib/activity-day';

/** Merge only the day's leaf, even when a device has an old activity snapshot. */
export function recordActiveDay(db: Firestore, uid: string, day: string) {
  if (!isActivityDay(day)) throw new Error('Invalid activity date.');
  return setDoc(doc(db, 'users', uid, 'activity', 'main'), {
    activeDays: { [day]: true }, updatedAt: serverTimestamp(),
  }, { mergeFields: [`activeDays.${day}`, 'updatedAt'] });
}
