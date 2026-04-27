import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebase-admin';
import type { ProblemEntry } from '@/lib/types';
import { problemLogSchema } from '@/lib/zodSchemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const user = await getUserFromToken(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getAdminDb();
        const problemsCollection = db.collection('problems');
        const newProblemData = await request.json();

        const validation = problemLogSchema.safeParse(newProblemData);
         if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.formErrors }, { status: 400 });
        }

        const entryToAdd: Omit<ProblemEntry, 'id'> = {
            ...validation.data,
            userId: user.uid,
            companyId: user.companyId,
            date: new Date().toISOString(),
            status: 'open',
            reportedBy: user.email || 'System', 
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
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const user = await getUserFromToken(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getAdminDb();
        const problemsCollection = db.collection('problems');
        const { id, ...dataToUpdate } : Partial<ProblemEntry> & { id: string } = await request.json();
        
        if (!id) {
            return NextResponse.json({ error: 'Problem ID is required for updates.' }, { status: 400 });
        }

        const docRef = problemsCollection.doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
        }
        
        const existingData = snap.data();
        const isAuthorized = user.role === 'superadmin' || user.companyId === existingData?.companyId;

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden: Access denied to this record.' }, { status: 403 });
        }

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
