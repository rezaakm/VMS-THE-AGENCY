import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // Create sample vendors
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

  const vendor2 = await prisma.vendor.upsert({
    where: { code: 'VEN000002' },
    update: {},
    create: {
      code: 'VEN000002',
      name: 'TechSolutions Inc',
      email: 'info@techsolutions.com',
      phone: '+1-555-0200',
      website: 'https://techsolutions.com',
      taxId: '98-7654321',
      status: 'ACTIVE',
      address: '456 Innovation Ave',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      postalCode: '94102',
      industry: 'Technology',
      category: 'Software Development',
      description: 'Custom software development and consulting',
      registrationDate: new Date('2019-06-01'),
      paymentTerms: 'Net 45',
      creditLimit: 75000,
      currency: 'USD',
      performanceScore: 4.2,
      totalOrders: 18,
      totalSpent: 180000,
      contacts: {
        create: [
          {
            firstName: 'Mike',
            lastName: 'Johnson',
            email: 'mike.johnson@techsolutions.com',
            phone: '+1-555-0201',
            position: 'Sales Director',
            isPrimary: true,
          },
        ],
      },
    },
  });

  console.log('✅ Created vendor:', vendor2.name);

  const vendor3 = await prisma.vendor.upsert({
    where: { code: 'VEN000003' },
    update: {},
    create: {
      code: 'VEN000003',
      name: 'Global Supplies Ltd',
      email: 'sales@globalsupplies.com',
      phone: '+1-555-0300',
      status: 'PENDING',
      address: '789 Supply Chain Blvd',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postalCode: '60601',
      industry: 'Manufacturing',
      category: 'Office Supplies',
      description: 'Wholesale office supplies and equipment',
      paymentTerms: 'Net 30',
      creditLimit: 50000,
      currency: 'USD',
      performanceScore: 0,
      totalOrders: 0,
      totalSpent: 0,
    },
  });

  console.log('✅ Created vendor:', vendor3.name);

  // Create sample purchase orders
  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: `PO${new Date().getFullYear()}000001`,
      vendorId: vendor1.id,
      userId: buyer.id,
      status: 'COMPLETED',
      orderDate: new Date('2024-01-15'),
      requiredDate: new Date('2024-02-01'),
      deliveryDate: new Date('2024-01-28'),
      subtotal: 4500.00,
      taxAmount: 382.50,
      shippingCost: 150.00,
      totalAmount: 5032.50,
      description: 'Laptop computers for office upgrade',
      items: {
        create: [
          {
            itemNumber: 'LAP-001',
            description: 'Dell Latitude 5420 Laptop',
            quantity: 10,
            unitPrice: 450.00,
            discount: 0,
            taxRate: 8.5,
            totalPrice: 4500.00,
          },
        ],
      },
    },
  });

  console.log('✅ Created purchase order:', po1.orderNumber);

  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: `PO${new Date().getFullYear()}000002`,
      vendorId: vendor2.id,
      userId: buyer.id,
      status: 'APPROVED',
      orderDate: new Date('2024-02-01'),
      requiredDate: new Date('2024-03-01'),
      subtotal: 12000.00,
      taxAmount: 960.00,
      shippingCost: 0,
      totalAmount: 12960.00,
      description: 'Custom software development project',
      items: {
        create: [
          {
            itemNumber: 'DEV-001',
            description: 'Custom Web Application Development',
            quantity: 1,
            unitPrice: 10000.00,
            discount: 0,
            taxRate: 8.0,
            totalPrice: 10800.00,
          },
          {
            itemNumber: 'DEV-002',
            description: 'API Integration Services',
            quantity: 1,
            unitPrice: 2000.00,
            discount: 0,
            taxRate: 8.0,
            totalPrice: 2160.00,
          },
        ],
      },
    },
  });

  console.log('✅ Created purchase order:', po2.orderNumber);

  // Create sample contracts
  const contract1 = await prisma.contract.create({
    data: {
      contractNumber: `CNT${new Date().getFullYear()}000001`,
      vendorId: vendor1.id,
      title: 'IT Services Master Agreement',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      signedDate: new Date('2023-12-15'),
      contractValue: 500000,
      currency: 'USD',
      terms: 'Annual IT support and maintenance contract',
      description: 'Comprehensive IT services including support, maintenance, and upgrades',
      autoRenew: true,
      renewalPeriod: 12,
    },
  });

  console.log('✅ Created contract:', contract1.contractNumber);

  const contract2 = await prisma.contract.create({
    data: {
      contractNumber: `CNT${new Date().getFullYear()}000002`,
      vendorId: vendor2.id,
      title: 'Software Development Framework Agreement',
      status: 'ACTIVE',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2025-02-28'),
      signedDate: new Date('2024-02-15'),
      contractValue: 300000,
      currency: 'USD',
      terms: 'Ongoing software development and consulting services',
      description: 'Dedicated development team and consulting services',
      autoRenew: false,
    },
  });

  console.log('✅ Created contract:', contract2.contractNumber);

  // Create sample evaluations
  const evaluation1 = await prisma.evaluation.create({
    data: {
      vendorId: vendor1.id,
      evaluatorId: buyer.id,
      qualityScore: 4.5,
      deliveryScore: 4.8,
      pricingScore: 4.2,
      serviceScore: 4.7,
      overallScore: 4.55,
      comments: 'Excellent service quality and on-time delivery. Pricing is competitive.',
      period: 'Q1 2024',
      evaluationDate: new Date('2024-04-01'),
    },
  });

  console.log('✅ Created evaluation for:', vendor1.name);

  const evaluation2 = await prisma.evaluation.create({
    data: {
      vendorId: vendor2.id,
      evaluatorId: buyer.id,
      qualityScore: 4.3,
      deliveryScore: 4.5,
      pricingScore: 3.8,
      serviceScore: 4.4,
      overallScore: 4.25,
      comments: 'Good quality work, sometimes pricing could be more competitive.',
      period: 'Q1 2024',
      evaluationDate: new Date('2024-04-01'),
    },
  });

  console.log('✅ Created evaluation for:', vendor2.name);

  // Create sample invoice
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2024-001',
      vendorId: vendor1.id,
      poId: po1.id,
      invoiceDate: new Date('2024-01-30'),
      dueDate: new Date('2024-02-29'),
      amount: 4650.00,
      taxAmount: 382.50,
      totalAmount: 5032.50,
      paidAmount: 5032.50,
      status: 'PAID',
      paidDate: new Date('2024-02-15'),
      description: 'Payment for laptop order PO2024000001',
    },
  });

  console.log('✅ Created invoice:', invoice1.invoiceNumber);

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

