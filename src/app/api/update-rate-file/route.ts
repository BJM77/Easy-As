
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { getUserFromToken, checkSuperAdmin, checkCompanyAdmin } from '@/lib/firebase-admin';
import { logAudit } from '@/lib/audit';

/**
 * @fileOverview Hardened Rate File Update Endpoint.
 * Replaced hardcoded password with Token Claim Authorization.
 */

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

    // 1. Authorization: Verify user role and company context
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // Determine target company for the audit and security check
    // Customer files (customer_*.json) are manageable by Company Admins
    // Core files (*.json) are manageable ONLY by Superadmins
    const isCustomerFile = fileName.startsWith('customer_');
    
    if (isCustomerFile) {
        // Verify the user is an admin for the current workspace
        // We assume the caller is updating their own workspace's persistent rates
        await checkCompanyAdmin(token, user.companyId);
    } else {
        // Core files require global Superadmin status
        await checkSuperAdmin(token);
    }

    // 2. Path Sanitization
    if (fileName.includes('..') || fileName.includes('/')) {
        return NextResponse.json({ error: 'Invalid file name.'}, { status: 400 });
    }

    const publicDir = path.join(process.cwd(), 'src', 'public');
    const filePath = path.join(publicDir, fileName);

    if (!filePath.startsWith(publicDir)) {
        return NextResponse.json({ error: 'Access denied to filesystem target.'}, { status: 400 });
    }

    // 3. Persist Change
    await fs.writeFile(filePath, fileContentString, 'utf8');

    // 4. Log Audit
    await logAudit('RATE_FILE_UPDATE', {
        userId: user.uid,
        userEmail: user.email,
        companyId: user.companyId,
        targetId: fileName,
        metadata: { fileSize: fileContentString.length }
    });

    return NextResponse.json({ message: `${fileName} updated successfully.` });

  } catch (error: any) {
    console.error(`[API /api/update-rate-file] Error:`, error);
    return NextResponse.json({ 
        error: 'Update denied or failed.', 
        details: error.message 
    }, { status: error.message?.includes('Forbidden') ? 403 : 500 });
  }
}
