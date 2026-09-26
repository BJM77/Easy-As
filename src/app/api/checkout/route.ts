import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key');

const checkoutSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  planName: z.literal('Monthly Starter'),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserFromToken(token);
    const validation = checkoutSchema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid checkout request', details: validation.error.flatten() }, { status: 400 });
    }

    const { companyName, planName } = validation.data;
    const userId = user?.uid;
    const email = user?.email;

    if (!userId || !email) {
      return NextResponse.json({ error: 'Authenticated user email is required' }, { status: 400 });
    }

    // This creates a Checkout Session for a $9.95 monthly subscription
    // In a real app, you would use a Price ID from your Stripe dashboard
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: 'FreightAssist.Online Monthly Subscription',
              description: `Monthly access for ${companyName}`,
            },
            unit_amount: 995, // $9.95 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.nextUrl.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
      cancel_url: `${req.nextUrl.origin}/payment/cancel?userId=${userId}`,
      customer_email: email,
      metadata: {
        userId,
        companyName,
        planName,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
