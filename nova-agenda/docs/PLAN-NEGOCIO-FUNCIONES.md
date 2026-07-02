# Nova Agenda — Plan de negocio: funciones y suscripciones

Documento de referencia para definir la oferta comercial, pricing y roadmap de producto.  
Basado en el estado actual del código (`nova-agenda/`, rama `main`).

---

## 1. Resumen ejecutivo

**Nova Agenda** es una plataforma SaaS multi-tenant para negocios de servicios (salones, spas, clínicas, etc.) que incluye:

- Panel de administración web
- Portal público de reservas por negocio
- Facturación por suscripción (Stripe)
- Módulos opcionales: WhatsApp con IA, programa de fidelidad

**Modelo de ingresos:** suscripción mensual por negocio (cliente/tenant), con 3 niveles: **Gratuito**, **Profesional** y **Business**.

**Jerarquía técnica de planes:** `FREE (0) < BASIC (1) < PRO (2)`

---

## 2. Planes comerciales (definidos en producto)

| Plan interno | Nombre comercial | Precio mensual (USD) | Canal de alta |
|--------------|------------------|----------------------|---------------|
| `FREE`       | Gratuito         | $0                   | Registro web / admin |
| `BASIC`      | Profesional      | $49                  | Stripe Checkout |
| `PRO`        | Business         | $99                  | Stripe Checkout |

Fuente: `packages/api/src/routes/stripe.ts`, landing `packages/nova-agenda-website/`.

---

## 3. Matriz de funciones por plan

Leyenda:
- ✅ **Disponible** — implementado y accesible para ese plan
- 🔒 **Bloqueado** — existe en código pero restringido por plan
- ⚙️ **Manual** — disponible pero requiere activación del negocio
- 📋 **Comercial** — promocionado en web pero **sin límite técnico aún**
- 🚧 **Planificado** — mencionado en marketing, no implementado

| Función | FREE | BASIC | PRO | Notas técnicas |
|---------|:----:|:-----:|:---:|----------------|
| **Cuenta y acceso** |
| Registro de negocio | ✅ | ✅ | ✅ | `POST /api/public/register` |
| Login / sesión JWT | ✅ | ✅ | ✅ | 7 días de token |
| Panel admin (dashboard) | ✅ | ✅ | ✅ | KPIs, citas del día |
| Facturación / cambio de plan | ✅ | ✅ | ✅ | Stripe Checkout + Portal |
| **Gestión operativa (admin)** |
| CRUD de servicios | ✅ | ✅ | ✅ | Sin límite en código 📋 |
| CRUD de citas (crear, estados, eliminar) | ✅ | ✅ | ✅ | Estados: PENDING, CONFIRMED, CANCELLED, COMPLETED |
| Horarios de trabajo | ✅ | ✅ | ✅ | Se crean al registrar negocio |
| Branding (color, logo, slug) | ✅ | ✅ | ✅ | Campo `domain` en BD, uso parcial |
| Gestión de múltiples negocios | 🔒 | 🔒 | 🔒 | Solo rol `SUPER_ADMIN` |
| Configuración plataforma (Stripe, OpenAI) | 🔒 | 🔒 | 🔒 | Solo `SUPER_ADMIN` |
| **Portal público de reservas** |
| Página pública del negocio | 🔒 | ✅ | ✅ | FREE → `bookingDisabled: true` |
| Selección de servicio + calendario | 🔒 | ✅ | ✅ | Requiere plan ≥ BASIC |
| Horarios disponibles en tiempo real | 🔒 | ✅ | ✅ | `GET /api/public/slots` |
| Reserva online (formulario cliente) | 🔒 | ✅ | ✅ | `POST /api/bookings` |
| Subdominio por slug (`negocio.dominio`) | 📋 | ✅ | ✅ | Middleware `resolveTenant` |
| Dominio propio personalizado | 🚧 | 📋 | 📋 | Campo en BD, sin flujo completo |
| **Límites de uso** |
| Máx. 3 servicios | ✅ | — | — | Enforced en API |
| Máx. 20 servicios (Profesional) | — | ✅ | — | Enforced en API |
| Servicios ilimitados | — | — | ✅ | Enforced en API |
| Máx. 50 citas/mes | ✅ | — | — | Enforced en API |
| **Comunicación y automatización** |
| Recordatorios SMS | 🚧 | 📋 | 📋 | Promocionado; **no implementado** |
| WhatsApp — configuración | 🔒 | 🔒 | ✅ | Plan PRO en API + UI |
| WhatsApp — webhook entrante | 🔒 | 🔒 | ✅ | Chatbot con OpenAI |
| WhatsApp — recordatorios automáticos | 🔒 | 🔒 | ✅ | Cron cada 30 min (vía WhatsApp, no SMS) |
| WhatsApp — seguimiento post-cita | 🔒 | 🔒 | ✅ | Scheduler en `whatsapp-handler` |
| Notificaciones email (SMTP) | 🚧 | 🚧 | 🚧 | Legacy PHP; no en Nova API |
| **Programa de fidelidad** |
| Configurar programa (admin) | ✅ | ✅ | ✅ | Opt-in: `isActive: false` por defecto |
| Activar/desactivar en portal | ⚙️ | ⚙️ | ⚙️ | Toggle manual del negocio |
| Tarjeta de sellos (portal público) | ⚙️ | ⚙️ | ⚙️ | Solo si programa activo |
| Sello automático al completar cita | ⚙️ | ⚙️ | ⚙️ | Solo si programa activo |
| Recompensas configurables | ✅ | ✅ | ✅ | Descuento %, servicio gratis, etc. |
| WhatsApp en fidelidad | ⚙️ | ⚙️ | ⚙️ | Flag `enableWhatsApp`; envío 🚧 |
| **Pagos** |
| Cobro de suscripción (Stripe) | — | ✅ | ✅ | Webhook actualiza plan |
| Cobro de citas al cliente final | 🚧 | 🚧 | 🚧 | Precio en servicio; sin checkout citas |
| **Legacy (Tapai Agenda / PHP)** |
| Widget WordPress | — | — | — | Repo raíz `deploy/` — producto separado |

---

## 4. Detalle por módulo

### 4.1 Autenticación y roles

| Rol | Descripción | Acceso principal |
|-----|-------------|------------------|
| `SUPER_ADMIN` | Operador de la plataforma | Todos los negocios, configuración global, Stripe/OpenAI |
| `ADMIN` | Dueño del negocio (al registrarse) | Su negocio: servicios, citas, fidelidad, facturación |
| `CLIENT` | Usuario de negocio (rol en schema) | Mismo tenant, permisos acotados |

**Funciones de auth:** login, registro público con selección de plan, `GET /api/auth/me`.

---

### 4.2 Panel de administración (`packages/admin`)

| Sección | Ruta | Disponibilidad |
|---------|------|----------------|
| Panel / resumen | `/dashboard` | Todos los planes |
| Negocios (multi-tenant) | `/dashboard/clients` | Solo SUPER_ADMIN / ADMIN plataforma |
| Servicios | `/dashboard/services` | Todos |
| Fidelidad | `/dashboard/loyalty` | Todos (activación manual del programa) |
| WhatsApp | `/dashboard/whatsapp` | Solo PRO (UI + API) |
| Facturación | `/dashboard/billing` | Todos |
| Configuración plataforma | `/dashboard/settings` | Solo SUPER_ADMIN |

---

### 4.3 API REST (`packages/api`)

| Grupo | Endpoints principales | Restricción por plan |
|-------|----------------------|----------------------|
| Auth | `/api/auth/*` | — |
| Público | `/api/public/register`, `/client/:slug`, `/slots` | Slots y reservas ≥ BASIC |
| Clientes | `/api/clients/*` | SUPER_ADMIN |
| Servicios | `/api/services/*` | Autenticado |
| Citas | `/api/bookings/*` | Autenticado + público POST |
| WhatsApp | `/api/whatsapp/*` | PRO |
| Fidelidad | `/api/loyalty/*` | Programa activo (público); admin autenticado |
| Stripe | `/api/stripe/*` | Autenticado |
| Platform config | `/api/platform-config/*` | SUPER_ADMIN |

---

### 4.4 Portal público (`packages/client-sites`)

Flujo de reserva en 3 pasos: **Servicio → Fecha/Hora → Confirmación**.

Funciones adicionales cuando el negocio tiene **programa de fidelidad activo**:
- Pestaña **Fidelidad**
- Consulta/registro de tarjeta por teléfono
- Visualización de sellos y recompensas
- Avisos de sello en confirmación y éxito de reserva

---

### 4.5 Programa de fidelidad (reglas de negocio)

1. El negocio **crea** el programa en admin (inactivo por defecto).
2. El negocio **activa** cuando quiere publicarlo.
3. Mientras `isActive = false`:
   - No aparece en el portal público
   - No se otorgan sellos
   - No hay enrolamiento de clientes
4. Al marcar cita como **COMPLETED**, se otorga 1 sello (si hay teléfono/email vinculado).
5. **No hay restricción por plan de suscripción** hoy — es opt-in por negocio.

**Oportunidad comercial:** reservar fidelidad para BASIC+ o PRO en el roadmap.

---

### 4.6 WhatsApp + IA (plan PRO)

Incluye:
- Configuración de instancia (Evo Cloud u similar)
- Personalidad del asistente (OpenAI)
- Webhook de mensajes entrantes
- Intents: info, agendar, cancelar, etc.
- Recordatorios 24h antes (WhatsApp)
- Logs de conversación

Requisitos: claves OpenAI y WhatsApp configuradas por SUPER_ADMIN en plataforma.

---

## 5. Lo que promete la web vs. lo que hace el código

Para armar un plan de negocio honesto y priorizar desarrollo:

| Promesa comercial (landing) | Estado real |
|----------------------------|-------------|
| Hasta 3 servicios (Gratuito) | ✅ Enforced en `POST /api/services` |
| Hasta 50 citas/mes (Gratuito) | ✅ Enforced en creación de citas |
| Hasta 20 servicios (Profesional) | ✅ Enforced en `POST /api/services` |
| Servicios ilimitados (Business) | ✅ Sin límite en API |
| Página web personalizada (Profesional) | ✅ Portal `client-sites` con branding |
| Dominio propio | 🚧 Parcial (slug/subdominio sí) |
| Recordatorios SMS (Profesional) | 🚧 No existe; recordatorios son WhatsApp (PRO) |
| WhatsApp + IA 24/7 (Business) | ✅ Implementado (PRO) |
| Agendado por WhatsApp | ✅ Vía chatbot (PRO) |

---

## 6. Propuesta de empaquetado comercial (recomendada)

Alineada con el código actual + gaps a cerrar:

### Gratuito — $0/mes
**Objetivo:** Adquisición y prueba del panel interno.

| Incluye | Excluye |
|---------|---------|
| Panel admin | Portal público de reservas |
| Hasta 3 servicios* | WhatsApp |
| Hasta 50 citas/mes* | Fidelidad (opcional: bloquear) |
| 1 usuario admin | Dominio propio |

*\*Requiere implementar límites en API.*

---

### Profesional — $49/mes
**Objetivo:** Negocio independiente que vive de reservas online.

| Incluye | Excluye |
|---------|---------|
| Todo Gratuito sin límites de citas | WhatsApp / IA |
| Portal público de reservas | |
| Hasta 20 servicios* | |
| Branding (logo, colores) | |
| Programa de fidelidad (opt-in) | |
| Subdominio / slug público | |

*\*Requiere implementar límite en API.*

**Alternativa SMS:** integrar Twilio/MessageBird y mover “recordatorios SMS” aquí.

---

### Business — $99/mes
**Objetivo:** Automatización y retención.

| Incluye |
|---------|
| Todo Profesional |
| Servicios ilimitados |
| WhatsApp + chatbot IA |
| Recordatorios y seguimiento automático |
| Notificaciones de fidelidad por WhatsApp (cuando se complete) |
| Soporte prioritario (operativo, no técnico aún) |

---

## 7. Flujo de ingresos (Stripe)

```
Registro (FREE) → Uso panel → Upgrade en /dashboard/billing
    → Stripe Checkout → Webhook → plan = BASIC | PRO
Cancelación → Webhook subscription.deleted → plan = FREE
```

**Variables de plataforma (SUPER_ADMIN):** `stripe_secret_key`, `stripe_price_id`, `stripe_webhook_secret`.

**Nota:** Hoy hay un solo `stripe_price_id` — conviene un price ID por plan (BASIC y PRO) para facturación correcta.

---

## 8. Costos variables a considerar en el plan de negocio

| Concepto | Quién lo paga | Driver de costo |
|----------|---------------|-----------------|
| Hosting (Railway, etc.) | Plataforma | Por servicio desplegado |
| PostgreSQL | Plataforma | Tenants + citas |
| Stripe | % + fijo por transacción | Suscripciones |
| OpenAI API | Plataforma o repercutir | Mensajes WhatsApp PRO |
| WhatsApp / Evo Cloud | Plataforma o repercutir | Mensajes PRO |
| SMS (futuro) | Plataforma | Recordatorios BASIC |

---

## 9. KPIs sugeridos para el plan de negocio

| Métrica | Descripción |
|---------|-------------|
| MRR | Suma de suscripciones BASIC + PRO activas |
| Conversión FREE → BASIC | % negocios que activan portal en 30 días |
| Conversión BASIC → PRO | % que activa WhatsApp |
| Activación fidelidad | % negocios BASIC+ con programa activo |
| Citas/mes por tenant | Uso y señal de upgrade |
| Churn mensual | Cancelaciones Stripe |
| ARPU | Ingreso medio por negocio pagador |

---

## 10. Roadmap técnico para alinear producto y pricing

Prioridad sugerida para que la oferta comercial sea veraz:

1. ~~**Enforzar límites FREE:** 3 servicios, 50 citas/mes~~ ✅ Implementado
2. ~~**Enforzar límite BASIC:** 20 servicios~~ ✅ Implementado
3. **Dos price IDs en Stripe** (BASIC $49, PRO $99).
4. **SMS en BASIC** o corregir marketing (quitar SMS, poner “recordatorios por email”).
5. **Decidir fidelidad por plan:** ¿todos los pagos o solo BASIC+?
6. **Dominio custom:** flujo DNS + campo `domain` en Client.
7. **Pagos en cita:** Stripe Checkout por reserva (upsell).

---

## 11. Resumen visual

```
                    FREE          BASIC ($49)      PRO ($99)
Panel admin          ████████████  ████████████     ████████████
Portal reservas      ░░░░░░░░░░░░  ████████████     ████████████
Fidelidad (opt-in)   ████████████  ████████████     ████████████
WhatsApp + IA        ░░░░░░░░░░░░  ░░░░░░░░░░░░     ████████████
Límites servicios    3             20               ∞
Límites citas/mes    50            ∞                ∞
░ = bloqueado/no disponible
█ = disponible
```

---

## 12. Contacto y mantenimiento del documento

Actualizar este documento cuando:
- Se añadan límites por plan en API
- Cambien precios en `stripe.ts` o landing
- Se lancen SMS, dominio custom o pagos por cita

**Última revisión:** julio 2026 — basada en código post-módulo de fidelidad.
