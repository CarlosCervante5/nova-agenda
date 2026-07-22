# Configuración de Dominios — Nova Agenda

## Mapa de Dominios

| Servicio | Dominio final | Ejemplo |
|----------|---------------|---------|
| **Website (Landing)** | `novaagenda.com` | https://novaagenda.com |
| **API** | `api.novaagenda.com` | https://api.novaagenda.com |
| **Admin Panel** | `app.novaagenda.com` | https://app.novaagenda.com |
| **Client Sites** | `novaagenda.com` (mismo que landing) | https://novaagenda.com |

> **Nota:** Los client-sites usan el mismo dominio que la landing. Cada negocio se accede vía `novaagenda.com/{slug-del-negocio}`.

---

## Paso 1: Configurar Dominios en Railway

Para **cada servicio** en Railway:

1. Ve al servicio en el dashboard de Railway
2. Pestaña **Settings**
3. Sección **Networking** → **Custom Domain**
4. Agrega el dominio (ej. `api.novaagenda.com`)
5. Railway te dará un valor de verificación DNS

### Servicios y dominios a configurar:

| Servicio Railway | Custom Domain |
|------------------|---------------|
| `nova-agenda-production` (API) | `api.novaagenda.com` |
| `spirited-determination-production-a075` (Admin) | `app.novaagenda.com` |
| `adorable-learning-production` (Website) | `novaagenda.com` |
| `delightful-encouragement-production` (Client Sites) | *(ya cubierto por landing)* |

---

## Paso 2: Configurar DNS

En tu proveedor de dominios (Namecheap, GoDaddy, Cloudflare, etc.), agrega estos registros:

### Si usas Cloudflare (recomendado):
```
Tipo    Nombre    Contenido                 Proxy
CNAME   api       api.novaagenda.com.railway.app    Proxied
CNAME   app       app.novaagenda.com.railway.app    Proxied
CNAME   @         novaagenda.com.railway.app        Proxied
```

### Si usas otro DNS (sin proxy):
```
Tipo    Nombre    Contenido
CNAME   api       <valor-de-railway>
CNAME   app       <valor-de-railway>
CNAME   @         <valor-de-railway>
```

> **Importante:** El valor del CNAME lo obtienes de Railway cuando agregas el custom domain. Es algo como `xxx.up.railway.app`.

---

## Paso 3: Variables de Entorno en Railway

### Servicio API
```
DATABASE_URL=postgresql://...
JWT_SECRET=<genera uno seguro de 64+ caracteres>
CORS_ORIGIN=https://novaagenda.com,https://app.novaagenda.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...
EVO_CLOUD_API_URL=https://api.evo.cloud
EVO_CLOUD_API_KEY=...
EVO_CLOUD_INSTANCE_ID=...
OPENAI_API_KEY=...
```

### Servicio Admin
```
API_URL=https://api.novaagenda.com
NEXT_PUBLIC_API_URL=https://api.novaagenda.com
NEXT_PUBLIC_CLIENT_PORTAL_URL=https://novaagenda.com
```

### Servicio Website
```
NEXT_PUBLIC_ADMIN_URL=https://app.novaagenda.com
```

### Servicio Client Sites
```
API_URL=https://api.novaagenda.com
NEXT_PUBLIC_API_URL=https://api.novaagenda.com
```

---

## Paso 4: Stripe Webhook URL

En tu dashboard de Stripe:
1. **Developers** → **Webhooks**
2. Agregar endpoint: `https://api.novaagenda.com/api/stripe/webhook`
3. Seleccionar eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Paso 5: Verificar

1. Abre https://novaagenda.com — debe cargar la landing
2. Abre https://app.novaagenda.com — debe cargar el admin
3. Abre https://api.novaagenda.com/api/health — debe responder JSON
4. Prueba login: `admin@novaagenda.com` / `admin123`

---

## Generar JWT_SECRET seguro

```bash
openssl rand -base64 64
```

Copia el resultado y úsalo como valor de `JWT_SECRET` en Railway.
