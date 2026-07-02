'use client';

import { useEffect, useState } from 'react';
import { api, Booking } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ clients: 0, services: 0, bookings: 0, revenue: 0 });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      if (user.role === 'SUPER_ADMIN') {
        const [clients, services, bookings] = await Promise.all([
          api.getClients(),
          api.getServices(),
          api.getBookings({ date: today }),
        ]);
        const revenue = bookings.reduce((sum, b) => sum + ((b as { service?: { price?: number } }).service?.price || 0), 0);
        setStats({ clients: clients.length, services: services.length, bookings: bookings.length, revenue });
        setRecentBookings(bookings.slice(0, 5));
      } else {
        const [services, bookings] = await Promise.all([
          api.getServices(),
          api.getBookings({ date: today }),
        ]);
        const revenue = bookings.reduce((sum, b) => sum + ((b as { service?: { price?: number } }).service?.price || 0), 0);
        setStats({ clients: 0, services: services.length, bookings: bookings.length, revenue });
        setRecentBookings(bookings.slice(0, 5));
      }
    } catch (error) {
      console.error('Error al cargar el panel:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markCompleted(bookingId: string) {
    try {
      await api.updateBookingStatus(bookingId, 'COMPLETED');
      await loadData();
    } catch (error) {
      console.error('Error al completar cita:', error);
    }
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card p-6 rounded-xl h-32" />
          ))}
        </div>
        <div className="glass-card rounded-xl h-96" />
      </div>
    );
  }

  const kpis = [
    ...(user?.role === 'SUPER_ADMIN' ? [{
      label: 'Negocios Totales',
      value: stats.clients.toString(),
      icon: 'business',
      trend: 'Plataforma',
      trendIcon: '',
      trendColor: 'text-on-surface-variant',
      iconBg: 'bg-secondary-container/30',
      iconColor: 'text-secondary',
    }] : []),
    {
      label: 'Servicios Activos',
      value: stats.services.toString(),
      icon: 'inventory_2',
      trend: 'Actuales',
      trendIcon: '',
      trendColor: 'text-on-surface-variant',
      iconBg: 'bg-primary-fixed-dim/30',
      iconColor: 'text-primary',
    },
    {
      label: 'Citas de Hoy',
      value: stats.bookings.toString(),
      icon: 'calendar_month',
      trend: format(new Date(), 'MMM d'),
      trendIcon: '',
      trendColor: 'text-on-surface-variant',
      iconBg: 'bg-tertiary-container/30',
      iconColor: 'text-tertiary',
    },
    {
      label: 'Ingresos (Mes)',
      value: `$${stats.revenue.toLocaleString()}`,
      icon: 'payments',
      trend: '+12.5%',
      trendIcon: 'trending_up',
      trendColor: 'text-secondary',
      iconBg: 'bg-primary-fixed-dim/30',
      iconColor: 'text-primary',
    },
  ];

  return (
    <div className="space-y-gutter">
      <div className="mb-xl">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">
          Bienvenido de nuevo, {user?.name?.split(' ')[0]}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {user?.role === 'SUPER_ADMIN'
            ? 'Aquí está lo que está pasando con la plataforma hoy.'
            : 'Aquí está lo que está pasando con tu negocio hoy.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass-card p-6 rounded-xl shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-container opacity-10 rounded-full group-hover:scale-110 transition-transform" />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 ${kpi.iconBg} rounded-lg ${kpi.iconColor}`}>
                <span className="material-symbols-outlined">{kpi.icon}</span>
              </div>
              {kpi.trendIcon && (
                <span className={`${kpi.trendColor} font-label-md text-label-md flex items-center`}>
                  {kpi.trend} <span className="material-symbols-outlined text-sm ml-1">{kpi.trendIcon}</span>
                </span>
              )}
              {!kpi.trendIcon && (
                <span className={`${kpi.trendColor} font-label-md text-label-md`}>{kpi.trend}</span>
              )}
            </div>
            <p className="text-on-surface-variant font-label-md text-label-md">{kpi.label}</p>
            <h3 className="text-headline-lg font-headline-lg text-on-surface mt-1">{kpi.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2 glass-card rounded-xl p-lg flex flex-col h-[300px] sm:h-[400px]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-xl gap-3">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Crecimiento de Ingresos</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Análisis mensual de suscripciones</p>
            </div>
            <div className="flex bg-surface-container rounded-lg p-1 self-start">
              <button className="px-3 py-1 bg-surface-container-lowest shadow-sm rounded-md text-label-sm font-label-sm text-primary">Mensual</button>
              <button className="px-3 py-1 text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">Trimestral</button>
            </div>
          </div>
          <div className="flex-1 relative flex items-end gap-4 px-4 pb-8 border-b border-l border-outline-variant">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-outline" />
              <div className="border-t border-outline" />
              <div className="border-t border-outline" />
              <div className="border-t border-outline" />
            </div>
            {[
              { h: '40%', color: 'bg-primary-container/40 hover:bg-primary-container', label: '$120k' },
              { h: '55%', color: 'bg-secondary-container/40 hover:bg-secondary-container', label: '$145k' },
              { h: '75%', color: 'bg-primary/40 hover:bg-primary/80', label: '$190k' },
              { h: '60%', color: 'bg-tertiary-container/40 hover:bg-tertiary-container', label: '$160k' },
              { h: '90%', color: 'bg-primary-fixed/80 hover:bg-primary-fixed', label: '$230k' },
              { h: '82%', color: 'bg-secondary-fixed/80 hover:bg-secondary-fixed', label: '$215k' },
            ].map((bar, i) => (
              <div key={i} className={`flex-1 ${bar.color} rounded-t-lg transition-all cursor-pointer relative group`} style={{ height: bar.h }}>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-background text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{bar.label}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between px-4 pt-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            <span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-lg flex flex-col">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-xl">Salud del Sistema</h3>
          <div className="space-y-6 flex-1">
            {[
              { label: 'API', value: '99.98%', width: 'w-[99.98%]', color: 'bg-primary-container' },
              { label: 'Base de Datos', value: '0.02s promedio', width: 'w-[85%]', color: 'bg-secondary-container' },
              { label: 'Almacenamiento', value: '4.2 TB / 10 TB', width: 'w-[42%]', color: 'bg-tertiary-container' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{item.value}</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} ${item.width}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-xl p-4 bg-surface-container-low rounded-lg flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-primary">security</span>
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface">Auditoría de Seguridad</p>
              <p className="text-[10px] text-on-surface-variant">Última verificación: hace 14 minutos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vistas previa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
          <div className="h-48 bg-primary-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-primary">calendar_month</span>
          </div>
          <div className="p-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Calendario Inteligente</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Gestiona todas las citas de tus clientes en una vista visual intuitiva.</p>
          </div>
        </div>
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
          <div className="h-48 bg-secondary-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-secondary">event_available</span>
          </div>
          <div className="p-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Reservas en Línea</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Tus clientes pueden reservar citas 24/7 desde cualquier dispositivo.</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="px-lg py-md border-b border-outline-variant flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-surface-container-low">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Agenda de Hoy</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{recentBookings.length} citas programadas</p>
          </div>
          <span className="font-label-md text-label-md text-primary">{format(new Date(), 'EEEE, MMM d')}</span>
        </div>
        <div className="divide-y divide-outline-variant">
          {recentBookings.length === 0 ? (
            <div className="p-lg text-center text-on-surface-variant font-body-sm text-body-sm">No hay citas hoy</div>
          ) : (
            recentBookings.map((booking) => (
              <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-lg p-md hover:bg-surface-container-low/50 transition-colors cursor-pointer group">
                <div className="flex sm:block items-center gap-3 sm:gap-0 sm:w-20 sm:text-center">
                  <span className="font-label-md text-label-md text-primary">{booking.startTime}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{booking.service?.duration || 60} min</span>
                </div>
                <div className="flex-1 sm:border-l-2 sm:border-secondary-container sm:pl-lg">
                  <h4 className="font-label-md text-label-md text-on-surface">{booking.service?.name}</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Cliente: {booking.customerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${
                    booking.status === 'CONFIRMED' ? 'bg-secondary-container text-on-secondary-container' :
                    booking.status === 'PENDING' ? 'bg-tertiary-fixed/30 text-on-tertiary-fixed-variant' :
                    booking.status === 'COMPLETED' ? 'bg-primary-container/30 text-primary' :
                    booking.status === 'CANCELLED' ? 'bg-error-container text-on-error-container' :
                    'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {booking.status === 'CONFIRMED' ? 'Confirmada' :
                     booking.status === 'PENDING' ? 'Pendiente' :
                     booking.status === 'COMPLETED' ? 'Completada' :
                     booking.status === 'CANCELLED' ? 'Cancelada' : booking.status}
                  </span>
                  {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
                    <button
                      onClick={() => markCompleted(booking.id)}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-all"
                      title="Marca la visita como completada y otorga 1 sello de fidelidad"
                    >
                      + Sello
                    </button>
                  )}
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">more_vert</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
