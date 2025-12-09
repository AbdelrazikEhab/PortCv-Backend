import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Signup
router.post('/signup', async (req, res) => {
    console.log('Signup attempt received for:', req.body.email);
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password) {
            console.log('Signup failed: Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            console.log('Signup failed: User already exists', email);
            return res.status(400).json({ error: 'User already exists' });
        }

        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('Creating user in DB...');
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
            },
        });
        console.log('User created:', user.id);

        console.log('Creating portfolio...');
        await prisma.portfolio.create({
            data: { userId: user.id }
        });

        console.log('Creating subscription...');
        await prisma.subscription.create({
            data: { userId: user.id }
        });

        console.log('Generating token...');
        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET as string, {
            expiresIn: '24h',
        });

        console.log('Signup successful for:', email);
        res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
    } catch (error) {
        console.error('Signup error details:', error);
        res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'No user with that email' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET as string, {
            expiresIn: '24h',
        });

        res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Current User
router.get('/me', authenticateToken, async (req: any, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                title: true,
                location: true,
                phone: true,
                github: true,
                linkedin: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
