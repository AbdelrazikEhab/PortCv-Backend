import express from 'express';
import { authenticateToken } from '../../middleware/authMiddleware';
import { prisma } from '../../lib/prisma';

const router = express.Router();
// const prisma = new PrismaClient(); // Removed

// Admin authentication middleware
const requireAdmin = async (req: any, res: express.Response, next: express.NextFunction) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
        });

        // Check if user email matches admin email from env
        if (user?.email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
};

// Get all pricing plans
router.get('/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const plans = await prisma.pricingPlan.findMany({
            orderBy: { sortOrder: 'asc' },
        });
        res.json(plans);
    } catch (error) {
        console.error('Error fetching pricing plans:', error);
        res.status(500).json({ error: 'Failed to fetch pricing plans' });
    }
});

// Create or update pricing plan
router.post('/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            displayName,
            description,
            monthlyPrice,
            yearlyPrice,
            features,
            aiCreditsPerMonth,
            portfoliosLimit,
            resumesLimit,
            stripeMonthlyPriceId,
            stripeYearlyPriceId,
            isActive,
            sortOrder,
        } = req.body;

        const plan = await prisma.pricingPlan.upsert({
            where: { name },
            update: {
                displayName,
                description,
                monthlyPrice,
                yearlyPrice,
                features,
                aiCreditsPerMonth,
                portfoliosLimit,
                resumesLimit,
                stripeMonthlyPriceId,
                stripeYearlyPriceId,
                isActive,
                sortOrder,
            },
            create: {
                name,
                displayName,
                description,
                monthlyPrice,
                yearlyPrice,
                features,
                aiCreditsPerMonth,
                portfoliosLimit,
                resumesLimit,
                stripeMonthlyPriceId,
                stripeYearlyPriceId,
                isActive,
                sortOrder,
            },
        });

        res.json(plan);
    } catch (error) {
        console.error('Error creating/updating pricing plan:', error);
        res.status(500).json({ error: 'Failed to save pricing plan' });
    }
});

// Update specific plan
router.put('/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const plan = await prisma.pricingPlan.update({
            where: { id },
            data: updateData,
        });

        res.json(plan);
    } catch (error) {
        console.error('Error updating pricing plan:', error);
        res.status(500).json({ error: 'Failed to update pricing plan' });
    }
});

// Get admin settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        let settings = await prisma.adminSettings.findFirst();

        // Create default settings if none exist
        if (!settings) {
            settings = await prisma.adminSettings.create({
                data: {
                    atsScorePrice: 0.10,
                    resumeParsePrice: 0.05,
                    defaultTrialDays: 7,
                    activeOffers: [],
                    maintenanceMode: false,
                },
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching admin settings:', error);
        res.status(500).json({ error: 'Failed to fetch admin settings' });
    }
});

// Update admin settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            atsScorePrice,
            resumeParsePrice,
            defaultTrialDays,
            activeOffers,
            maintenanceMode,
        } = req.body;

        let settings = await prisma.adminSettings.findFirst();

        if (!settings) {
            settings = await prisma.adminSettings.create({
                data: {
                    atsScorePrice,
                    resumeParsePrice,
                    defaultTrialDays,
                    activeOffers,
                    maintenanceMode,
                },
            });
        } else {
            settings = await prisma.adminSettings.update({
                where: { id: settings.id },
                data: {
                    atsScorePrice,
                    resumeParsePrice,
                    defaultTrialDays,
                    activeOffers,
                    maintenanceMode,
                },
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error updating admin settings:', error);
        res.status(500).json({ error: 'Failed to update admin settings' });
    }
});

export default router;
