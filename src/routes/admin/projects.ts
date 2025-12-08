import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../middleware/authMiddleware';

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

// Get all projects (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // For now, we'll return user portfolios as "projects"
        // In the future, you can add a separate projects table
        const portfolios = await prisma.portfolio.findMany({
            include: {
                user: {
                    select: {
                        email: true,
                        fullName: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform portfolios to match project interface
        const projects = portfolios.map(portfolio => ({
            id: portfolio.id,
            name: portfolio.subdomain || 'Unnamed Portfolio',
            url: portfolio.subdomain ? `https://${portfolio.subdomain}.portcv.com` : undefined,
            userId: portfolio.userId,
            user: portfolio.user,
            createdAt: portfolio.createdAt,
        }));

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Delete a project (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Delete the portfolio
        await prisma.portfolio.delete({
            where: { id }
        });

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

export default router;
