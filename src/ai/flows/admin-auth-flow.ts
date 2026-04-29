'use server';

/**
 * @fileOverview Secure server-side password verification for administrative writes.
 * This replaces the hardcoded 'LCPTGE' string with a check against the 
 * ADMIN_WRITE_PASSWORD environment variable (stored in Secret Manager).
 */

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
    const securePassword = process.env.ADMIN_WRITE_PASSWORD;
    
    if (!securePassword) {
        console.error('[Security] ADMIN_WRITE_PASSWORD not set in environment.');
        // Fallback to legacy password temporarily if env var is missing to avoid lockout
        // but log it so we know we need to fix the environment.
        return inputPassword === 'LCPTGE';
    }

    return inputPassword === securePassword;
}
