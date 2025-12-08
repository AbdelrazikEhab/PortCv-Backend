import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Admin authentication middleware
const requireAdmin = async (req: any, res: express.Response, next: express.NextFunction) => {
    try {
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

// Get database statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users, resumes, portfolios, transactions] = await Promise.all([
            prisma.user.count(),
            prisma.resume.count(),
            prisma.portfolio.count(),
            prisma.transaction.count(),
        ]);

        res.json({
            users,
            resumes,
            portfolios,
            transactions,
        });
    } catch (error) {
        console.error('Error fetching database stats:', error);
        res.status(500).json({ error: 'Failed to fetch database statistics' });
    }
});

// Export database data
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users, resumes, portfolios, subscriptions, transactions] = await Promise.all([
            prisma.user.findMany(),
            prisma.resume.findMany(),
            prisma.portfolio.findMany(),
            prisma.subscription.findMany(),
            prisma.transaction.findMany(),
        ]);

        res.json({
            exportDate: new Date().toISOString(),
            data: {
                users,
                resumes,
                portfolios,
                subscriptions,
                transactions,
            }
        });
    } catch (error) {
        console.error('Error exporting database:', error);
        res.status(500).json({ error: 'Failed to export database' });
    }
});

// Clear specific data type
router.delete('/clear/:type', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;

        switch (type) {
            case 'resumes':
                await prisma.resume.deleteMany({});
                break;
            case 'portfolios':
                await prisma.portfolio.deleteMany({});
                break;
            case 'transactions':
                await prisma.transaction.deleteMany({});
                break;
            case 'all':
                // Delete all data except users and subscriptions
                await prisma.transaction.deleteMany({});
                await prisma.giftedAccess.deleteMany({});
                await prisma.analytics.deleteMany({});
                await prisma.portfolio.deleteMany({});
                await prisma.resume.deleteMany({});
                break;
            default:
                return res.status(400).json({ error: 'Invalid data type' });
        }

        res.json({ message: `${type} data cleared successfully` });
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

export default router;
