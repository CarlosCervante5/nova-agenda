import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@novaagenda.com' },
    update: {},
    create: {
      email: 'admin@novaagenda.com',
      password: adminPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Created admin:', admin.email);

  // Create demo client
  const client = await prisma.client.upsert({
    where: { slug: 'demo' },
    update: { plan: 'PRO' },
    create: {
      name: 'Demo Business',
      slug: 'demo',
      email: 'demo@example.com',
      phone: '+1234567890',
      primaryColor: '#2563eb',
      plan: 'PRO',
    },
  });
  console.log('Created client:', client.name);

  // Create client user
  const clientUserPassword = await bcrypt.hash('client123', 12);
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@demo.com' },
    update: {},
    create: {
      email: 'client@demo.com',
      password: clientUserPassword,
      name: 'Demo User',
      role: 'CLIENT',
      clientId: client.id,
    },
  });
  console.log('Created client user:', clientUser.email);

  // Create services
  const services = [
    { name: 'Haircut', duration: 30, price: 25, color: '#2563eb', clientId: client.id },
    { name: 'Beard Trim', duration: 15, price: 15, color: '#16a34a', clientId: client.id },
    { name: 'Full Styling', duration: 60, price: 50, color: '#9333ea', clientId: client.id },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.name.toLowerCase().replace(/\s/g, '-') },
      update: {},
      create: service,
    });
  }
  console.log('Created services');

  // Create working hours (Mon-Fri 9-18, Sat 9-14)
  for (let day = 0; day < 7; day++) {
    const isOpen = day >= 1 && day <= 6; // Mon-Sat
    const closeTime = day === 6 ? '14:00' : '18:00'; // Saturday closes early

    await prisma.workingHours.upsert({
      where: { clientId_dayOfWeek: { clientId: client.id, dayOfWeek: day } },
      update: {},
      create: {
        clientId: client.id,
        dayOfWeek: day,
        openTime: '09:00',
        closeTime,
        isOpen,
      },
    });
  }
  console.log('Created working hours');

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
