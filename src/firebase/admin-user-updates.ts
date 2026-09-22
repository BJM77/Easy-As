
// src/firebase/admin-user-updates.ts
"use server";
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import type { UserRole } from '@/lib/types';

export async function updateUserAdmin(
  uid: string,
  payload: { role?: UserRole; tokens?: number }
) {
  const db = await getAdminDb();
  const auth = await getAdminAuth();

  const userDocRef = db.collection("users").doc(uid);

  await userDocRef.update(payload);

  // Optionally verify the user with Auth and return the record
  const userRecord = await auth.getUser(uid);
  return { success: true, userRecord: { uid: userRecord.uid, email: userRecord.email } };
}
