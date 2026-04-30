'use server';

import type { ServiceAccount } from 'firebase-admin';
import type { UserProfile, UserRole } from '@/lib/types';

/**
 * Aggressively cleans environment variable strings.
 * Removes wrapping quotes and extra whitespace recursively.
 */
const clean = (val: string | undefined): string | undefined => {
  if (!val) return undefined;
  let c = val.trim();
  while ((c.startsWith("'") && c.endsWith("'")) || (c.startsWith('"') && c.endsWith('"'))) {
    c = c.slice(1, -1).trim();
  }
  return c;
};

/**
 * Specifically cleans the private key to handle newline issues.
 */
const cleanPrivateKey = (key: string | undefined) => {
  const cleaned = clean(key);
  if (!cleaned) return undefined;
  // Handle both literal newlines and escaped newline strings
  return cleaned.replace(/\\n/g, '\n');
};

/**
 * Extreme Resiliency JSON Parser:
 * 1. Strips accidental surrounding quotes.
 * 2. Handles double-stringification (strings that contain stringified JSON).
 * 3. Unescapes internal quotes (\") which cause "Expected property name" errors.
 */
const safeJsonParse = (jsonStr: string | undefined) => {
  const cleaned = clean(jsonStr);
  if (!cleaned) return undefined;

  try {
    // Attempt 1: Standard Parse
    let parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string') {
      // Attempt 2: Handle Double-Stringification
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e) {
    try {
        // Attempt 3: Handle Escaped Quotes (\") and double-escaped newlines
        const unescaped = cleaned.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n');
        return JSON.parse(unescaped);
    } catch {
        return undefined;
    }
  }
};

async function initializeAdmin() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;

  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  
  const apps = getApps();
  if (apps.length > 0) return apps[0]!;

  const rawEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonCredentials = safeJsonParse(rawEnv);
  
  const separateId = clean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const separateEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const separateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  console.log(`[Admin SDK] Auth Check: JSON_ENV=${!!rawEnv}, SEP_ID=${!!separateId}, SEP_EMAIL=${!!separateEmail}, SEP_KEY=${!!separateKey}`);

  try {
    let credential;

    if (separateId && separateEmail && separateKey) {
      console.log("[Admin SDK] Using Individual Vars.");
      credential = cert({
        projectId: separateId,
        clientEmail: separateEmail,
        privateKey: separateKey,
      });
    }
    else if (jsonCredentials && jsonCredentials.project_id && jsonCredentials.private_key) {
      console.log(`[Admin SDK] Using JSON Secret for project: ${jsonCredentials.project_id}, email: ${jsonCredentials.client_email}`);
      if (jsonCredentials.private_key) {
          jsonCredentials.private_key = jsonCredentials.private_key.replace(/\\n/g, '\n');
      }
      credential = cert(jsonCredentials as ServiceAccount);
    }

    if (!credential) {
      console.error("[Admin SDK] No valid credential configuration found in environment variables.");
      throw new Error(`Missing credentials.`);
    }

    return initializeApp({ credential });
  } catch (e: any) {
    console.error("Admin SDK Initialization Error:", e.message);
    throw new Error(`Admin Auth failed to initialize. ${e.message}`);
  }
}

export async function getAdminDb() {
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = await initializeAdmin();
  if (!app) throw new Error("Admin Firestore failed to initialize.");
  return getFirestore(app);
}

export async function getAdminAuth() {
  const { getAuth } = await import("firebase-admin/auth");
  const app = await initializeAdmin();
  if (!app) throw new Error("Admin Auth failed to initialize.");
  return getAuth(app);
}

export async function getUserFromToken(idToken: string): Promise<(UserProfile & { uid: string }) | null> {
  if (!idToken) throw new Error("Missing id token");
  const auth = await getAdminAuth();
  if (!auth) return null;

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      id: decodedToken.uid,
      email: decodedToken.email || '',
      name: (decodedToken.name as string) || '',
      role: (decodedToken.role as UserRole) || 'user',
      companyId: (decodedToken.companyId as string) || 'easy-as',
      assignedCompanyIds: (decodedToken.assignedCompanyIds as string[]) || [],
      subscriptionStatus: 'active',
      tokens: (decodedToken.tokens as number) || 0
    } as UserProfile & { uid: string };
  } catch (err) {
    throw new Error("Invalid id token");
  }
}

export async function checkSuperAdmin(idToken: string): Promise<(UserProfile & { uid: string })> {
  const user = await getUserFromToken(idToken);
  if (user && user.role === 'superadmin') {
      return user;
  }
  throw new Error("Forbidden: This action requires superadmin privileges.");
}

export async function checkCompanyAdmin(idToken: string, targetCompanyId: string): Promise<UserProfile & { uid: string }> {
  const user = await getUserFromToken(idToken);
  if (!user) throw new Error("Unauthorized");
  const hasAccess = user.role === 'superadmin' || (user.role === 'admin' && user.companyId === targetCompanyId) || (user.assignedCompanyIds?.includes(targetCompanyId));
  if (!hasAccess) throw new Error(`Forbidden: Access denied to workspace ${targetCompanyId}.`);
  return user;
}
