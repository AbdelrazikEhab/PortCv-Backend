"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const stripe_1 = __importDefault(require("stripe"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Initialize Stripe (will be null if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' })
    : null;
// Get current user's subscription
router.get('/current', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});
// Get subscription usage stats
router.get('/usage', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});
// Create Stripe checkout session
router.post('/checkout', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});
// Cancel subscription
router.post('/cancel', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error canceling subscription:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
});
// Stripe webhook handler
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
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
                await handleCheckoutCompleted(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});
// Webhook handlers
async function handleCheckoutCompleted(session) {
    const userId = session.metadata?.userId;
    const planName = session.metadata?.planName;
    if (!userId || !planName)
        return;
    const plan = await prisma.pricingPlan.findUnique({
        where: { name: planName },
    });
    if (!plan)
        return;
    await prisma.subscription.update({
        where: { userId },
        data: {
            plan: planName,
            status: 'active',
            stripeSubscriptionId: session.subscription,
            aiCreditsLimit: plan.aiCreditsPerMonth,
            portfoliosLimit: plan.portfoliosLimit,
            resumesLimit: plan.resumesLimit,
        },
    });
}
async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });
    if (!userSub)
        return;
    await prisma.subscription.update({
        where: { id: userSub.id },
        data: {
            status: subscription.status,
        },
    });
}
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });
    if (!userSub)
        return;
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
async function handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        include: { user: true },
    });
    if (!userSub)
        return;
    await prisma.transaction.create({
        data: {
            userId: userSub.userId,
            subscriptionId: userSub.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'completed',
            gateway: 'stripe',
            gatewayTransactionId: (invoice.payment_intent ?? invoice.id),
            gatewayInvoiceId: invoice.id,
            description: `Subscription payment - ${userSub.plan}`,
            type: 'subscription',
        },
    });
}
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const userSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
    });
    if (!userSub)
        return;
    await prisma.subscription.update({
        where: { id: userSub.id },
        data: { status: 'past_due' },
    });
}
exports.default = router;
