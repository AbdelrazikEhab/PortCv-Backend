import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// const prisma = new PrismaClient(); // Removed

// Middleware to check if user has access to a specific feature
export const requireFeature = (featureName: string) => {
    return async (req: any, res: Response, next: NextFunction) => {
        try {
            const subscription = await prisma.subscription.findUnique({
                where: { userId: req.user.userId },
            });

            if (!subscription) {
                return res.status(403).json({
                    error: 'No subscription found',
                    feature: featureName,
                    upgradeRequired: true,
                });
            }

            // Get the pricing plan to check features
            const plan = await prisma.pricingPlan.findUnique({
                where: { name: subscription.plan },
            });

            if (!plan) {
                return res.status(500).json({ error: 'Pricing plan not found' });
            }

            // Check if feature is enabled in the plan
            const features = plan.features as any;
            if (!features[featureName]) {
                return res.status(403).json({
                    error: `Feature '${featureName}' not available in your plan`,
                    feature: featureName,
                    currentPlan: subscription.plan,
                    upgradeRequired: true,
                });
            }

            next();
        } catch (error) {
            console.error('Feature gate error:', error);
            res.status(500).json({ error: 'Failed to verify feature access' });
        }
    };
};

// Middleware to check and deduct AI credits
export const requireAICredits = (creditsNeeded: number = 1) => {
    return async (req: any, res: Response, next: NextFunction) => {
        try {
            const subscription = await prisma.subscription.findUnique({
                where: { userId: req.user.userId },
            });

            if (!subscription) {
                // Create free subscription if doesn't exist
                const newSub = await prisma.subscription.create({
                    data: {
                        userId: req.user.userId,
                        plan: 'free',
                        status: 'active',
                        aiCreditsLimit: 5,
                        portfoliosLimit: 1,
                        resumesLimit: 1,
                    },
                });

                if (newSub.aiCreditsUsed + creditsNeeded > newSub.aiCreditsLimit) {
                    return res.status(402).json({
                        error: 'AI credits exhausted',
                        used: newSub.aiCreditsUsed,
                        limit: newSub.aiCreditsLimit,
                        upgradeRequired: true,
                    });
                }

                // Deduct credits
                await prisma.subscription.update({
                    where: { id: newSub.id },
                    data: { aiCreditsUsed: newSub.aiCreditsUsed + creditsNeeded },
                });

                return next();
            }

            // Check if user has enough credits
            if (subscription.aiCreditsUsed + creditsNeeded > subscription.aiCreditsLimit) {
                return res.status(402).json({
                    error: 'AI credits exhausted',
                    used: subscription.aiCreditsUsed,
                    limit: subscription.aiCreditsLimit,
                    upgradeRequired: true,
                });
            }

            // Deduct credits
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { aiCreditsUsed: subscription.aiCreditsUsed + creditsNeeded },
            });

            next();
        } catch (error) {
            console.error('AI credits check error:', error);
            res.status(500).json({ error: 'Failed to verify AI credits' });
        }
    };
};

// Middleware to check resource limits (portfolios/resumes)
export const checkResourceLimit = (resourceType: 'portfolios' | 'resumes') => {
    return async (req: any, res: Response, next: NextFunction) => {
        try {
            let subscription = await prisma.subscription.findUnique({
                where: { userId: req.user.userId },
            });

            // If no subscription exists, create a free one and allow the first resource
            if (!subscription) {
                subscription = await prisma.subscription.create({
                    data: {
                        userId: req.user.userId,
                        plan: 'free',
                        status: 'active',
                        aiCreditsLimit: 5,
                        portfoliosLimit: 1,
                        resumesLimit: 1,
                        // Start with 0 usage, will be incremented below
                        portfoliosUsed: 0,
                        resumesUsed: 0,
                        aiCreditsUsed: 0,
                    },
                });
            }

            const usedField = resourceType === 'portfolios' ? 'portfoliosUsed' : 'resumesUsed';
            const limitField = resourceType === 'portfolios' ? 'portfoliosLimit' : 'resumesLimit';

            if (subscription[usedField] >= subscription[limitField]) {
                return res.status(402).json({
                    error: `${resourceType} limit reached`,
                    used: subscription[usedField],
                    limit: subscription[limitField],
                    upgradeRequired: true,
                });
            }

            // Increment usage count
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { [usedField]: subscription[usedField] + 1 },
            });

            next();
        } catch (error) {
            console.error('Resource limit check error:', error);
            res.status(500).json({ error: 'Failed to verify resource limit' });
        }
    };
};

// Helper function to check feature access (for use in route handlers)
export async function hasFeatureAccess(userId: string, featureName: string): Promise<boolean> {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) return false;

        const plan = await prisma.pricingPlan.findUnique({
            where: { name: subscription.plan },
        });

        if (!plan) return false;

        const features = plan.features as any;
        return !!features[featureName];
    } catch (error) {
        console.error('Feature access check error:', error);
        return false;
    }
}
