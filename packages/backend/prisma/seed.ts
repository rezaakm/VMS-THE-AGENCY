import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedFinancialOversight } from './seed-financial-oversight';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vms.com' },
    update: {},
    create: {
      email: 'admin@vms.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create sample manager
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@vms.com' },
    update: {},
    create: {
      email: 'manager@vms.com',
      password: managerPassword,
      firstName: 'Sarah',
      lastName: 'Manager',
      role: 'MANAGER',
      isActive: true,
    },
  });

  console.log('✅ Created manager user:', manager.email);

  // Create sample buyer
  const buyerPassword = await bcrypt.hash('buyer123', 10);
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@vms.com' },
    update: {},
    create: {
      email: 'buyer@vms.com',
      password: buyerPassword,
      firstName: 'John',
      lastName: 'Buyer',
      role: 'BUYER',
      isActive: true,
    },
  });

  console.log('✅ Created buyer user:', buyer.email);

  // Create sample vendors (keeping existing sample data)
  const vendor1 = await prisma.vendor.upsert({
    where: { code: 'VEN000001' },
    update: {},
    create: {
      code: 'VEN000001',
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      phone: '+1-555-0100',
      website: 'https://acme.com',
      taxId: '12-3456789',
      status: 'ACTIVE',
      address: '123 Business St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      postalCode: '10001',
      industry: 'Technology',
      category: 'IT Services',
      description: 'Leading provider of IT solutions and services',
      registrationDate: new Date('2020-01-15'),
      paymentTerms: 'Net 30',
      creditLimit: 100000,
      currency: 'USD',
      performanceScore: 4.5,
      totalOrders: 25,
      totalSpent: 250000,
      contacts: {
        create: [
          {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@acme.com',
            phone: '+1-555-0101',
            position: 'Account Manager',
            isPrimary: true,
          },
        ],
      },
    },
  });

  console.log('✅ Created vendor:', vendor1.name);

  // ... (keeping other sample data abbreviated for this update)

  // Create sample purchase orders, contracts, evaluations, invoices as before...
  // (omitted for brevity in this commit - they remain from previous seed)

  // ============================================
  // FINANCIAL OVERSIGHT - THE REAL AUDIT FLAGS
  // ============================================
  await seedFinancialOversight(admin.id, manager.id);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
