import { NextRequest, NextResponse } from 'next/server';
import { aiHealthCheck, testAiConnection } from '@/ai/flows/test-connection-flow';
import { checkSuperAdmin } from '@/lib/firebase-admin';

/**
 * Superadmin-only health check endpoint for AI service at /api/ai-health.
 * Calls Gemini with a one-line prompt and returns { ok, model, error }.
 * Never exposes the API key.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) {
      return NextResponse.json({ ok: false, model: '', error: 'Unauthorized: Missing authentication token' }, { status: 401 });
    }

    try {
      await checkSuperAdmin(token);
    } catch (authErr: any) {
      return NextResponse.json({ ok: false, model: '', error: authErr.message || 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const result = await aiHealthCheck();
    
    if (!result.ok) {
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      model: result.model
    });
  } catch (error) {
    console.error('AI Health Check Error:', error);
    return NextResponse.json({
      ok: false,
      model: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

/**
 * Legacy test endpoint (kept for backwards compatibility)
 */
export async function POST(request: NextRequest) {
  try {
    const result = await testAiConnection();
    
    if (result.success) {
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: result.error }, { status: 503 });
  } catch (error) {
    console.error('AI Test Error:', error);
    return NextResponse.json({ success: false, error: 'Test failed' }, { status: 503 });
  }
}

