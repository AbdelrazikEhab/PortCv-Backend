import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Admin authentication middleware (reused)
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

// Get system settings
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get the first settings record or create default
        let settings = await prisma.adminSettings.findFirst();

        if (!settings) {
            settings = await prisma.adminSettings.create({
                data: {
                    maintenanceMode: false,
                    atsScorePrice: 0.10,
                    resumeParsePrice: 0.05,
                    defaultTrialDays: 7,
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({ error: 'Failed to fetch system settings' });
    }
});

// Update system settings
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { maintenanceMode, atsScorePrice, resumeParsePrice, defaultTrialDays } = req.body;

        let settings = await prisma.adminSettings.findFirst();

        if (!settings) {
            settings = await prisma.adminSettings.create({
                data: {
                    maintenanceMode: maintenanceMode || false,
                    atsScorePrice: atsScorePrice || 0.10,
                    resumeParsePrice: resumeParsePrice || 0.05,
                    defaultTrialDays: defaultTrialDays || 7,
                }
            });
        } else {
            settings = await prisma.adminSettings.update({
                where: { id: settings.id },
                data: {
                    maintenanceMode,
                    atsScorePrice,
                    resumeParsePrice,
                    defaultTrialDays,
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ error: 'Failed to update system settings' });
    }
});

export default router;
