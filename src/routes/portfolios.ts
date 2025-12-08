import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Get user portfolio settings
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const portfolio = await prisma.portfolio.findUnique({
            where: { userId: req.user.userId }
        });

        if (!portfolio) {
            // Create default if not exists
            const newPortfolio = await prisma.portfolio.create({
                data: { userId: req.user.userId }
            });
            return res.json(newPortfolio);
        }

        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

// Update portfolio settings
router.put('/', authenticateToken, async (req: any, res) => {
    try {
        const { subdomain, theme, sections, font, layout, profileImage, customLogo, isPublished } = req.body;

        // @ts-ignore - profileImage and customLogo exist in schema, regenerate Prisma client to fix types
        const portfolio = await prisma.portfolio.upsert({
            where: { userId: req.user.userId },
            update: {
                subdomain,
                theme,
                sections,
                font,
                layout,
                profileImage,
                customLogo,
                isPublished
            },
            create: {
                userId: req.user.userId,
                subdomain,
                theme,
                sections,
                font,
                layout,
                profileImage,
                customLogo,
                isPublished
            }
        });

        res.json(portfolio);
    } catch (error) {
        console.error('Portfolio save error:', error);
        console.error('Error details:', {
            message: (error as any).message,
            code: (error as any).code,
            meta: (error as any).meta
        });
        // Handle unique constraint violation for subdomain
        if ((error as any).code === 'P2002') {
            return res.status(400).json({ error: 'Subdomain already taken' });
        }
        res.status(500).json({
            error: 'Failed to update portfolio',
            details: (error as any).message
        });
    }
});

// Get public portfolio by subdomain
router.get('/public/:subdomain', async (req, res) => {
    try {
        const { subdomain } = req.params;
        console.log(`Fetching public portfolio for subdomain: ${subdomain}`);

        const portfolio = await prisma.portfolio.findUnique({
            where: { subdomain },
            include: {
                user: {
                    select: {
                        fullName: true,
                        title: true,
                        location: true,
                        email: true,
                        github: true,
                        linkedin: true
                    }
                }
            }
        });

        console.log('Found portfolio:', portfolio ? 'Yes' : 'No');
        if (portfolio) {
            console.log('Is Published:', portfolio.isPublished);
        }

        if (!portfolio || !portfolio.isPublished) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        // Fetch user's primary resume for data
        const resume = await prisma.resume.findFirst({
            where: { userId: portfolio.userId },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({
            portfolio,
            resume,
            user: portfolio.user
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch public portfolio' });
    }
});

// Get public portfolio by username (alternative)
router.get('/user/:username', async (req, res) => {
    // Implementation depends on if we add username to User model or use email
    // For now, let's assume we might need to look up by user ID or add username field
    res.status(501).json({ error: 'Not implemented yet' });
});

export default router;


