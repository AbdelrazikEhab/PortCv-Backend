"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Basic health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const resumes_1 = __importDefault(require("./routes/resumes"));
const portfolios_1 = __importDefault(require("./routes/portfolios"));
const ai_1 = __importDefault(require("./routes/ai"));
const payment_1 = __importDefault(require("./routes/payment"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const pricing_1 = __importDefault(require("./routes/admin/pricing"));
const users_1 = __importDefault(require("./routes/admin/users"));
const system_1 = __importDefault(require("./routes/admin/system"));
const auth_2 = __importDefault(require("./routes/admin/auth"));
app.use('/api/auth', auth_1.default);
app.use('/api/resumes', resumes_1.default);
app.use('/api/portfolios', portfolios_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/payment', payment_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/admin/pricing', pricing_1.default);
app.use('/api/admin/users', users_1.default);
app.use('/api/admin/system', system_1.default);
app.use('/api/admin/auth', auth_2.default);
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
