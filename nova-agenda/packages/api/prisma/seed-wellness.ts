import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLIENT_ID = 'cmt4k291900003h3fwxn9gt3y';
const DURATION = 50;

type HoursDay = { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean };

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Una ventana de exactamente 50 min por día → un solo horario reservable. */
function weekHours(openByDay: Partial<Record<number, string>>): HoursDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const openTime = openByDay[dayOfWeek];
    if (!openTime) return { dayOfWeek, openTime: '00:00', closeTime: '00:00', isOpen: false };
    return { dayOfWeek, openTime, closeTime: addMinutes(openTime, DURATION), isOpen: true };
  });
}

async function upsertCategory(name: string, color: string, sortOrder: number, description: string) {
  const existing = await prisma.serviceCategory.findFirst({
    where: { clientId: CLIENT_ID, name, parentId: null },
  });
  if (existing) {
    return prisma.serviceCategory.update({
      where: { id: existing.id },
      data: { color, sortOrder, description, isActive: true },
    });
  }
  return prisma.serviceCategory.create({
    data: { clientId: CLIENT_ID, name, color, sortOrder, description, isActive: true },
  });
}

async function upsertService(input: {
  name: string;
  description: string;
  price: number;
  color: string;
  categoryId: string;
  hours: HoursDay[];
}) {
  const existing = await prisma.service.findFirst({
    where: { clientId: CLIENT_ID, name: input.name },
  });

  const data = {
    name: input.name,
    description: input.description,
    duration: DURATION,
    price: input.price,
    color: input.color,
    isActive: true,
    categoryId: input.categoryId,
    useCustomHours: true,
    capacity: 8,
    kind: 'class',
  };

  const service = existing
    ? await prisma.service.update({ where: { id: existing.id }, data })
    : await prisma.service.create({ data: { ...data, clientId: CLIENT_ID } });

  await prisma.serviceWorkingHours.deleteMany({ where: { serviceId: service.id } });
  await prisma.serviceWorkingHours.createMany({
    data: input.hours.map((row) => ({ ...row, serviceId: service.id })),
  });

  return service;
}

async function upsertPlan(input: {
  name: string;
  description: string;
  price: number;
  benefits: string[];
  sortOrder: number;
  interval?: string;
  classesPerPeriod: number;
}) {
  const existing = await prisma.membershipPlan.findFirst({
    where: { clientId: CLIENT_ID, name: { equals: input.name, mode: 'insensitive' } },
  });

  const data = {
    name: input.name,
    description: input.description,
    price: input.price,
    currency: 'mxn',
    interval: input.interval || 'month',
    classesPerPeriod: input.classesPerPeriod || 0,
    benefits: JSON.stringify(input.benefits),
    isActive: true,
    sortOrder: input.sortOrder,
  };

  if (existing) {
    return prisma.membershipPlan.update({ where: { id: existing.id }, data });
  }
  return prisma.membershipPlan.create({ data: { ...data, clientId: CLIENT_ID } });
}

async function main() {
  const client = await prisma.client.findUnique({ where: { id: CLIENT_ID } });
  if (!client) throw new Error('No se encontró Wellness Club');

  await prisma.client.update({
    where: { id: CLIENT_ID },
    data: {
      tagline: 'Pilates · Barre · Sculpt · Yoga',
      about:
        'Estudio de bienestar con clases de Pilates, Barre, Sculpt y Yoga. Morning Club, After Work y Weekend Wellness. También Protein Bar.',
      bookingIntroText:
        'Elige el día, reserva tu clase y confirma el lugar con membresía, clase suelta o pago en recepción.',
      studioBooking: true,
      slotGapMinutes: 10,
      headlineColor: '#3d5c59',
      bodyTextColor: '#4a4038',
      labelTextColor: '#7a6e64',
      surfaceBgColor: '#f7f1ea',
    },
  });

  const studioHours = [
    { dayOfWeek: 1, openTime: '07:00', closeTime: '19:50', isOpen: true },
    { dayOfWeek: 2, openTime: '07:00', closeTime: '19:50', isOpen: true },
    { dayOfWeek: 3, openTime: '07:00', closeTime: '19:50', isOpen: true },
    { dayOfWeek: 4, openTime: '07:00', closeTime: '19:50', isOpen: true },
    { dayOfWeek: 5, openTime: '07:00', closeTime: '19:50', isOpen: true },
    { dayOfWeek: 6, openTime: '07:00', closeTime: '10:50', isOpen: true },
    { dayOfWeek: 0, openTime: '08:00', closeTime: '10:50', isOpen: true },
  ];

  for (const row of studioHours) {
    await prisma.workingHours.upsert({
      where: { clientId_dayOfWeek: { clientId: CLIENT_ID, dayOfWeek: row.dayOfWeek } },
      update: { openTime: row.openTime, closeTime: row.closeTime, isOpen: row.isOpen },
      create: { clientId: CLIENT_ID, ...row },
    });
  }

  const catClases = await upsertCategory('Clases', '#5B8A86', 1, 'Pilates, Barre, Sculpt y Yoga');
  const catAfter = await upsertCategory('After Work', '#3D5C59', 2, 'Clases de 17:00 a 19:50');
  const catBeginner = await upsertCategory('Principiantes', '#C5D64A', 3, 'Sesiones marcadas para principiantes');
  const catAccess = await upsertCategory('Acceso individual', '#C4A484', 4, 'Clase de prueba y clase suelta');

  const pilates = '#5B8A86';
  const barre = '#C4A484';
  const sculpt = '#3D5C59';
  const yoga = '#D4B896';
  const beginner = '#C5D64A';
  const trial = '#B8C94A';

  const sueltaNote = 'Precio de clase suelta. Con membresía se toma del paquete.';

  await upsertService({
    name: 'Pilates',
    description: `Morning Club y sábado 7:00. ${sueltaNote}`,
    price: 140,
    color: pilates,
    categoryId: catClases.id,
    hours: weekHours({ 3: '09:00', 4: '07:00', 6: '07:00' }),
  });
  await upsertService({
    name: 'Barre',
    description: `Morning Club y fin de semana 8:00. ${sueltaNote}`,
    price: 140,
    color: barre,
    categoryId: catClases.id,
    hours: weekHours({ 1: '08:00', 2: '07:00', 3: '08:00', 5: '07:00', 6: '08:00', 0: '08:00' }),
  });
  await upsertService({
    name: 'Sculpt',
    description: `Morning Club y fin de semana 9:00. ${sueltaNote}`,
    price: 140,
    color: sculpt,
    categoryId: catClases.id,
    hours: weekHours({ 1: '09:00', 3: '07:00', 5: '08:00', 6: '09:00', 0: '09:00' }),
  });
  await upsertService({
    name: 'Yoga',
    description: `Morning Club mar/jue 9:00 y fin de semana 10:00. ${sueltaNote}`,
    price: 140,
    color: yoga,
    categoryId: catClases.id,
    hours: weekHours({ 2: '09:00', 4: '09:00', 6: '10:00', 0: '10:00' }),
  });
  await upsertService({
    name: 'Pilates 8:00',
    description: `Jueves 8:00 · Morning Club. ${sueltaNote}`,
    price: 140,
    color: pilates,
    categoryId: catClases.id,
    hours: weekHours({ 4: '08:00' }),
  });
  await upsertService({
    name: 'Barre 9:00',
    description: `Viernes 9:00 · Morning Club. ${sueltaNote}`,
    price: 140,
    color: barre,
    categoryId: catClases.id,
    hours: weekHours({ 5: '09:00' }),
  });

  await upsertService({
    name: 'Pilates After Work',
    description: `Miércoles 19:00 y jueves 18:00. ${sueltaNote}`,
    price: 140,
    color: pilates,
    categoryId: catAfter.id,
    hours: weekHours({ 3: '19:00', 4: '18:00' }),
  });
  await upsertService({
    name: 'Barre After Work',
    description: `Mar 17:00, mié/vie 18:00 y jue 19:00. ${sueltaNote}`,
    price: 140,
    color: barre,
    categoryId: catAfter.id,
    hours: weekHours({ 2: '17:00', 3: '18:00', 4: '19:00', 5: '18:00' }),
  });
  await upsertService({
    name: 'Barre 19:00',
    description: `Martes 19:00 · After Work. ${sueltaNote}`,
    price: 140,
    color: barre,
    categoryId: catAfter.id,
    hours: weekHours({ 2: '19:00' }),
  });
  await upsertService({
    name: 'Sculpt After Work',
    description: `Lun 19:00, mar 18:00, jue 17:00 y vie 19:00. ${sueltaNote}`,
    price: 140,
    color: sculpt,
    categoryId: catAfter.id,
    hours: weekHours({ 1: '19:00', 2: '18:00', 4: '17:00', 5: '19:00' }),
  });
  await upsertService({
    name: 'Yoga After Work',
    description: `Lunes y viernes 17:00. ${sueltaNote}`,
    price: 140,
    color: yoga,
    categoryId: catAfter.id,
    hours: weekHours({ 1: '17:00', 5: '17:00' }),
  });

  await upsertService({
    name: 'Pilates principiantes',
    description: 'Lunes 7:00 · Morning Club. Ideal para tu primera vez.',
    price: 140,
    color: beginner,
    categoryId: catBeginner.id,
    hours: weekHours({ 1: '07:00' }),
  });
  await upsertService({
    name: 'Sculpt principiantes',
    description: 'Martes 8:00 · Morning Club.',
    price: 140,
    color: beginner,
    categoryId: catBeginner.id,
    hours: weekHours({ 2: '08:00' }),
  });
  await upsertService({
    name: 'Barre principiantes',
    description: 'Lunes 18:00 · After Work.',
    price: 140,
    color: beginner,
    categoryId: catBeginner.id,
    hours: weekHours({ 1: '18:00' }),
  });
  await upsertService({
    name: 'Yoga principiantes',
    description: 'Miércoles 17:00 · After Work.',
    price: 140,
    color: beginner,
    categoryId: catBeginner.id,
    hours: weekHours({ 3: '17:00' }),
  });

  await upsertService({
    name: 'Clase de prueba',
    description: 'Primera visita, 50 min. Indica en notas a qué clase quieres entrar (Pilates, Barre, Sculpt o Yoga).',
    price: 90,
    color: trial,
    categoryId: catAccess.id,
    hours: weekHours({ 1: '07:00', 2: '07:00', 3: '07:00', 4: '07:00', 5: '07:00', 6: '07:00', 0: '08:00' }),
  });
  await upsertService({
    name: 'Clase de prueba After Work',
    description: 'Primera visita en horario vespertino. Indica en notas la clase a la que quieres entrar.',
    price: 90,
    color: trial,
    categoryId: catAccess.id,
    hours: weekHours({ 1: '17:00', 2: '17:00', 3: '17:00', 4: '17:00', 5: '17:00' }),
  });
  await upsertService({
    name: 'Clase suelta',
    description: 'Drop-in de 50 min sin membresía. Indica en notas la clase (Pilates, Barre, Sculpt o Yoga).',
    price: 140,
    color: '#A89070',
    categoryId: catAccess.id,
    hours: weekHours({ 1: '07:00', 2: '07:00', 3: '07:00', 4: '07:00', 5: '07:00', 6: '07:00', 0: '08:00' }),
  });

  await upsertPlan({
    name: 'START',
    description: '4 clases al mes',
    price: 500,
    sortOrder: 1,
    classesPerPeriod: 4,
    benefits: ['4 clases', '1 bebida estándar de cortesía'],
  });
  await upsertPlan({
    name: 'ELITE',
    description: '8 clases al mes',
    price: 960,
    sortOrder: 2,
    classesPerPeriod: 8,
    benefits: ['8 clases', '1 par de calcetines antiderrapantes'],
  });
  await upsertPlan({
    name: 'PREMIUM',
    description: '12 clases al mes',
    price: 1380,
    sortOrder: 3,
    classesPerPeriod: 12,
    benefits: ['12 clases', '1 par de calcetines antiderrapantes', '1 toalla'],
  });
  await upsertPlan({
    name: 'PREMIUM +',
    description: '16 clases al mes',
    price: 1760,
    sortOrder: 4,
    classesPerPeriod: 16,
    benefits: [
      '16 clases',
      '1 par de calcetines antiderrapantes',
      '1 toalla',
      '10% de descuento en bebidas',
    ],
  });
  await upsertPlan({
    name: 'UNLIMITED',
    description: '30 clases al mes',
    price: 3200,
    sortOrder: 5,
    classesPerPeriod: 30,
    benefits: [
      '30 clases',
      '1 par de calcetines antiderrapantes',
      '1 toalla',
      '15% de descuento en bebidas',
    ],
  });

  await prisma.membershipPlan.updateMany({
    where: { clientId: CLIENT_ID, name: { equals: 'Clase de Prueba', mode: 'insensitive' } },
    data: { isActive: false },
  });

  await prisma.service.updateMany({
    where: {
      clientId: CLIENT_ID,
      name: { in: ['Clase de prueba', 'Clase de prueba After Work', 'Clase suelta'] },
    },
    data: { isActive: false, kind: 'access' },
  });

  await prisma.classPromo.upsert({
    where: { clientId_code: { clientId: CLIENT_ID, code: 'PRUEBA' } },
    update: { price: 90, maxUsesPerCustomer: 1, isActive: true },
    create: { clientId: CLIENT_ID, code: 'PRUEBA', price: 90, maxUsesPerCustomer: 1, isActive: true },
  });

  const summary = await prisma.service.findMany({
    where: { clientId: CLIENT_ID, isActive: true },
    select: { name: true, price: true, duration: true, useCustomHours: true },
    orderBy: { name: 'asc' },
  });
  const plans = await prisma.membershipPlan.findMany({
    where: { clientId: CLIENT_ID, isActive: true },
    select: { name: true, price: true, description: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  const hours = await prisma.workingHours.findMany({
    where: { clientId: CLIENT_ID },
    orderBy: { dayOfWeek: 'asc' },
  });

  console.log(JSON.stringify({ services: summary, plans, hours }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
