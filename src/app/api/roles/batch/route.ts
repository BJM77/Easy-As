import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin, getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { ALL_USER_ROLES } from "@/lib/types";
import { parseCsvRow } from "@/lib/csvParser";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const user = await checkSuperAdmin(token);

    const { csv } = await req.json();
    if (!csv) {
        return NextResponse.json({ error: 'CSV data is required' }, { status: 400 });
    }
    
    const auth = await getAdminAuth();
    const db = await getAdminDb();
    const batch = db.batch();

    const lines = csv.trim().split(/\r?\n/);
    const headerLine = lines.shift();
    if (!headerLine) {
        return NextResponse.json({ error: 'CSV is empty or has no header.' }, { status: 400 });
    }
    const header = parseCsvRow(headerLine.toLowerCase());
    if (!header.includes('email') || !header.includes('role')) {
        return NextResponse.json({ error: 'CSV must contain "email" and "role" headers.' }, { status: 400 });
    }

    const emailIndex = header.indexOf('email');
    const roleIndex = header.indexOf('role');

    let successCount = 0;
    const errors: string[] = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        const values = parseCsvRow(line);
        const email = values[emailIndex];
        const role = values[roleIndex]?.toLowerCase();

        if (!email || !role || !ALL_USER_ROLES.includes(role as any)) {
            errors.push(`Invalid line: ${line}`);
            continue;
        }

        try {
            const userRecord = await auth.getUserByEmail(email);
            const userDocRef = db.collection('users').doc(userRecord.uid);
            batch.update(userDocRef, { role });
            successCount++;
        } catch (userError) {
            errors.push(`Failed for ${email}: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
        }
    }
    
    await batch.commit();

    if (errors.length > 0) {
        return NextResponse.json({ 
            message: `${successCount} roles assigned successfully.`,
            errors: errors 
        }, { status: 207 });
    }

    return NextResponse.json({ success: true, message: `${successCount} roles assigned successfully.`, updatedBy: user.uid, count: successCount });
  } catch (err: any) {
    console.error("[roles/batch]", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: err.message?.includes('Forbidden') ? 403 : 500 });
  }
}
