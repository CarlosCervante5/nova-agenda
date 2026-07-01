import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/roles';

export default function Layout({ children }) {
  const { user, logout, isAdmin, isCliente } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isCliente ? [
    { to: '/', end: true, icon: 'dashboard', label: 'Inicio' },
    { to: '/my-appointments', icon: 'event', label: 'Mis citas' },
    { to: '/profile', icon: 'person', label: 'Mi perfil' },
  ] : [
    { to: '/', end: true, icon: 'dashboard', label: isAdmin ? 'Panel' : 'Inicio' },
    ...(isAdmin ? [] : [
      { to: '/appointments', icon: 'event', label: 'Mis sesiones' },
    ]),
    { to: '/calendar', icon: 'calendar_today', label: 'Calendario' },
    ...(isAdmin ? [
      { to: '/appointments', icon: 'event', label: 'Citas' },
      { to: '/clients', icon: 'group', label: 'Clientes' },
      { to: '/professionals', icon: 'badge', label: 'Profesionales' },
      { to: '/services', icon: 'spa', label: 'Servicios' },
      { to: '/sharing', icon: 'share', label: 'Compartir' },
      { to: '/settings', icon: 'settings', label: 'Configuración' },
    ] : [
      { to: '/my-profile', icon: 'person', label: 'Mi perfil' },
    ]),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={`${import.meta.env.BASE_URL}tapai_logo.png`} alt="Tapai Centro de Sanación" className="brand-logo brand-logo--sidebar" />
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-user-name">
                {user.full_name || user.username}
              </div>
              <div className={`sidebar-user-role ${isAdmin ? 'sidebar-user-role--admin' : isCliente ? 'sidebar-user-role--cliente' : 'sidebar-user-role--profesional'}`}>
                {getRoleLabel(user.role)}
              </div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {isCliente ? null : isAdmin ? (
        <button className="new-appointment-btn" onClick={() => navigate('/appointments')}>
          <span className="material-symbols-outlined">add</span>
          Nueva cita
        </button>
        ) : (
        <button className="new-appointment-btn" onClick={() => navigate('/appointments')}>
          <span className="material-symbols-outlined">event</span>
          Agendar cita
        </button>
        )}

        <div className="sidebar-footer">
          <a href="#" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Cerrar sesión</span>
          </a>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>

      <nav className="mobile-nav">
        <button>
          <span className="material-symbols-outlined">dashboard</span>
          <span>Inicio</span>
        </button>
        <button>
          <span className="material-symbols-outlined">calendar_today</span>
          <span>Agenda</span>
        </button>
        <button className="fab">
          <span className="material-symbols-outlined">add</span>
        </button>
        <button>
          <span className="material-symbols-outlined">group</span>
          <span>Clientes</span>
        </button>
        <button>
          <span className="material-symbols-outlined">settings</span>
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
