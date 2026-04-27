import { NextResponse } from "next/server";
import { checkCompanyAdmin, getAdminDb, getAdminAuth, getUserFromToken, checkSuperAdmin } from "@/lib/firebase-admin";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { ALL_USER_ROLES } from "@/lib/types";

export const dynamic = 'force-dynamic';

const userUpdateSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(ALL_USER_ROLES as [string, ...string[]]).optional(),
  companyId: z.string().optional(),
  assignedCompanyIds: z.array(z.string()).optional(),
  tokens: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });

    const body = await req.json();
    const validation = userUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }

    const { uid, role, companyId, assignedCompanyIds, tokens } = validation.data;

    const db = await getAdminDb();
    const auth = await getAdminAuth();

    // 1. Fetch current profile state
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();
    
    let userData = userDoc.exists ? userDoc.data() : null;

    // 2. Authorization & Auth Verification
    const userRecord = await auth.getUser(uid).catch(() => null);
    if (!userRecord) {
        return NextResponse.json({ error: "Authentication account not found for this UID." }, { status: 404 });
    }

    if (userData) {
        // Standard Update: Check requester authority over the target company
        await checkCompanyAdmin(token, userData.companyId);
    } else {
        // Orphaned Auth Account: Only Superadmins can initialize the profile
        console.log(`[Sync] Orphaned Auth account detected for ${uid}. Attempting profile initialization.`);
        await checkSuperAdmin(token);
    }

    // 3. Prepare Updates
    const firestoreUpdate: any = { 
        updatedAt: new Date().toISOString() 
    };

    if (!userData) {
        // INITIALIZATION: Fill in required fields from Auth record
        firestoreUpdate.id = uid;
        firestoreUpdate.email = userRecord.email;
        firestoreUpdate.name = userRecord.displayName || userRecord.email?.split('@')[0] || 'New User';
        firestoreUpdate.createdAt = new Date().toISOString();
        firestoreUpdate.subscriptionStatus = 'active';
        firestoreUpdate.tokens = tokens !== undefined ? tokens : 50000;
    }

    if (role) firestoreUpdate.role = role;
    if (companyId) firestoreUpdate.companyId = companyId;
    if (assignedCompanyIds) firestoreUpdate.assignedCompanyIds = assignedCompanyIds;
    if (tokens !== undefined && userData) firestoreUpdate.tokens = tokens;

    // 4. Update or Create Firestore Profile
    await userDocRef.set(firestoreUpdate, { merge: true });

    // 5. Sync Custom Claims to the JWT
    await auth.setCustomUserClaims(uid, {
      role: role || userData?.role || 'user',
      companyId: companyId || userData?.companyId || 'easy-as',
      assignedCompanyIds: assignedCompanyIds || userData?.assignedCompanyIds || [companyId || userData?.companyId || 'easy-as'],
      tokens: tokens !== undefined ? tokens : (userData?.tokens || (firestoreUpdate.tokens || 0))
    });

    // 6. Record Audit
    const requester = await getUserFromToken(token);
    if (requester) {
        await logAudit(userData ? 'ROLE_UPDATE' : 'USER_CREATE', {
          userId: requester.uid,
          userEmail: requester.email || 'system',
          companyId: requester.companyId || 'system',
          targetId: uid,
          metadata: { 
              fromRole: userData?.role, 
              toRole: role, 
              initialization: !userData,
              targetEmail: userRecord.email 
          }
        });
    }

    return NextResponse.json({ 
        success: true, 
        message: userData ? "User updated successfully." : "Firestore profile initialized for Auth account.",
        uid
    });
  } catch (err: any) {
    console.error("[roles/update] Error:", err);
    return NextResponse.json({ 
        error: "Server Error", 
        details: err.message || "Internal server error" 
    }, { status: 500 });
  }
}
