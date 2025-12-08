"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Get user portfolio settings
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});
// Update portfolio settings
router.put('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { subdomain, theme, sections, font, layout, isPublished } = req.body;
        const portfolio = await prisma.portfolio.upsert({
            where: { userId: req.user.userId },
            update: {
                subdomain,
                theme,
                sections,
                font,
                layout,
                isPublished
            },
            create: {
                userId: req.user.userId,
                subdomain,
                theme,
                sections,
                font,
                layout,
                isPublished
            }
        });
        res.json(portfolio);
    }
    catch (error) {
        // Handle unique constraint violation for subdomain
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Subdomain already taken' });
        }
        res.status(500).json({ error: 'Failed to update portfolio' });
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch public portfolio' });
    }
});
// Get public portfolio by username (alternative)
router.get('/user/:username', async (req, res) => {
    // Implementation depends on if we add username to User model or use email
    // For now, let's assume we might need to look up by user ID or add username field
    res.status(501).json({ error: 'Not implemented yet' });
});
exports.default = router;
