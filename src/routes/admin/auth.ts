import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Generate admin token
        const token = jwt.sign(
            { role: 'admin', userId: 'admin' }, // Dummy userId for compatibility
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
