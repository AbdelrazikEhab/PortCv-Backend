import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';
import Stripe from 'stripe';

import { prisma } from '../lib/prisma';

const router = express.Router();
// const prisma = new PrismaClient(); // Removed


// Initialize Stripe (will be null if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' })
    : null;

// Get current user's subscription
router.get('/current', authenticateToken, async (req: any, res) => {
    try {
        let subscription = await prisma.subscription.findUnique({
            where: { userId: req.user.userId },
        });

        // Create free subscription if doesn't exist
        if (!subscription) {
            subscription = await prisma.subscription.create({
                data: {
                    userId: req.user.userId,
                    plan: 'free',
                    status: 'active',
                    aiCreditsLimit: 5,
                    portfoliosLimit: 1,
                    resumesLimit: 1,
                },
            });
        }

        // Check if trial or gifted access has expired
        if (subscription.trialEndsAt && new Date() > subscription.trialEndsAt) {
            if (subscription.status === 'trialing') {
                subscription = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'active', plan: 'free' },
                });
            }
        }

        res.json(subscription);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Get subscription usage stats
router.get('/usage', authenticateToken, async (req: any, res) => {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { userId: req.user.userId },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const usage = {
            aiCredits: {
                used: subscription.aiCreditsUsed,
                limit: subscription.aiCreditsLimit,
                percentage: (subscription.aiCreditsUsed / subscription.aiCreditsLimit) * 100,
            },
            portfolios: {
                used: subscription.portfoliosUsed,
                limit: subscription.portfoliosLimit,
                percentage: (subscription.portfoliosUsed / subscription.portfoliosLimit) * 100,
            },
            resumes: {
                used: subscription.resumesUsed,
                limit: subscription.resumesLimit,
                percentage: (subscription.resumesUsed / subscription.resumesLimit) * 100,
            },
        };

        res.json(usage);
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

// Create Stripe checkout session
router.post('/checkout', authenticateToken, async (req: any, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        const { planName, billingPeriod } = req.body; // 'monthly' or 'yearly'

        const plan = await prisma.pricingPlan.findUnique({
            where: { name: planName },
        });

        if (!plan || !plan.isActive) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        const priceId = billingPeriod === 'yearly'
            ? plan.stripeYearlyPriceId
            : plan.stripeMonthlyPriceId;

        if (!priceId) {
            return res.status(400).json({ error: 'Stripe price ID not configured for this plan' });
        }

        let subscription = await prisma.subscription.findUnique({
            where: { userId: req.user.userId },
        });

        // Create or get Stripe customer
        let customerId = subscription?.stripeCustomerId;

        if (!customerId) {
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
            });

            const customer = await stripe.customers.create({
                email: user?.email,
                metadata: { userId: req.user.userId },
            });

            customerId = customer.id;

            // Update subscription with customer ID
            if (subscription) {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { stripeCustomerId: customerId },
                });
            }
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/pricing`,
            metadata: {
                userId: req.user.userId,
                planName,
                billingPeriod,
            },
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: any, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        const subscription = await prisma.subscription.findUnique({
            where: { userId: req.user.userId },
        });

        if (!subscription || !subscription.stripeSubscriptionId) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Cancel at period end (don't cancel immediately)
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        // Update local subscription
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'canceled' },
        });

        res.json({ message: 'Subscription will be canceled at the end of the billing period' });
    } catch (error: any) {
        console.error('Error canceling subscription:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Payment system not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        return res.status(400).send('Webhook signature missing');
    }

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Webhook handlers
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const planName = session.metadata?.planName;

    if (!userId || !planName) return;

    const plan = await prisma.pricingPlan.findUnique({
        where: { name: planName },
    });

    if (!plan) return;

    await prisma.subscription.update({
        where: { userId },
        data: {
            plan: planName,
            status: 'active',
            stripeSubscriptionId: session.subscription as string,
            aiCreditsLimit: plan.aiCreditsPerMonth,
            portfoliosLimit: plan.portfoliosLimit,
            resumesLimit: plan.resumesLimit,
        },
    });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });

    if (!userSub) return;

    await prisma.subscription.update({
        where: { id: userSub.id },
        data: {
            status: subscription.status,
        },
    });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });

    if (!userSub) return;

    // Downgrade to free plan
    await prisma.subscription.update({
        where: { id: userSub.id },
        data: {
            plan: 'free',
            status: 'active',
            stripeSubscriptionId: null,
            aiCreditsLimit: 5,
            portfoliosLimit: 1,
            resumesLimit: 1,
        },
    });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        include: { user: true },
    });
    if (!userSub) return;
    await prisma.transaction.create({
        data: {
            userId: userSub.userId,
            subscriptionId: userSub.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'completed',
            gateway: 'stripe',
            gatewayTransactionId: ((invoice as any).payment_intent ?? invoice.id) as string,
            gatewayInvoiceId: invoice.id,
            description: `Subscription payment - ${userSub.plan}`,
            type: 'subscription',
        },
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });
    if (!userSub) return;
    await prisma.subscription.update({
        where: { id: userSub.id },
        data: { status: 'past_due' },
    });
}

export default router;
