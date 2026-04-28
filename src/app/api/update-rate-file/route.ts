
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromToken, checkSuperAdmin, checkCompanyAdmin, getAdminDb } from '@/lib/firebase-admin';
import { logAudit } from '@/lib/audit';

const updateSchema = z.object({
  fileName: z.string().regex(/^[a-zA-Z0-9_]+\.json$/, "Invalid file name format."),
  fileContentString: z.string().min(2, "Content is too short."),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];
    if (!token) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.formErrors }, { status: 400 });
    }
    
    const { fileName, fileContentString } = validation.data;

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const isCustomerFile = fileName.startsWith('customer_');
    const db = await getAdminDb();
    
    if (isCustomerFile) {
        await checkCompanyAdmin(token, user.companyId);
        // Save to companyRates
        const docId = `${user.companyId}_${fileName.replace('.json', '')}`;
        await db.collection('companyRates').doc(docId).set({
            id: docId,
            companyId: user.companyId,
            rateType: fileName.replace('customer_', '').replace('.json', ''),
            data: JSON.parse(fileContentString),
            updatedAt: new Date().toISOString(),
            updatedBy: user.email || user.uid
        }, { merge: true });
    } else {
        await checkSuperAdmin(token);
        // Save to globalRates (New persistent store for core JSONs)
        await db.collection('globalRates').doc(fileName.replace('.json', '')).set({
            fileName,
            data: JSON.parse(fileContentString),
            updatedAt: new Date().toISOString(),
            updatedBy: user.email || user.uid
        });
    }

    await logAudit('RATE_FILE_UPDATE', {
        userId: user.uid,
        userEmail: user.email,
        companyId: user.companyId,
        targetId: fileName,
        metadata: { fileSize: fileContentString.length, persistent: true }
    });

    return NextResponse.json({ message: `${fileName} updated and persisted successfully.` });

  } catch (error: any) {
    console.error(`[API /api/update-rate-file] Error:`, error);
    return NextResponse.json({ 
        error: 'Update denied or failed.', 
        details: error.message 
    }, { status: error.message?.includes('Forbidden') ? 403 : 500 });
  }
}
