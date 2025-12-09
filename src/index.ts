import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

import { prisma } from './lib/prisma';

const app = express();

console.log('Backend initializing...');

// Verify DB connection without crashing the main thread synchronously
prisma.$connect()
    .then(() => console.log('Prisma client connected successfully'))
    .catch((error) => console.error('Failed to connect to DB:', error));
const PORT = 3001;

const corsOptions = {
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:3000',
        'https://port-cv-frontend.vercel.app', // Explicitly add production URL just in case
        'https://port-cv-backend.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes (Standard Express 4)

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root route handler for health checks and verification
app.get('/', (req, res) => {
    res.status(200).send('PortCV Backend API is running successfully.');
});

// Basic health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Routes
import authRoutes from './routes/auth';
import resumeRoutes from './routes/resumes';
import portfolioRoutes from './routes/portfolios';
import aiRoutes from './routes/ai';
import paymentRoutes from './routes/payment';
import analyticsRoutes from './routes/analytics';
import subscriptionRoutes from './routes/subscriptions';
import adminPricingRoutes from './routes/admin/pricing';
import adminUsersRoutes from './routes/admin/users';
import adminSystemRoutes from './routes/admin/system';
import adminAuthRoutes from './routes/admin/auth';
import adminProjectsRoutes from './routes/admin/projects';
import adminDatabaseRoutes from './routes/admin/database';

app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin/pricing', adminPricingRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/system', adminSystemRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/projects', adminProjectsRoutes);
app.use('/api/admin/database', adminDatabaseRoutes);

// Export app for Vercel
export default app;

// Only listen on port if not in production (Vercel handles binding)
if (process.env.NODE_ENV !== 'production') {
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    server.on('error', (e) => {
        console.error('Server error:', e);
    });
}

// Keep process alive hack (only for dev/long-running)
if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
        // console.log('Heartbeat');
    }, 1000);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});