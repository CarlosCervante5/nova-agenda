export const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  no_show: 'No llegó',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'completed', label: 'Completado' },
  { value: 'no_show', label: 'No llegó' },
  { value: 'pending', label: 'Pendiente' },
];

export const FIELD_TYPE_LABELS = {
  text: 'Texto corto',
  email: 'Correo',
  phone: 'Teléfono',
  textarea: 'Texto largo',
  select: 'Lista desplegable',
  number: 'Número',
  date: 'Fecha',
};

export function getFieldTypeLabel(type) {
  return FIELD_TYPE_LABELS[type] || type;
}
