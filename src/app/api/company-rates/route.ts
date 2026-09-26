import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCompanyAdmin, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const companyRateSchema = z.object({
  companyId: z.string().regex(/^[a-zA-Z0-9-]+$/).max(120),
  rateType: z.string().regex(/^customer_[a-z0-9_]+$/).max(80),
  accountNumber: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional().nullable(),
  data: z.unknown(),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

    const validation = companyRateSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid company rate payload', details: validation.error.flatten() }, { status: 400 });
    }

    const { companyId, rateType, accountNumber, data } = validation.data;
    const user = await checkCompanyAdmin(token, companyId);
    const rateTypeKey = accountNumber ? `${rateType}_${accountNumber}` : rateType;
    const docId = `${companyId}_${rateTypeKey}`;

    await (await getAdminDb()).collection('companyRates').doc(docId).set({
      id: docId,
      companyId,
      rateType,
      accountNumber: accountNumber || null,
      data,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email || user.uid,
    }, { merge: true });

    return NextResponse.json({ id: docId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not persist company rates.';
    const status = message.includes('Forbidden') ? 403 : message.includes('Invalid id token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
