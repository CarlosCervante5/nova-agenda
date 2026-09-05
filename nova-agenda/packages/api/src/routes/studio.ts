import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { assertCanCreateBooking, sendPlanLimitError } from '../middleware/plan-limits';
import { getClientStripeClient, getClientStripeConfig, formatStripeError } from '../services/stripe-config';
import { bookingStorageDate, parseDateOnly } from '../utils/date-only';
import { resolveHoursForDay } from '../lib/working-hours';
import { whatsappService } from '../services/whatsapp';
import {
  CANCEL_HOURS,
  DEFAULT_DROP_IN_PRICE,
  RESCHEDULE_HOURS,
  classEndTime,
  classHasRoom,
  creditsFromPurchases,
  findActivePurchases,
  findPromo,
  findStudioClient,
  formatDateStr,
  isStudioClient,
  hasUsedTrial,
  hoursUntilClass,
  listClassesForDay,
  loadStudioService,
  normalizePhone,
  pickPurchaseWithCredit,
  promoteWaitlist,
  sameCustomer,
} from '../lib/studio';

const router = Router();
const prisma = new PrismaClient();

async function notifyWhatsApp(clientId: string, phone: string | null | undefined, message: string) {
  if (!phone) return;
  const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
  if (!config?.isActive || !config.twilioAccountSid || !config.twilioAuthToken) return;
  try {
    await whatsappService.sendMessage(phone, message, {
      accountSid: config.twilioAccountSid,
      authToken: config.twilioAuthToken,
      fromNumber: config.phoneNumberId,
    });
  } catch (error) {
    console.error('[Studio] WhatsApp notify failed', error);
  }
}

async function activateClassSession(clientId: string, sessionId: string) {
  const stripe = await getClientStripeClient(clientId);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) return null;

  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.metadata?.type !== 'studio_class') return null;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, clientId },
    include: { service: { select: { name: true } } },
  });
  if (!booking) return null;
  if (booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID') return booking;

  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentMethod: 'STRIPE',
      stripeCheckoutSessionId: session.id,
      amountPaid: session.amount_total != null ? session.amount_total / 100 : booking.amountPaid,
    },
    include: { service: { select: { name: true } } },
  });
}

router.get('/:slug/day', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'Calendario de clases no disponible' });

    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'La fecha debe ser YYYY-MM-DD' });
    }

    const classes = await listClassesForDay(client.id, date);
    res.json({ date, classes, dropInPrice: DEFAULT_DROP_IN_PRICE });
  } catch (error) {
    console.error('[Studio day]', error);
    res.status(500).json({ error: 'No se pudieron cargar las clases' });
  }
});

router.get('/:slug/account', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'Sesión de alumna no disponible' });

    const email = String(req.query.email || '').trim();
    const phone = String(req.query.phone || '').trim();
    if (!email && !phone) {
      return res.status(400).json({ error: 'Indica tu teléfono o correo' });
    }

    const purchases = await findActivePurchases(prisma, client.id, email, phone);
    const credit = creditsFromPurchases(purchases);
    const trialUsed = await hasUsedTrial(prisma, client.id, email, phone);

    const bookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: bookingStorageDate(formatDateStr(new Date())) },
      },
      include: { service: { select: { name: true, color: true, duration: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 40,
    });

    const mine = bookings.filter((b) => sameCustomer(b, email, phone)).map((b) => {
      const dateStr = formatDateStr(b.date);
      const hoursLeft = hoursUntilClass(dateStr, b.startTime);
      return {
        id: b.id,
        serviceName: b.service.name,
        serviceColor: b.service.color,
        duration: b.service.duration,
        date: dateStr,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        canCancelWithCredit: hoursLeft >= CANCEL_HOURS,
        canReschedule: hoursLeft >= RESCHEDULE_HOURS,
        hoursLeft,
      };
    });

    res.json({
      ...credit,
      trialUsed,
      bookings: mine,
    });
  } catch (error) {
    console.error('[Studio account]', error);
    res.status(500).json({ error: 'No se pudo consultar la sesión' });
  }
});

router.post('/:slug/book', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'Reservas de clase no disponibles' });
    if (client.bookingFormEnabled === false) {
      return res.status(403).json({ error: 'Las reservas en línea están temporalmente desactivadas.' });
    }

    const {
      serviceId,
      date,
      startTime,
      customerName,
      customerEmail,
      customerPhone,
      method,
      promoCode,
      returnUrl,
    } = req.body as {
      serviceId?: string;
      date?: string;
      startTime?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      method?: string;
      promoCode?: string;
      returnUrl?: string;
    };

    if (!serviceId || !date || !startTime || !customerName?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Nombre, teléfono, clase, fecha y hora son obligatorios.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'La fecha no es válida' });
    }
    if (normalizePhone(customerPhone).length < 10) {
      return res.status(400).json({ error: 'El teléfono debe tener al menos 10 dígitos' });
    }

    const payMethod = String(method || '').toUpperCase();
    if (!['CREDIT', 'RECEPTION', 'STRIPE', 'TRIAL'].includes(payMethod)) {
      return res.status(400).json({ error: 'Elige cómo quieres confirmar tu lugar.' });
    }

    const service = await loadStudioService(client.id, serviceId);
    if (!service) return res.status(404).json({ error: 'Clase no disponible' });

    const { dayOfWeek } = parseDateOnly(date);
    const hours = await resolveHoursForDay(prisma, {
      clientId: client.id,
      serviceId: service.id,
      useCustomHours: service.useCustomHours,
      dayOfWeek,
    });
    if (!hours?.isOpen || hours.openTime !== startTime) {
      return res.status(400).json({ error: 'Ese horario no corresponde a esta clase.' });
    }
    if (hoursUntilClass(date, startTime) <= 0) {
      return res.status(400).json({ error: 'Esa clase ya comenzó o ya pasó.' });
    }

    const limit = await assertCanCreateBooking(client.id, client.plan, { viaPublicPortal: true });
    if (!limit.ok) return sendPlanLimitError(res, limit);

    const room = await classHasRoom(prisma, {
      clientId: client.id,
      serviceId: service.id,
      dateStr: date,
      startTime,
      capacity: service.capacity,
    });
    if (room.full) {
      return res.status(409).json({
        error: 'Esta clase ya está llena. Puedes anotarte en lista de espera.',
        waitlist: true,
      });
    }

    const name = customerName.trim();
    const email = customerEmail?.trim() || null;
    const phone = customerPhone.trim();

    if (payMethod === 'CREDIT') {
      const purchase = await pickPurchaseWithCredit(prisma, client.id, email, phone);
      if (!purchase) {
        return res.status(402).json({ error: 'No tienes créditos vigentes. Compra una membresía o paga esta clase.' });
      }

      const booking = await prisma.$transaction(async (tx) => {
        const latest = await tx.membershipPurchase.findUnique({ where: { id: purchase.id } });
        if (!latest || latest.creditsUsed >= latest.creditsTotal) {
          throw new Error('NO_CREDITS');
        }
        const still = await classHasRoom(tx, {
          clientId: client.id,
          serviceId: service.id,
          dateStr: date,
          startTime,
          capacity: service.capacity,
        });
        if (still.full) throw new Error('FULL');

        const created = await tx.booking.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            date: bookingStorageDate(date),
            startTime,
            endTime: classEndTime(startTime, service.duration),
            status: 'CONFIRMED',
            paymentStatus: 'CREDITED',
            paymentMethod: 'CREDIT',
            membershipPurchaseId: latest.id,
          },
          include: { service: { select: { name: true } } },
        });
        await tx.membershipPurchase.update({
          where: { id: latest.id },
          data: { creditsUsed: { increment: 1 } },
        });
        return created;
      }).catch((error: Error) => {
        if (error.message === 'NO_CREDITS') return 'NO_CREDITS' as const;
        if (error.message === 'FULL') return 'FULL' as const;
        throw error;
      });

      if (booking === 'NO_CREDITS') {
        return res.status(402).json({ error: 'No tienes créditos vigentes. Compra una membresía o paga esta clase.' });
      }
      if (booking === 'FULL') {
        return res.status(409).json({ error: 'Esta clase ya está llena. Puedes anotarte en lista de espera.', waitlist: true });
      }

      await notifyWhatsApp(
        client.id,
        phone,
        `¡Listo, ${name}! Tu lugar en ${booking.service.name} el ${date} a las ${startTime} está confirmado. Te esperamos en ${client.name}.`
      );
      return res.status(201).json({ booking, creditsUsed: 1 });
    }

    if (payMethod === 'RECEPTION') {
      const booking = await prisma.booking.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          date: bookingStorageDate(date),
          startTime,
          endTime: classEndTime(startTime, service.duration),
          status: 'CONFIRMED',
          paymentStatus: 'PENDING_RECEPTION',
          paymentMethod: 'RECEPTION',
          amountPaid: service.price,
        },
        include: { service: { select: { name: true } } },
      });
      await notifyWhatsApp(
        client.id,
        phone,
        `Reservamos tu lugar en ${booking.service.name} el ${date} a las ${startTime}. Recuerda pagar en recepción de ${client.name}.`
      );
      return res.status(201).json({ booking });
    }

    const isTrial = payMethod === 'TRIAL';
    let amount = Number(service.price) || DEFAULT_DROP_IN_PRICE;
    let appliedCode: string | null = null;

    if (isTrial) {
      const promo = await findPromo(prisma, client.id, promoCode);
      if (!promo) return res.status(400).json({ error: 'El código de primera visita no es válido.' });
      if (await hasUsedTrial(prisma, client.id, email, phone)) {
        return res.status(400).json({ error: 'La clase de prueba solo se puede usar una vez.' });
      }
      amount = promo.price;
      appliedCode = promo.code;
    }

    const { secretKey } = await getClientStripeConfig(client.id);
    if (!secretKey) {
      return res.status(503).json({ error: 'Este estudio aún no tiene pagos en línea configurados. Elige pagar en recepción.' });
    }

    const origin = String(returnUrl || req.headers.origin || '').replace(/\/$/, '');
    if (!origin) return res.status(400).json({ error: 'No se pudo determinar la URL de retorno.' });

    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        date: bookingStorageDate(date),
        startTime,
        endTime: classEndTime(startTime, service.duration),
        status: 'PENDING',
        paymentStatus: 'PENDING_STRIPE',
        paymentMethod: 'STRIPE',
        amountPaid: amount,
        promoCode: appliedCode,
        isTrial,
      },
    });

    const stripe = await getClientStripeClient(client.id);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: isTrial ? `Clase de prueba — ${service.name}` : `Clase suelta — ${service.name}`,
              description: `${date} ${startTime} · ${client.name}`,
            },
          },
        },
      ],
      metadata: {
        clientId: client.id,
        bookingId: booking.id,
        type: 'studio_class',
      },
      success_url: `${origin}?class=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?class=canceled`,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      return res.status(502).json({ error: 'Stripe no devolvió URL de checkout' });
    }

    res.json({ url: session.url, sessionId: session.id, bookingId: booking.id });
  } catch (error: unknown) {
    console.error('[Studio book]', error);
    res.status(500).json({ error: formatStripeError(error) });
  }
});

router.post('/:slug/confirm', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client) return res.status(404).json({ error: 'Negocio no encontrado' });
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId es obligatorio' });

    const booking = await activateClassSession(client.id, sessionId);
    if (!booking) return res.status(409).json({ error: 'El pago aún no está confirmado.' });
    res.json(booking);
  } catch (error: unknown) {
    res.status(500).json({ error: formatStripeError(error) });
  }
});

router.post('/:slug/cancel', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'No disponible' });

    const { bookingId, customerPhone, customerEmail } = req.body as {
      bookingId?: string;
      customerPhone?: string;
      customerEmail?: string;
    };
    if (!bookingId || (!customerPhone && !customerEmail)) {
      return res.status(400).json({ error: 'Indica la reserva y tu teléfono o correo.' });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId: client.id },
      include: { service: true },
    });
    if (!booking || booking.status === 'CANCELLED') {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (!sameCustomer(booking, customerEmail, customerPhone)) {
      return res.status(403).json({ error: 'Esta reserva no coincide con tus datos.' });
    }

    const dateStr = formatDateStr(booking.date);
    const hoursLeft = hoursUntilClass(dateStr, booking.startTime);
    const refundCredit = hoursLeft >= CANCEL_HOURS && booking.paymentMethod === 'CREDIT' && booking.membershipPurchaseId;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
      if (refundCredit && booking.membershipPurchaseId) {
        await tx.membershipPurchase.update({
          where: { id: booking.membershipPurchaseId },
          data: { creditsUsed: { decrement: 1 } },
        });
      }
    });

    const promoted = await promoteWaitlist({
      clientId: client.id,
      serviceId: booking.serviceId,
      dateStr,
      startTime: booking.startTime,
      capacity: booking.service.capacity > 1 ? booking.service.capacity : 8,
      duration: booking.service.duration,
    });
    if (promoted?.waitlist) {
      await notifyWhatsApp(
        client.id,
        promoted.waitlist.customerPhone,
        `¡Hay lugar! Entras automáticamente a ${booking.service.name} el ${dateStr} a las ${booking.startTime} en ${client.name}. Se usó 1 crédito de tu membresía.`
      );
    }

    res.json({
      cancelled: true,
      creditRestored: Boolean(refundCredit),
      noRefund: !refundCredit,
      message: refundCredit
        ? 'Cancelamos tu lugar y recuperaste 1 crédito.'
        : 'Cancelamos tu lugar. Con menos de 3 horas (o pago suelto) no hay devolución ni crédito.',
    });
  } catch (error) {
    console.error('[Studio cancel]', error);
    res.status(500).json({ error: 'No se pudo cancelar' });
  }
});

router.post('/:slug/reschedule', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'No disponible' });

    const { bookingId, customerPhone, customerEmail, serviceId, date, startTime } = req.body as {
      bookingId?: string;
      customerPhone?: string;
      customerEmail?: string;
      serviceId?: string;
      date?: string;
      startTime?: string;
    };
    if (!bookingId || !serviceId || !date || !startTime) {
      return res.status(400).json({ error: 'Faltan datos para cambiar el horario.' });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId: client.id },
    });
    if (!booking || booking.status === 'CANCELLED') {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (!sameCustomer(booking, customerEmail, customerPhone)) {
      return res.status(403).json({ error: 'Esta reserva no coincide con tus datos.' });
    }

    const hoursLeft = hoursUntilClass(formatDateStr(booking.date), booking.startTime);
    if (hoursLeft < RESCHEDULE_HOURS) {
      return res.status(400).json({ error: 'El cambio de horario solo es posible con 8 horas de anticipación.' });
    }

    const service = await loadStudioService(client.id, serviceId);
    if (!service) return res.status(404).json({ error: 'Clase no disponible' });

    const { dayOfWeek } = parseDateOnly(date);
    const hours = await resolveHoursForDay(prisma, {
      clientId: client.id,
      serviceId: service.id,
      useCustomHours: service.useCustomHours,
      dayOfWeek,
    });
    if (!hours?.isOpen || hours.openTime !== startTime) {
      return res.status(400).json({ error: 'Ese horario no corresponde a esta clase.' });
    }
    if (hoursUntilClass(date, startTime) <= 0) {
      return res.status(400).json({ error: 'Esa clase ya comenzó o ya pasó.' });
    }

    const room = await classHasRoom(prisma, {
      clientId: client.id,
      serviceId: service.id,
      dateStr: date,
      startTime,
      capacity: service.capacity,
      excludeId: booking.id,
    });
    if (room.full) {
      return res.status(409).json({ error: 'Esa clase ya está llena.', waitlist: true });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        serviceId: service.id,
        date: bookingStorageDate(date),
        startTime,
        endTime: classEndTime(startTime, service.duration),
      },
      include: { service: { select: { name: true } } },
    });

    res.json({ booking: updated });
  } catch (error) {
    console.error('[Studio reschedule]', error);
    res.status(500).json({ error: 'No se pudo cambiar el horario' });
  }
});

router.post('/:slug/waitlist', async (req, res: Response) => {
  try {
    const client = await findStudioClient(req.params.slug);
    if (!client || !isStudioClient(client)) return res.status(404).json({ error: 'No disponible' });

    const { serviceId, date, startTime, customerName, customerEmail, customerPhone } = req.body as {
      serviceId?: string;
      date?: string;
      startTime?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    };
    if (!serviceId || !date || !startTime || !customerName?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Nombre, teléfono, clase y horario son obligatorios.' });
    }

    const service = await loadStudioService(client.id, serviceId);
    if (!service) return res.status(404).json({ error: 'Clase no disponible' });

    const { start, end } = parseDateOnly(date);
    const existing = await prisma.classWaitlist.findFirst({
      where: {
        clientId: client.id,
        serviceId: service.id,
        date: { gte: start, lte: end },
        startTime,
        status: 'WAITING',
      },
    });
    if (existing && sameCustomer(existing, customerEmail, customerPhone)) {
      return res.json({ already: true, entry: existing });
    }

    const entry = await prisma.classWaitlist.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        date: bookingStorageDate(date),
        startTime,
        customerName: customerName.trim(),
        customerEmail: customerEmail?.trim() || null,
        customerPhone: customerPhone.trim(),
        status: 'WAITING',
      },
    });

    res.status(201).json({ entry });
  } catch (error) {
    console.error('[Studio waitlist]', error);
    res.status(500).json({ error: 'No se pudo anotar en lista de espera' });
  }
});

export { activateClassSession };
export default router;
