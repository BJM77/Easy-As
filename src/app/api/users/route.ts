import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, checkCompanyAdmin, getUserFromToken } from '@/lib/firebase-admin';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';
import { ALL_USER_ROLES } from '@/lib/types';

export const dynamic = 'force-dynamic';

const createUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(ALL_USER_ROLES as [string, ...string[]]),
  companyId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    if (!token) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    
    const body = await request.json();
    const validation = createUserRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.formErrors }, { status: 400 });
    }
    
    const { email, password, name, role, companyId } = validation.data;
    const admin = await checkCompanyAdmin(token, companyId);
    
    const auth = await getAdminAuth(); 
    const db = await getAdminDb(); 

    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password, displayName: name });
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'User already exists.' }, { status: 409 });
      }
      throw createErr;
    }

    await auth.setCustomUserClaims(userRecord.uid, {
      role, companyId, assignedCompanyIds: [companyId], tokens: 100000
    });

    try {
      const profilePayload = {
        id: userRecord.uid,
        name,
        email,
        role,
        companyId,
        assignedCompanyIds: [companyId],
        subscriptionStatus: 'active' as const,
        tokens: 100000,
        createdAt: new Date().toISOString(),
      };
      await db.collection('users').doc(userRecord.uid).set(profilePayload);
      await logAudit('USER_CREATE', { userId: admin.uid, userEmail: admin.email, companyId: admin.companyId, targetId: userRecord.uid, metadata: { email, role, companyId } });
    } catch (writeErr: any) {
      await auth.deleteUser(userRecord.uid);
      throw writeErr;
    }
    return NextResponse.json({ uid: userRecord.uid, email: userRecord.email }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Admin SDK error', details: error?.message || 'Check environment configuration.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    if (!token) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    
    const auth = await getAdminAuth(); 
    const db = await getAdminDb(); 
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Invalid UID' }, { status: 400 });
    
    const userToDrop = await auth.getUser(uid);
    const targetCompanyId = userToDrop.customClaims?.companyId as string;
    const admin = await checkCompanyAdmin(token, targetCompanyId);
    
    if (uid === admin.uid) return NextResponse.json({ error: 'Cannot delete self' }, { status: 400 });
    
    await auth.deleteUser(uid);
    await db.collection('users').doc(uid).delete();
    await logAudit('USER_DELETE', { userId: admin.uid, userEmail: admin.email, companyId: admin.companyId, targetId: uid, metadata: { deletedEmail: userToDrop.email } });
    return NextResponse.json({ message: 'User deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    if (!token) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    
    const auth = await getAdminAuth();
    const currentUser = await getUserFromToken(token);
    if (!currentUser) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const users: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const result = await auth.listUsers(1000, pageToken);
      result.users.forEach(u => {
          const companyId = u.customClaims?.companyId;
          if (currentUser.role === 'superadmin' || companyId === currentUser.companyId || (currentUser.assignedCompanyIds || []).includes(companyId as string)) {
              users.push({ uid: u.uid, email: u.email, lastSignInTime: u.metadata.lastSignInTime, creationTime: u.metadata.creationTime, companyId });
          }
      });
      pageToken = result.pageToken;
    } while (pageToken);

    return NextResponse.json(users);
  } catch (error: any) {
     return NextResponse.json({ error: 'Admin SDK initialization failed.', details: error.message }, { status: 500 });
  }
}