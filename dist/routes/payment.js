"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '');
// Create Checkout Session
router.post('/create-checkout-session', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { priceId, mode = 'subscription' } = req.body;
        const user = req.user;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode,
            success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/dashboard`,
            customer_email: user.email,
            metadata: {
                userId: user.userId,
            },
        });
        res.json({ url: session.url });
    }
    catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});
// Webhook handler
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
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
exports.default = router;
