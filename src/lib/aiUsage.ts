'use server';

import { getAdminDb } from './firebase-admin';
import type { AiUsageEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const TOKEN_COST_PER_MILLION = 0.50; // Example cost for Gemini Flash ($0.50 per 1M tokens)

export async function getAiUsageLog(): Promise<AiUsageEntry[]> {
    try {
        const db = await getAdminDb();
        if (!db) return [];
        const snapshot = await db.collection('ai_usage_log').orderBy('timestamp', 'desc').limit(100).get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AiUsageEntry));
    } catch (error) {
        console.error("Error fetching AI usage logs from Firestore:", error);
        return [];
    }
}

/**
 * Enterprise Token Management: Deducts tokens from a user's profile and logs the usage.
 * FIXED: Uses batch.set with merge:true to prevent transaction failure if user profile is missing.
 */
export async function logAiUsage(
    serviceName: string, 
    usage: { totalTokens: number; inputTokens: number; outputTokens: number },
    context: { userId?: string; companyId?: string; metadata?: Record<string, any> } = {}
): Promise<void> {
    try {
        const db = await getAdminDb();
        if (!db) return;

        const { FieldValue } = await import('firebase-admin/firestore');
        const id = uuidv4();
        
        const newEntry: AiUsageEntry & { userId?: string; companyId?: string; metadata?: any } = {
            id,
            timestamp: new Date().toISOString(),
            serviceName,
            totalTokens: usage.totalTokens,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cost: (usage.totalTokens / 1_000_000) * TOKEN_COST_PER_MILLION,
            userId: context.userId || null,
            companyId: context.companyId || null,
            metadata: context.metadata || null,
        };
        
        const batch = db.batch();
        
        // 1. Log the usage
        const logRef = db.collection('ai_usage_log').doc(id);
        batch.set(logRef, newEntry);
        
        // 2. Deduct tokens from user profile if userId is provided
        // HARDENED: Using set with merge to ensure it creates the field if the doc exists
        // but doesn't have it, or doesn't crash if the doc is missing entirely.
        if (context.userId && usage.totalTokens > 0) {
            const userRef = db.collection('users').doc(context.userId);
            batch.set(userRef, {
                tokens: FieldValue.increment(-usage.totalTokens)
            }, { merge: true });
        }
        
        await batch.commit();
    } catch (error) {
        console.error("Failed to log and deduct AI usage:", error);
    }
}
