# Agenda Centro Holístico

Sistema de gestión de citas para centro holístico con panel admin y widget público para WordPress.

## Instalación

### 1. Requisitos previos
- Node.js 18+
- MySQL 5.7+
- npm

### 2. Configurar base de datos

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de MySQL
```

### 3. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Admin
cd ../admin
npm install
```

### 4. Inicializar base de datos

```bash
cd backend
npm run db:setup
```

Esto creará:
- Base de datos `centro_holistico_agenda`
- Tablas necesarias
- Usuario admin: `admin` / `admin123`
- Servicios de ejemplo

### 5. Iniciar servidores

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Admin
cd admin
npm run dev
```

### URLs
- **Backend API:** http://localhost:3001
- **Panel Admin:** http://localhost:5173 (en desarrollo) o http://localhost:3001/admin (en producción)
- **Widget Público:** http://localhost:3001/widget

## Incrustar en WordPress

### Opción 1: Plugin WordPress (Recomendado)

El shortcode `[agendamiento_centro]` **no funciona solo** — WordPress necesita un plugin que lo registre.

1. Comprime la carpeta `wordpress-plugin/tapai-agenda/` en un ZIP
2. En WordPress: **Plugins → Añadir nuevo → Subir plugin**
3. Activa el plugin
4. Ve a **Ajustes → Tapai Agenda** e introduce la URL base (ej: `https://tu-dominio.com/booking`)
5. En cualquier página usa:

```
[agendamiento_centro]
```

Atributos opcionales:
- `[agendamiento_centro height="800"]` — altura del widget
- `[agendamiento_centro url="https://tu-dominio.com/booking"]` — URL alternativa

También puedes usar el bloque **Tapai Agenda** en el editor Gutenberg.

### Opción 2: iframe directo

Agrega este código en una página HTML o widget personalizado:

```html
<iframe src="https://tu-dominio.com/booking/public/" width="100%" height="700" frameborder="0" style="border:none;border-radius:16px;" title="Agendar cita"></iframe>
```

### Opción 3: Script embed (sitios que permiten JavaScript)

```html
<div id="centro-holistico-booking"></div>
<script>
  window.bookingConfig = {
    apiBase: 'https://tu-dominio.com/booking'
  };
</script>
<script src="https://tu-dominio.com/booking/public/embed.js"></script>
```

## Estructura de la API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual

### Citas (requiere auth)
- `GET /api/appointments` - Listar citas
- `POST /api/appointments` - Crear cita
- `PUT /api/appointments/:id` - Actualizar cita
- `DELETE /api/appointments/:id` - Eliminar cita
- `GET /api/appointments/stats` - Estadísticas

### Clientes (requiere auth)
- `GET /api/clients` - Listar clientes
- `POST /api/clients` - Crear cliente
- `PUT /api/clients/:id` - Actualizar cliente
- `DELETE /api/clients/:id` - Eliminar cliente

### Servicios
- `GET /api/services` - Listar (requiere auth)
- `GET /api/services/public` - Listar (público)
- `POST /api/services` - Crear (requiere auth)
- `PUT /api/services/:id` - Actualizar (requiere auth)
- `DELETE /api/services/:id` - Desactivar (requiere auth)

### Reservas Públicas
- `GET /api/public/services` - Servicios disponibles
- `GET /api/public/available/:service/:date` - Horarios disponibles
- `POST /api/public/book` - Reservar cita

## Funcionalidades

### Panel Admin
- Dashboard con estadísticas
- Gestión de citas (crear, editar, cancelar, completar)
- Gestión de clientes (buscar, crear, editar)
- Gestión de servicios (CRUD con colores)
- Calendario visual
- Filtros por fecha y estado

### Widget Público
- Selección de servicio
- Calendario interactivo
- Horarios disponibles en tiempo real
- Formulario de reserva
- Confirmación por email

## Configuración de Email

Para habilitar notificaciones por email, configura SMTP en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password_de_aplicacion
EMAIL_FROM=noreply@centroholistico.com
```

Para Gmail, genera una contraseña de aplicación en:
https://myaccount.google.com/apppasswords

## Producción

### Build del Admin
```bash
cd admin
npm run build
```

Los archivos estáticos se servirán desde `http://localhost:3001/admin`

### Variables de entorno importantes
```env
JWT_SECRET= secreto_largo_y_seguro
DB_PASSWORD= password_seguro
SMTP_PASS= password_aplicacion_smtp
```

## Licencia

MIT
