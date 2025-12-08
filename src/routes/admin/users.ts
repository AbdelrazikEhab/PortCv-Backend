import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Admin authentication middleware
const requireAdmin = async (req: any, res: express.Response, next: express.NextFunction) => {
    try {
        // Allow if user has admin role (from password login)
        if (req.user.role === 'admin') {
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
        });

        if (user?.email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
};

// Get all users with subscription info
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = search
            ? {
                OR: [
                    { email: { contains: search as string, mode: 'insensitive' as any } },
                    { fullName: { contains: search as string, mode: 'insensitive' as any } },
                ],
            }
            : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    subscriptions: true,
                    _count: {
                        select: {
                            resumes: true,
                            portfolios: true,
                            transactions: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get user details
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                subscriptions: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                giftedAccess: {
                    where: { isActive: true },
                },
                resumes: true,
                portfolios: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Grant gifted access to user
router.post('/:id/gift-access', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { plan, days, reason } = req.body;

        if (!plan || !days) {
            return res.status(400).json({ error: 'Plan and days are required' });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        // Create gifted access record
        const giftedAccess = await prisma.giftedAccess.create({
            data: {
                userId: id,
                grantedBy: req.user.userId,
                plan,
                daysGranted: days,
                expiresAt,
                reason,
                isActive: true,
            },
        });

        // Get pricing plan details
        const pricingPlan = await prisma.pricingPlan.findUnique({
            where: { name: plan },
        });

        if (!pricingPlan) {
            return res.status(404).json({ error: 'Pricing plan not found' });
        }

        // Update user's subscription
        await prisma.subscription.upsert({
            where: { userId: id },
            update: {
                plan,
                status: 'trialing',
                trialEndsAt: expiresAt,
                trialDaysGranted: days,
                aiCreditsLimit: pricingPlan.aiCreditsPerMonth,
                portfoliosLimit: pricingPlan.portfoliosLimit,
                resumesLimit: pricingPlan.resumesLimit,
                // Reset usage counters so user can use their new limits
                aiCreditsUsed: 0,
                portfoliosUsed: 0,
                resumesUsed: 0,
            },
            create: {
                userId: id,
                plan,
                status: 'trialing',
                trialEndsAt: expiresAt,
                trialDaysGranted: days,
                aiCreditsLimit: pricingPlan.aiCreditsPerMonth,
                portfoliosLimit: pricingPlan.portfoliosLimit,
                resumesLimit: pricingPlan.resumesLimit,
                // Start with 0 usage
                aiCreditsUsed: 0,
                portfoliosUsed: 0,
                resumesUsed: 0,
            },
        });

        res.json({ message: 'Access granted successfully', giftedAccess });
    } catch (error) {
        console.error('Error granting access:', error);
        res.status(500).json({ error: 'Failed to grant access' });
    }
});

// Manually adjust user's AI credits
router.put('/:id/credits', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { aiCreditsUsed, aiCreditsLimit } = req.body;

        const subscription = await prisma.subscription.findUnique({
            where: { userId: id },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const updated = await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                ...(aiCreditsUsed !== undefined && { aiCreditsUsed }),
                ...(aiCreditsLimit !== undefined && { aiCreditsLimit }),
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating credits:', error);
        res.status(500).json({ error: 'Failed to update credits' });
    }
});

// Get user transactions
router.get('/:id/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const transactions = await prisma.transaction.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Delete user (Force Signout / Ban)
router.delete('/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting self
        if (id === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user (cascade will handle related data)
        await prisma.user.delete({ where: { id } });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
