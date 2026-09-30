import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebase-admin';
import type { ProblemEntry } from '@/lib/types';
import { problemLogSchema } from '@/lib/zodSchemas';

export const dynamic = 'force-dynamic';

// Helper to get user ID from token
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

export async function POST(request: Request) {
    try {
        const userId = await getUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getAdminDb();
        const problemsCollection = db.collection('problems');
        const token = request.headers.get('Authorization')?.slice(7);
        const authUser = token ? await getUserFromToken(token) : null;
        const newProblemData: Omit<ProblemEntry, 'id' | 'date' | 'status' | 'userId'> = await request.json();

        const validation = problemLogSchema.safeParse(newProblemData);
         if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.formErrors }, { status: 400 });
        }

        const entryToAdd: Omit<ProblemEntry, 'id'> = {
            ...validation.data,
            userId: userId,
            companyId: newProblemData.companyId || authUser?.companyId || 'easy-as',
            date: new Date().toISOString(),
            status: 'open',
            reportedBy: newProblemData.reportedBy || 'System', 
            solution: '',
            outcome: '',
            dateCompleted: null,
        };
        
        const newDocRef = await problemsCollection.add(entryToAdd);
        const newDoc = await newDocRef.get();

        return NextResponse.json({ 
            id: newDoc.id, 
            ...newDoc.data()
         }, { status: 201 });

    } catch (error: any) {
        console.error(`[API /api/problems] POST Error:`, error);
        return NextResponse.json({ error: 'Failed to save new problem.', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = await getUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getAdminDb();
        const problemsCollection = db.collection('problems');
        const { id, ...dataToUpdate } : Partial<ProblemEntry> & { id: string } = await request.json();
        
        if (!id) {
            return NextResponse.json({ error: 'Problem ID is required for updates.' }, { status: 400 });
        }

        const docRef = problemsCollection.doc(id);
        await docRef.update({ ...dataToUpdate, updatedAt: new Date().toISOString() });
        
        const updatedDoc = await docRef.get();

        return NextResponse.json({
            id: updatedDoc.id,
            ...updatedDoc.data()
        });

    } catch (error: any) {
        console.error(`[API /api/problems] PATCH Error:`, error);
        return NextResponse.json({ error: 'Failed to update problem.', details: error.message }, { status: 500 });
    }
}