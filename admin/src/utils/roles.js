export const ROLES = {
  ADMIN: 'admin',
  PROFESIONAL: 'profesional',
  CLIENTE: 'cliente',
};

export function normalizeRole(role) {
  if (role === 'staff') return ROLES.PROFESIONAL;
  return role || ROLES.PROFESIONAL;
}

export function isAdmin(user) {
  return normalizeRole(user?.role) === ROLES.ADMIN;
}

export function isProfesional(user) {
  return normalizeRole(user?.role) === ROLES.PROFESIONAL;
}

export function isCliente(user) {
  return normalizeRole(user?.role) === ROLES.CLIENTE;
}

export function getRoleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === ROLES.ADMIN) return 'Administrador';
  if (normalized === ROLES.PROFESIONAL) return 'Profesional';
  if (normalized === ROLES.CLIENTE) return 'Cliente';
  return normalized;
}
