
"use server";

import { getAdminDb } from "@/lib/firebase-admin";

export async function updateUserServerAction(userId: string, data: any) {
  try {
    const adminDb = await getAdminDb();
    await adminDb.collection("users").doc(userId).set(data, { merge: true });

    return { success: true };
  } catch (err) {
    console.error("Admin update failed:", err);
    return { success: false, error: "Admin Firestore update failed" };
  }
}
