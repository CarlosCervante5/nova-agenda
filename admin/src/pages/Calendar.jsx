import { useState, useEffect } from 'react';
import api from '../api';
import { 
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  addDays, subDays, format, isToday, isSameMonth,
  startOfDay, endOfDay, eachDayOfInterval,
  getDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { STATUS_OPTIONS } from '../utils/labels';
import { useAuth } from '../context/AuthContext';
import { getAppointmentDateKey, formatAppointmentDate } from '../utils/appointmentDates';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);
const HOUR_HEIGHT = 100;
const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DAY_NAMES_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function Calendar() {
  const { isAdmin, isProfesional } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    appointment_time: '09:00',
    notes: ''
  });

  useEffect(() => {
    loadAppointments();
  }, [currentDate, viewMode]);

  useEffect(() => {
    loadServices();
    loadClients();
  }, []);

  const getDateRange = () => {
    if (viewMode === 'day') {
      return {
        from: format(currentDate, 'yyyy-MM-dd'),
        to: format(currentDate, 'yyyy-MM-dd')
      };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        from: format(weekStart, 'yyyy-MM-dd'),
        to: format(weekEnd, 'yyyy-MM-dd')
      };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        from: format(monthStart, 'yyyy-MM-dd'),
        to: format(monthEnd, 'yyyy-MM-dd')
      };
    }
  };

  const loadAppointments = async () => {
    const range = getDateRange();
    const res = await api.get(`/appointments?dateFrom=${range.from}&dateTo=${range.to}`);
    setAppointments(res.data);
  };

  const loadServices = async () => {
    const res = await api.get('/services');
    setServices(res.data);
  };

  const loadClients = async () => {
    const res = await api.get('/clients');
    setClients(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const service = services.find(s => s.id === parseInt(formData.service_id));
    
    await api.post('/appointments', {
      ...formData,
      duration_minutes: service?.duration_minutes || 60
    });
    
    setShowModal(false);
    resetForm();
    loadAppointments();
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      service_id: '',
      appointment_date: format(new Date(), 'yyyy-MM-dd'),
      appointment_time: '09:00',
      notes: ''
    });
  };

  const navigate = (direction) => {
    if (viewMode === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const getMonthDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDay = getDay(monthStart);
    const days = [];
    
    // Add empty days for alignment
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    days.push(...allDays);
    
    return days;
  };

  const getAppointmentsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => getAppointmentDateKey(apt.appointment_date) === dateStr);
  };

  const getAppointmentStyle = (appointment) => {
    const timeParts = appointment.appointment_time.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]) || 0;
    
    const startOffset = (hours - 7) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    const duration = appointment.duration_minutes || 60;
    const height = (duration / 60) * HOUR_HEIGHT;

    return {
      top: `${startOffset}px`,
      height: `${height}px`
    };
  };

  const formatTime = (time) => {
    if (!time) return '';
    const parts = time.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const getEndTime = (startTime, duration) => {
    if (!startTime) return '';
    const parts = startTime.split(':');
    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]) || 0;
    minutes += duration || 60;
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/appointments/${id}`, { status });
    loadAppointments();
    if (selectedAppointment && selectedAppointment.id === id) {
      setSelectedAppointment({ ...selectedAppointment, status });
    }
  };

  const handleSendAccess = async () => {
    const clientId = selectedAppointment?.client_id;
    const clientEmail = selectedAppointment?.client_email?.trim() || '';
    if (!clientId || selectedAppointment?.client_user_id || !clientEmail) return;

    try {
      const res = await api.post(`/clients/${clientId}/send-access`, {});
      const profile = res.data.profile || {};
      setSelectedAppointment({
        ...selectedAppointment,
        client_user_id: profile.user_id,
      });
      if (res.data.email?.sent) {
        alert(`Accesos enviados a ${clientEmail}.\nUsuario: ${profile.username}`);
      } else {
        alert(res.data.message || 'No se pudo enviar el correo con los accesos');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'No se pudieron enviar los accesos al paciente');
    }
  };

  const renderSidebarActions = () => {
    if (!selectedAppointment) return null;

    const hasProfile = !!selectedAppointment.client_user_id;
    const clientEmail = selectedAppointment.client_email?.trim() || '';

    return (
      <div className="sidebar-actions">
        {isProfesional && !hasProfile && clientEmail && (
          <button type="button" className="action-btn primary" onClick={handleSendAccess}>
            Enviar accesos al paciente
          </button>
        )}
        {isProfesional && !hasProfile && !clientEmail && (
          <p className="sidebar-hint">Añade un correo al paciente para enviar sus accesos.</p>
        )}
      </div>
    );
  };

  const getTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(weekStart, weekEnd)) {
        return format(weekStart, "MMMM yyyy", { locale: es });
      }
      return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMMM yyyy", { locale: es })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
  };

  const weekDays = getWeekDays();
  const monthDays = getMonthDays();

  return (
    <div className="calendar-page">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-left">
          <div className="calendar-nav-buttons">
            <button onClick={() => navigate('prev')} className="nav-btn">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button onClick={() => navigate('next')} className="nav-btn">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button onClick={goToToday} className="today-btn">Hoy</button>
          </div>
          <h2 className="calendar-title">{getTitle()}</h2>
        </div>
        <div className="calendar-header-right">
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Día
            </button>
            <button 
              className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Semana
            </button>
            <button 
              className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="calendar-body">
          <div className="calendar-grid-container">
            <div className="day-headers single-day">
              <div className="time-gutter-header"></div>
              <div className={`day-header today`}>
                <span className="day-name">{DAY_NAMES[currentDate.getDay()]}</span>
                <span className="day-number today-number">{format(currentDate, 'd')}</span>
              </div>
            </div>

            <div className="time-grid-wrapper">
              <div className="time-grid">
                <div className="time-gutter">
                  {HOURS.map(hour => (
                    <div key={hour} className="time-label">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                <div className="day-column today-column">
                  {HOURS.map(hour => (
                    <div key={hour} className="hour-cell"></div>
                  ))}
                  
                  {getAppointmentsForDay(currentDate).map(apt => {
                    const style = getAppointmentStyle(apt);
                    const serviceColor = apt.service_color || '#5f7161';
                    return (
                      <div
                        key={apt.id}
                        className={`calendar-appointment status-${apt.status}`}
                        style={{
                          ...style,
                          backgroundColor: serviceColor + 'e6',
                          borderLeftColor: serviceColor
                        }}
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <div className="apt-time">{formatTime(apt.appointment_time)}</div>
                        <div className="apt-client">{apt.client_name}</div>
                        <div className="apt-service">{apt.service_name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Detail Sidebar */}
          <aside className={`detail-sidebar ${selectedAppointment ? 'open' : ''}`}>
            {selectedAppointment ? (
              <div className="sidebar-content">
                <div className="detail-sidebar-header">
                  <h3>Detalle de la cita</h3>
                  <button onClick={() => setSelectedAppointment(null)} className="close-btn">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="sidebar-body">
                  <div className="client-avatar">
                    <span className="avatar-letter">
                      {selectedAppointment.client_name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <h4 className="client-name">{selectedAppointment.client_name}</h4>
                  <p className="service-name">{selectedAppointment.service_name}</p>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                      <span className="detail-label">Profesional</span>
                      <span className="detail-value">
                        {selectedAppointment.professional_name?.trim() || 'Sin asignar'}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">event</span>
                    </div>
                    <div>
                      <span className="detail-label">Fecha</span>
                      <span className="detail-value">
                        {formatAppointmentDate(selectedAppointment.appointment_date, "EEEE d 'de' MMMM, yyyy")}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <div>
                      <span className="detail-label">Hora</span>
                      <span className="detail-value">
                        {formatTime(selectedAppointment.appointment_time)} - {getEndTime(selectedAppointment.appointment_time, selectedAppointment.duration_minutes)}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                    <div>
                      <span className="detail-label">Estado</span>
                      <select
                        value={selectedAppointment.status}
                        onChange={(e) => handleStatusChange(selectedAppointment.id, e.target.value)}
                        className={`status-pill ${selectedAppointment.status}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '2rem', fontSize: '13px', fontWeight: 600 }}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedAppointment.client_email && (
                    <div className="detail-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">email</span>
                      </div>
                      <div>
                        <span className="detail-label">Correo</span>
                        <span className="detail-value">{selectedAppointment.client_email}</span>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.client_phone && (
                    <div className="detail-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">phone</span>
                      </div>
                      <div>
                        <span className="detail-label">Teléfono</span>
                        <span className="detail-value">{selectedAppointment.client_phone}</span>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.notes && (
                    <div className="detail-row notes-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">notes</span>
                      </div>
                      <div>
                        <span className="detail-label">Notas</span>
                        <p className="detail-notes">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                {renderSidebarActions()}
              </div>
            ) : (
              <div className="sidebar-empty">
                <span className="material-symbols-outlined">event_note</span>
                <p>Selecciona una cita para ver los detalles del cliente.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="calendar-body">
          <div className="calendar-grid-container">
            <div className="day-headers">
              <div className="time-gutter-header"></div>
              {weekDays.map((day, index) => (
                <div 
                  key={index} 
                  className={`day-header ${isToday(day) ? 'today' : ''}`}
                >
                  <span className="day-name">{DAY_NAMES[day.getDay()]}</span>
                  <span className={`day-number ${isToday(day) ? 'today-number' : ''}`}>
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>

            <div className="time-grid-wrapper">
              <div className="time-grid">
                <div className="time-gutter">
                  {HOURS.map(hour => (
                    <div key={hour} className="time-label">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {weekDays.map((day, dayIndex) => (
                  <div key={dayIndex} className={`day-column ${isToday(day) ? 'today-column' : ''}`}>
                    {HOURS.map(hour => (
                      <div key={hour} className="hour-cell"></div>
                    ))}
                    
                    {getAppointmentsForDay(day).map(apt => {
                      const style = getAppointmentStyle(apt);
                      const serviceColor = apt.service_color || '#5f7161';
                      return (
                        <div
                          key={apt.id}
                          className={`calendar-appointment status-${apt.status}`}
                          style={{
                            ...style,
                            backgroundColor: serviceColor + 'e6',
                            borderLeftColor: serviceColor
                          }}
                          onClick={() => setSelectedAppointment(apt)}
                        >
                          <div className="apt-time">{formatTime(apt.appointment_time)}</div>
                          <div className="apt-client">{apt.client_name}</div>
                          <div className="apt-service">{apt.service_name}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Sidebar */}
          <aside className={`detail-sidebar ${selectedAppointment ? 'open' : ''}`}>
            {selectedAppointment ? (
              <div className="sidebar-content">
                <div className="detail-sidebar-header">
                  <h3>Detalle de la cita</h3>
                  <button onClick={() => setSelectedAppointment(null)} className="close-btn">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="sidebar-body">
                  <div className="client-avatar">
                    <span className="avatar-letter">
                      {selectedAppointment.client_name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <h4 className="client-name">{selectedAppointment.client_name}</h4>
                  <p className="service-name">{selectedAppointment.service_name}</p>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                      <span className="detail-label">Profesional</span>
                      <span className="detail-value">
                        {selectedAppointment.professional_name?.trim() || 'Sin asignar'}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">event</span>
                    </div>
                    <div>
                      <span className="detail-label">Fecha</span>
                      <span className="detail-value">
                        {formatAppointmentDate(selectedAppointment.appointment_date, "EEEE d 'de' MMMM, yyyy")}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <div>
                      <span className="detail-label">Hora</span>
                      <span className="detail-value">
                        {formatTime(selectedAppointment.appointment_time)} - {getEndTime(selectedAppointment.appointment_time, selectedAppointment.duration_minutes)}
                      </span>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-icon">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                    <div>
                      <span className="detail-label">Estado</span>
                      <select
                        value={selectedAppointment.status}
                        onChange={(e) => handleStatusChange(selectedAppointment.id, e.target.value)}
                        className={`status-pill ${selectedAppointment.status}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '2rem', fontSize: '13px', fontWeight: 600 }}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedAppointment.client_email && (
                    <div className="detail-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">email</span>
                      </div>
                      <div>
                        <span className="detail-label">Correo</span>
                        <span className="detail-value">{selectedAppointment.client_email}</span>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.client_phone && (
                    <div className="detail-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">phone</span>
                      </div>
                      <div>
                        <span className="detail-label">Teléfono</span>
                        <span className="detail-value">{selectedAppointment.client_phone}</span>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.notes && (
                    <div className="detail-row notes-row">
                      <div className="detail-icon">
                        <span className="material-symbols-outlined">notes</span>
                      </div>
                      <div>
                        <span className="detail-label">Notas</span>
                        <p className="detail-notes">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                {renderSidebarActions()}
              </div>
            ) : (
              <div className="sidebar-empty">
                <span className="material-symbols-outlined">event_note</span>
                <p>Selecciona una cita para ver los detalles del cliente.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="calendar-body month-view">
          <div className="month-grid">
            <div className="month-header-row">
              {DAY_NAMES.map(name => (
                <div key={name} className="month-day-name">{name}</div>
              ))}
            </div>
            
            <div className="month-days-grid">
              {monthDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="month-day empty"></div>;
                }
                
                const dayAppointments = getAppointmentsForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`month-day ${isCurrentDay ? 'today' : ''}`}
                    onClick={() => {
                      setCurrentDate(day);
                      setViewMode('day');
                    }}
                  >
                    <span className={`month-day-number ${isCurrentDay ? 'today-number' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="month-day-appointments">
                      {dayAppointments.slice(0, 3).map(apt => {
                        const serviceColor = apt.service_color || '#5f7161';
                        return (
                          <div 
                            key={apt.id} 
                            className="month-appointment"
                            style={{ backgroundColor: serviceColor + 'e6', borderLeftColor: serviceColor }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(apt);
                            }}
                          >
                            <span className="month-apt-time">{formatTime(apt.appointment_time)}</span>
                            <span className="month-apt-name">{apt.client_name}</span>
                          </div>
                        );
                      })}
                      {dayAppointments.length > 3 && (
                        <div className="month-more">+{dayAppointments.length - 3} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {isAdmin && (
      <button className="fab-button" onClick={() => setShowModal(true)}>
        <span className="material-symbols-outlined">calendar_add_on</span>
        <span className="fab-text">Agendar</span>
      </button>
      )}

      {/* New Appointment Modal */}
      {isAdmin && showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nueva cita</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Cliente</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Servicio</label>
                <select
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar servicio</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hora</label>
                  <input
                    type="time"
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Agregar notas..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
