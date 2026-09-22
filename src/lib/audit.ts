
'use server';

import { getAdminDb } from './firebase-admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * @fileOverview Centralized Audit Logging for Enterprise Compliance.
 * Tracks sensitive actions, who performed them, and their context.
 */

export type AuditAction = 
  | 'USER_CREATE' 
  | 'USER_DELETE' 
  | 'ROLE_UPDATE' 
  | 'COMPANY_UPDATE' 
  | 'RATE_FILE_UPDATE' 
  | 'SETTINGS_UPDATE'
  | 'SECURITY_BYPASS_ATTEMPT';

interface AuditContext {
  userId: string;
  userEmail: string;
  companyId: string;
  targetId?: string;
  metadata?: any;
}

/**
 * Records a critical system event to the audit_logs collection.
 * This collection is write-protected in Security Rules (Superadmin Read-Only).
 */
export async function logAudit(action: AuditAction, context: AuditContext) {
  try {
    const db = await getAdminDb();
    const logId = uuidv4();
    
    const entry = {
      id: logId,
      timestamp: new Date().toISOString(),
      action,
      ...context
    };

    await db.collection('audit_logs').doc(logId).set(entry);
    console.log(`[AUDIT] ${action} by ${context.userEmail} on ${context.targetId || 'SYSTEM'}`);
  } catch (error) {
    console.error("CRITICAL: Failed to write to audit log:", error);
    // In a high-compliance env, you might want to throw here to halt the primary action
  }
}
