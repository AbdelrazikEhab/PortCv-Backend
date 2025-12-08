import express from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Create Checkout Session
router.post('/create-checkout-session', authenticateToken, async (req: any, res) => {
    try {
        const { priceId, mode = 'subscription' } = req.body;
        const user = req.user;

        // Robust origin resolution
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:8080';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode,
            success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard`,
            customer_email: user.email,
            metadata: {
                userId: user.userId,
            },
        });

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error details:', {
            message: error.message,
            type: error.type,
            code: error.code,
            param: error.param,
            requestBody: req.body,
            hasKey: !!process.env.STRIPE_SECRET_KEY
        });
        let status = 500;
        let message = 'Failed to create checkout session';

        if (error.type === 'StripeInvalidRequestError') {
            status = 400;
            // Provide clearer message for invalid price ID
            message = error.code === 'resource_missing' ? `Invalid Configuration: Price ID '${req.body.priceId}' not found in Stripe.` : error.message;
        } else if (error.type === 'StripeCardError') {
            status = 402;
            message = error.message;
        }

        res.status(status).json({
            error: message,
            details: error.message
        });
    }
});

// Webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig as string,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: any) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            // Update subscription status in DB
            if (session.metadata && session.metadata.userId) {
                await prisma.subscription.update({
                    where: { userId: session.metadata.userId },
                    data: {
                        status: 'active',
                        plan: session.amount_total ? 'pro' : 'free'
                    }
                });
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
});

export default router;
