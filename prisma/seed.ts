import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create Admin Settings
    const adminSettings = await prisma.adminSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            atsScorePrice: 0.10,
            resumeParsePrice: 0.05,
            defaultTrialDays: 7,
            activeOffers: [],
            maintenanceMode: false,
        },
    });
    console.log('✅ Admin settings created');

    // Create Pricing Plans
    const freePlan = await prisma.pricingPlan.upsert({
        where: { name: 'free' },
        update: {},
        create: {
            name: 'free',
            displayName: 'Free',
            description: 'Perfect for getting started',
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'USD',
            features: {
                customColors: false,
                customBackground: false,
                animations: false,
                customFonts: false,
                analytics: false,
                customDomain: false,
                prioritySupport: false,
            },
            aiCreditsPerMonth: 5,
            portfoliosLimit: 1,
            resumesLimit: 1,
            isActive: true,
            sortOrder: 1,
        },
    });

    const proPlan = await prisma.pricingPlan.upsert({
        where: { name: 'pro' },
        update: {},
        create: {
            name: 'pro',
            displayName: 'Professional',
            description: 'For serious job seekers',
            monthlyPrice: 9.99,
            yearlyPrice: 99.99, // ~17% discount
            currency: 'USD',
            features: {
                customColors: true,
                customBackground: true,
                animations: true,
                customFonts: true,
                analytics: true,
                customDomain: false,
                prioritySupport: false,
            },
            aiCreditsPerMonth: 50,
            portfoliosLimit: 10,
            resumesLimit: 10,
            isActive: true,
            sortOrder: 2,
        },
    });

    const enterprisePlan = await prisma.pricingPlan.upsert({
        where: { name: 'enterprise' },
        update: {},
        create: {
            name: 'enterprise',
            displayName: 'Enterprise',
            description: 'For professionals and agencies',
            monthlyPrice: 29.99,
            yearlyPrice: 299.99, // ~17% discount
            currency: 'USD',
            features: {
                customColors: true,
                customBackground: true,
                animations: true,
                customFonts: true,
                analytics: true,
                customDomain: true,
                prioritySupport: true,
                whiteLabel: true,
            },
            aiCreditsPerMonth: 999999, // Unlimited
            portfoliosLimit: 999999, // Unlimited
            resumesLimit: 999999, // Unlimited
            isActive: true,
            sortOrder: 3,
        },
    });

    console.log('✅ Pricing plans created:');
    console.log(`   - ${freePlan.displayName}: $${freePlan.monthlyPrice}/mo`);
    console.log(`   - ${proPlan.displayName}: $${proPlan.monthlyPrice}/mo`);
    console.log(`   - ${enterprisePlan.displayName}: $${enterprisePlan.monthlyPrice}/mo`);

    console.log('\n🎉 Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
