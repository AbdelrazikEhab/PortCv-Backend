import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Basic health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

server.on('error', (e) => {
    console.error('Server error:', e);
});

// Keep process alive hack
setInterval(() => {
    // console.log('Heartbeat');
}, 1000);

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