import { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import api from '../api';
import {
  format,
  parseISO,
  compareAsc,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { getStatusLabel } from '../utils/labels';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import ProfessionalHome from './ProfessionalHome';
import ClientHome from './ClientHome';

function getAppointmentDate(appointment) {
  return appointment.appointment_date?.split('T')[0] || '';
}

function sortAppointments(list) {
  return [...list].sort((a, b) => {
    const dateCompare = compareAsc(parseISO(getAppointmentDate(a)), parseISO(getAppointmentDate(b)));
    if (dateCompare !== 0) return dateCompare;
    return (a.appointment_time || '').localeCompare(b.appointment_time || '');
  });
}

export default function Dashboard() {
  const { user, isProfesional, isCliente } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [calendarAppointments, setCalendarAppointments] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    if (isProfesional || isCliente) {
      return;
    }

    loadStats();
    loadUpcomingAppointments();
  }, [isProfesional, isCliente]);

  useEffect(() => {
    if (isProfesional || isCliente) {
      return;
    }

    loadCalendarAppointments(calendarMonth);
  }, [calendarMonth, isProfesional, isCliente]);

  const loadStats = async () => {
    const res = await api.get('/appointments/stats');
    setStats(res.data);
  };

  const loadUpcomingAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await api.get(`/appointments?dateFrom=${today}`);
      const upcoming = sortAppointments(
        res.data.filter(apt => apt.status !== 'cancelled')
      );
      setUpcomingAppointments(upcoming);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const loadCalendarAppointments = async (monthDate) => {
    const from = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const to = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    const res = await api.get(`/appointments?dateFrom=${from}&dateTo=${to}`);
    setCalendarAppointments(res.data.filter(apt => apt.status !== 'cancelled'));
  };

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    calendarAppointments.forEach(apt => {
      const key = getAppointmentDate(apt);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(apt);
    });
    return map;
  }, [calendarAppointments]);

  const visibleAppointments = useMemo(() => {
    if (!selectedDate) {
      return upcomingAppointments;
    }

    const key = format(selectedDate, 'yyyy-MM-dd');
    return sortAppointments(
      upcomingAppointments.filter(apt => getAppointmentDate(apt) === key)
    );
  }, [upcomingAppointments, selectedDate]);

  const handleStatusChange = async (id, status) => {
    await api.put(`/appointments/${id}`, { status });
    setUpcomingAppointments(prev => prev.map(apt => (apt.id === id ? { ...apt, status } : apt)));
    setCalendarAppointments(prev => prev.map(apt => (apt.id === id ? { ...apt, status } : apt)));
    setSelectedAppointment(prev => (prev?.id === id ? { ...prev, status } : prev));
    loadStats();
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = user?.full_name || user?.username || 'equipo';

  if (isCliente) {
    return <ClientHome />;
  }

  if (isProfesional) {
    return <ProfessionalHome />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="dashboard-date-label">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1>Bienvenido, {displayName}</h1>
          <p className="subtitle">
            Hoy tienes {stats?.today || 0} {stats?.today === 1 ? 'cita' : 'citas'} programadas.
          </p>
        </div>
      </div>

      {stats && (
        <div className="stats-grid dashboard-kpis">
          <div className="stat-card">
            <div>
              <div className="stat-label">Citas agendadas</div>
              <div className="stat-value">{stats.scheduled ?? 0}</div>
              <div className="stat-change neutral">
                {stats.confirmed ?? 0} confirmadas · {stats.pending ?? 0} pendientes
              </div>
            </div>
            <div className="stat-icon primary">
              <span className="material-symbols-outlined">event_available</span>
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Canceladas</div>
              <div className="stat-value">{stats.cancelled ?? 0}</div>
              <div className="stat-change neutral">
                {stats.completed ?? 0} completadas en total
              </div>
            </div>
            <div className="stat-icon secondary">
              <span className="material-symbols-outlined">event_busy</span>
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Clientes totales</div>
              <div className="stat-value">{stats.totalClients ?? 0}</div>
              <div className="stat-change positive">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group</span>
                Comunidad registrada
              </div>
            </div>
            <div className="stat-icon tertiary">
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Citas hoy</div>
              <div className="stat-value">{String(stats.today ?? 0).padStart(2, '0')}</div>
              <div className="stat-change neutral">
                {stats.thisWeek ?? 0} esta semana
              </div>
            </div>
            <div className="stat-icon primary">
              <span className="material-symbols-outlined">today</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid-main dashboard-home">
        <section className="dashboard-appointments">
          <div className="dashboard-section-header">
            <div>
              <h2>Próximas citas</h2>
              <p className="dashboard-section-subtitle">
                {selectedDate
                  ? `Citas del ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
                  : `${upcomingAppointments.length} citas programadas`}
              </p>
            </div>
            {selectedDate && (
              <button type="button" className="btn btn-secondary dashboard-clear-filter" onClick={() => setSelectedDate(null)}>
                Ver todas
              </button>
            )}
          </div>

          {loadingAppointments ? (
            <div className="card dashboard-empty-state">
              <p>Cargando citas...</p>
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="card dashboard-empty-state">
              <span className="material-symbols-outlined">event_note</span>
              <p>
                {selectedDate
                  ? 'No hay citas programadas para este día'
                  : 'No hay citas próximas programadas'}
              </p>
            </div>
          ) : (
            visibleAppointments.map(apt => {
              const aptDate = getAppointmentDate(apt);
              const showDate = !isToday(parseISO(aptDate));

              return (
                <button
                  key={apt.id}
                  type="button"
                  className="appointment-item appointment-item--clickable"
                  onClick={() => setSelectedAppointment(apt)}
                >
                  <div
                    className="appointment-avatar"
                    style={{ background: `${apt.service_color}20`, color: apt.service_color }}
                  >
                    {getInitials(apt.client_name)}
                  </div>
                  <div className="appointment-info">
                    <h4>{apt.client_name}</h4>
                    <p>
                      <span
                        className="appointment-service-badge"
                        style={{
                          background: `${apt.service_color}15`,
                          color: apt.service_color,
                        }}
                      >
                        {apt.service_name}
                      </span>
                      {showDate && (
                        <span className="appointment-meta-item">
                          <span className="material-symbols-outlined">calendar_today</span>
                          {format(parseISO(aptDate), 'dd/MM/yyyy')}
                        </span>
                      )}
                      <span className="appointment-meta-item">
                        <span className="material-symbols-outlined">schedule</span>
                        {apt.appointment_time.slice(0, 5)}
                      </span>
                    </p>
                  </div>
                  <span className={`status-badge status-${apt.status}`}>
                    {getStatusLabel(apt.status)}
                  </span>
                  <span className="material-symbols-outlined appointment-item-chevron">chevron_right</span>
                </button>
              );
            })
          )}
        </section>

        <aside className="dashboard-calendar card">
          <div className="dashboard-section-header">
            <div>
              <h2>Calendario</h2>
              <p className="dashboard-section-subtitle">Selecciona un día para filtrar</p>
            </div>
          </div>

          <div className="calendar-container dashboard-mini-calendar">
            <Calendar
              value={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              formatMonthYear={(_, date) => format(date, 'MMMM yyyy', { locale: es })}
              formatShortWeekday={(_, date) => format(date, 'EEEEE', { locale: es })}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) {
                  setCalendarMonth(activeStartDate);
                }
              }}
              tileClassName={({ date, view }) => {
                if (view !== 'month') return null;
                const key = format(date, 'yyyy-MM-dd');
                const classes = [];
                if (appointmentsByDay.has(key)) classes.push('has-appointments');
                if (selectedDate && isSameDay(date, selectedDate)) classes.push('is-selected-day');
                return classes.join(' ');
              }}
              tileContent={({ date, view }) => {
                if (view !== 'month') return null;
                const key = format(date, 'yyyy-MM-dd');
                const count = appointmentsByDay.get(key)?.length || 0;
                if (!count) return null;
                return <span className="calendar-day-dot" aria-hidden="true" />;
              }}
            />
          </div>

          <div className="dashboard-calendar-legend">
            <span className="calendar-day-dot" aria-hidden="true" />
            <span>Día con citas</span>
          </div>
        </aside>
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          allowCreateProfile={isProfesional}
          onProfileCreated={(profile) => {
            setSelectedAppointment({
              ...selectedAppointment,
              client_user_id: profile.user_id,
            });
          }}
        />
      )}
    </div>
  );
}
