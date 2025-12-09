import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';

const router = express.Router();
// const prisma = new PrismaClient(); // Removed

router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const analytics = await prisma.analytics.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'asc' }
        });

        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;
