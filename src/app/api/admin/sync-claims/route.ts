
import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin, getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

/**
 * @fileOverview Batch migration utility to promote existing users to the Custom Claims system.
 * This should be triggered once by a Superadmin to initialize the Zero-Latency architecture.
 */

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    await checkSuperAdmin(token);

    const auth = await getAdminAuth();
    const db = await getAdminDb();

    const usersSnapshot = await db.collection("users").get();
    let successCount = 0;
    let failCount = 0;

    const promises = usersSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      try {
        await auth.setCustomUserClaims(doc.id, {
          role: data.role || 'user',
          companyId: data.companyId || 'easy-as',
          assignedCompanyIds: data.assignedCompanyIds || [data.companyId || 'easy-as'],
          tokens: data.tokens || 0
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to sync claims for user ${doc.id}:`, err);
        failCount++;
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ 
      success: true, 
      message: `Claims synchronization complete.`,
      stats: { success: successCount, failed: failCount }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
