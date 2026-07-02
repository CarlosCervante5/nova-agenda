import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function awardLoyaltyStampForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { loyaltyStamp: true },
  });

  if (!booking || booking.status !== 'COMPLETED' || booking.loyaltyStamp) {
    return null;
  }

  const program = await prisma.loyaltyProgram.findUnique({
    where: { clientId: booking.clientId },
  });

  if (!program?.isActive) {
    return null;
  }

  let card = null;

  if (booking.customerPhone) {
    card = await prisma.loyaltyCard.findUnique({
      where: {
        programId_customerPhone: {
          programId: program.id,
          customerPhone: booking.customerPhone,
        },
      },
    });
  } else if (booking.customerEmail) {
    card = await prisma.loyaltyCard.findUnique({
      where: {
        programId_customerEmail: {
          programId: program.id,
          customerEmail: booking.customerEmail,
        },
      },
    });
  }

  if (!card) {
    card = await prisma.loyaltyCard.create({
      data: {
        programId: program.id,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
      },
    });
  }

  const newStampsEarned = card.stampsEarned + 1;
  const isCompleted = newStampsEarned >= program.stampsToReward && !card.isCompleted;

  const [stamp] = await prisma.$transaction([
    prisma.loyaltyStamp.create({
      data: {
        cardId: card.id,
        bookingId: booking.id,
        serviceId: booking.serviceId,
      },
    }),
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        stampsEarned: { increment: 1 },
        lastVisitAt: new Date(),
        ...(isCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
      },
    }),
  ]);

  return stamp;
}
