
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth, getUserFromToken } from '@/lib/firebase-admin';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
});

const getUserIdFromRequest = async (request: Request): Promise<string | null> => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) return null;

  try {
    const user = await getUserFromToken(idToken);
    return user ? user.uid : null;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
};

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = await getAdminDb();
    const auth = await getAdminAuth();
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      // Auto-Repair Profile using Custom Claims or Defaults
      const userRecord = await auth.getUser(userId);
      const companyId = (userRecord.customClaims?.companyId as string) || 'easy-as';
      const role = (userRecord.customClaims?.role as string) || 'user';

      const defaultProfile = {
        id: userId,
        name: userRecord.displayName || userRecord.email?.split('@')[0] || 'New User',
        email: userRecord.email,
        role: role,
        companyId: companyId,
        assignedCompanyIds: [companyId],
        subscriptionStatus: 'active',
        tokens: 50000,
        createdAt: new Date().toISOString(),
      };
      await userDocRef.set(defaultProfile);
      return NextResponse.json(defaultProfile);
    }

    const data = userDoc.data();
    
    // Check if claims are out of sync with Firestore profile and trigger a silent update
    const userRecord = await auth.getUser(userId);
    if (userRecord.customClaims?.companyId !== data.companyId || userRecord.customClaims?.role !== data.role) {
        console.log(`[Sync] Updating claims for ${userId} to match Firestore profile.`);
        await auth.setCustomUserClaims(userId, {
            role: data.role,
            companyId: data.companyId,
            assignedCompanyIds: data.assignedCompanyIds || [data.companyId],
            tokens: data.tokens || 0
        });
    }

    return NextResponse.json({ id: userDoc.id, ...data });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = await getAdminDb();
    const body = await request.json();
    
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.formErrors }, { status: 400 });
    }
    
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.update({
        name: validation.data.name,
        updatedAt: new Date().toISOString(),
    });
    
    const updatedDoc = await userDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
