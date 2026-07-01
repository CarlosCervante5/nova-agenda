# Nova Agenda - Multi-Tenant Client Management Platform

## Overview

Nova Agenda is a complete multi-tenant platform for managing client websites and bookings. It consists of three distinct but integrated services:

1. **Nova Agenda Website** - Public-facing site showcasing the platform
2. **Nova Agenda Admin** - Main dashboard for managing all client accounts
3. **Nova Agenda Client Portals** - Individual client websites at subdominios

This architecture enables you **one codebase, infinite clients** through sophisticated multi-tenant design.

## 🚀 Quick Start

```bash
# Clone the project
cd /path/to/
https://github.com/your-org/nova-agenda.git

# Setup environment variables
# Copy and customize .env files in each package

# Install dependencies (Node.js required)
npm install

# Start all services with Docker (Recommended)
docker-compose up --build

# Or run individually
# Terminal 1: Backend API
cd packages/api
npm run dev

# Terminal 2: Admin Dashboard
cd packages/admin
npm run dev

# Terminal 3: Nova Agenda Website
cd packages/nova-agenda-website
npm run dev
```

## 🏗️ Project Structure

```
nova-agenda/
├── packages/
│   ├── api/                    # Backend API (Express.js)
│   │   ├── src/
│   │   │   ├── routes/           # API routes
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── services/          # Business logic
│   │   │   └── middleware/        # Authentication/authorization
│   │   └── package.json
│   ├── admin/                  # Admin dashboard (Next.js)
│   │   ├── src/
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── pages/            # Admin pages
│   │   │   └── hooks/            # Custom React hooks
│   │   └── package.json
│   ├── client-sites/           # Client portals (Next.js)
│   │   ├── client-a/            # Individual client site
│   │   ├── client-b/            
│   │   ├── client-c/
│   │   └── ...                 # Create new directory for each client
│   │   └── package.json
│   └── package.json
├── docker/                     # Docker configurations
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.admin
│   └── Dockerfile.client
└── README.md
```

## 🏷️ Service Descriptions

### 📊 Nova Agenda Admin (packages/admin)
- **Purpose**: Main dashboard for managing all client accounts
- **Access**: `http://localhost:3001/admin`
- **Features**:
  - Client list with statistics and filters
  - Create/edit/delete clients
  - User team management and invitations
  - Client account settings and branding
  - Audit logs and activity tracking
  - API keys and integration management

### 🌐 Nova Agenda Website (packages/nova-agenda-website)
- **Purpose**: Public-facing website showcasing the platform
- **Access**: `http://localhost:3002`
- **Features**:
  - Landing page with hero section
  - Services/features showcase
  - Client testimonials
  - Booking page integration
  - Contact information
  - SEO optimization

### 🏢 Client Portals (packages/client-sites/*)
- **Purpose**: Individual client websites at subdominios
- **Access**: `client-name.novaagenda.com`
- **Features**:
  - Client-specific branding (logo, colors, slogan)
  - Complete client self-management
  - Team collaboration tools
  - Service booking pages
  - Client-specific dashboard
  - Custom content management

## 🔧 Technical Architecture

### Data Model
```sql
-- Clientes (核心表)
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  domain VARCHAR(100) UNIQUE NOT NULL,
  custom_domain VARCHAR(255) UNIQUE,
  status ENUM('pending','active','sized','cancelled'),
  plan_id UUID,
  settings JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Usuarios (团队管理)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clients(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role ENUM('owner','admin','editor','viewer','external'),
  status ENUM('pending','active','inactive'),
  last_login TIMESTAMP,
  created_at TIMESTAMP
);

-- Servicios (Booking system)
CREATE TABLE services (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  color VARCHAR(7) DEFAULT '#7d7f3e',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Multi-Tenant Strategy

1. **Database Isolation**: Each client has their own database row
2. **Subdomain Routing**: `client.name.novaagenda.com` → specific client package
3. **Shared Services**: Common utilities, auth, API clients
4. **Centralized Management**: Admin can access and modify any client

## 🚀 Development Workflow

### 1. Creating a New Client
```bash
# Create new client directory
cd packages/client-sites
mkdir client-new

# Navigate and setup
cd client-new
npm init -y
touch .env
# Copy .env.example or setup environment variables
npm install
# Setup database entry for new client
# Configure subdomain in admin dashboard or API
```

### 2. Deploying Client Sites
```bash
# Build for production
cd packages/client-sites/client-new
npm run build

# Deploy to hosting provider
# Configure DNS: CNAME -> novaagenda.com
# Or A record: 192.0.2.1 (if using shared infrastructure)
```

### 3. Managing Clients via Admin
```bash
# Via Admin Dashboard
1. Navigate to Clients page
2. Click "Add New Client"
3. Fill client information
4. Set up initial admin user
5. Configure branding options
6. Generate initial password for client admin
7. Client receives welcome email with access details
```

## 🔒 Security Features

### Access Control
- **RBAC**: Role-Based Access Control with granular permissions
- **Multi-Tenant Access**: Admin can view/edit any client
- **API Key Management**: Secure API keys for integrations
- **Rate Limiting**: Protection against abuse

### Data Protection
- **Encryption**: TLS 1.3 for all communications
- **Database Security**: Regular backups and point-in-time recovery
- **Access Logging**: Comprehensive audit trails
- **Content Security**: CSP headers and input validation

### Authentication
- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcrypt for stored passwords
- **Multi-Factor Auth**: Optional 2FA support
- **Session Management**: Secure session handling

## 📊 Metrics & Monitoring

### Business Metrics
- **Client Activation Rate**: New clients activated within 30 days
- **User Retention**: Team member retention rates
- **Productivity**: Number of sites created per client
- **Revenue**: Monthly recurring revenue per client

### Technical Metrics
- **System Uptime**: Percentage of time services are available
- **API Response Time**: Average response time for API calls
- **Cost Per Client**: Infrastructure cost allocation
- **Scalability**: Number of clients supported simultaneously

## 🏗️ Development Environment Setup

### Prerequisites
```bash
# Node.js (v18 or higher)
# PostgreSQL or MariaDB
# Docker (optional, recommended)
# AWS CLI or other cloud provider CLI
```

### Local Development
```bash
# Clone repository
cd /path/to/
git clone https://github.com/your-org/nova-agenda.git
cd nova-agenda

# Setup environment variables
cp packages/.env.example packages/api/.env
cp packages/.env.example packages/admin/.env
cp packages/.env.example packages/client-sites/client-a/.env

# Install dependencies
npm install

# Start services
# Option 1: Docker (Recommended)
docker-compose up --build

# Option 2: Individual services
cd packages/api && npm run dev
cd packages/admin && npm run dev
cd packages/client-sites/client-a && npm run dev
```

### Docker Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./packages/api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/novaagenda
    depends_on:
      - db

  admin:
    build: ./packages/admin
    ports:
      - "3002:3002"
    environment:
      - NEXT_PUBLIC_API_BASE=http://localhost:3001
    depends_on:
      - api

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=novaagenda
     
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## 📚 Documentation

### API Reference
- [Auth API](/packages/api/README.md)
- [Client API](/packages/api/README.md)
- [Admin API](/packages/admin/README.md)

### Development Guides
- [Setting Up Development Environment](/docs/development.md)
- [Deploying to Production](/docs/deployment.md)
- [Adding New Features](/docs/feature-development.md)
- [Troubleshooting](/docs/troubleshooting.md)

### Architecture Deep Dive
- [Database Design](/docs/architecture/database.md)
- [Multi-Tenant Strategy](/docs/architecture/multi-tenant.md)
- [Security Architecture](/docs/architecture/security.md)
- [Scalability Design](/docs/architecture/scalability.md)

## 🎯 Future Roadmap

### Phase 1: Core MVP (Months 1-3)
1. **Database and Authentication**: Basic client and user management
2. **Admin Dashboard**: Client CRUD operations
3. **Client Websites**: Basic client portal functionality
4. **Booking System**: Appointment booking integration

### Phase 2: Expansion (Months 4-6)
1. **Advanced Features**: Custom branding, team collaboration
2. **Payments**: Subscription and billing system
3. **Analytics**: Usage metrics and reporting
4. **Mobile Apps**: iOS and Android applications

### Phase 3: Scale (Months 7-12)
1. **Enterprise Features**: Advanced permissions, SLA management
2. **Integrations**: Third-party service integrations
3. **Advanced Analytics**: Machine learning insights
4. **Multi-cloud Support**: AWS, GCP, Azure deployments

## 🔄 Migration Guide

### From Tapai Agenda to Nova Agenda

1. **Data Migration**
   - Extract Tapai client data
   - Transform to Nova Agenda schema
   - Set up Nova Agenda database
   - Test data integrity

2. **Configuration Migration**
   - Map Tapai settings to Nova Agenda equivalents
   - Update branding and configuration
   - Setup subdomains and SSL certificates

3. **Code Migration**
   - Update booking system integration
   - Migrate client configurations
   - Setup admin access
   - Test all functionality

4. **Testing and Validation**
   - End-to-end testing
   - Performance testing
   - Security testing
   - User acceptance testing

## 📧 Support & Community

### Documentation
- [Getting Started Guide](/docs/getting-started.md)
- [API Documentation](/docs/api.md)
- [Configuration Guides](/docs/configuration.md)

### Community
- GitHub Issues: [github.com/your-org/nova-agenda/issues](https://github.com/your-org/nova-agenda/issues)
- Discord: [discord.gg/nova-agenda](https://discord.gg/nova-agenda)
- Twitter: [@novaagenda](https://twitter.com/novaagenda)

### Support
- Technical Support: support@novaagenda.com
- Sales: sales@novaagenda.com
- Enterprise Support: enterprise@novaagenda.com

## 📝 Contributing

### Contributing Guidelines
1. Fork the repository
2. Create a feature branch
3. Follow code style guidelines
4. Write tests for new functionality
5. Submit a pull request

### Code Style
- **JavaScript/TypeScript**: ESLint with Prettier
- **CSS**: Tailwind CSS with @tailwind directives
- **Documentation**: Markdown with MarkdownLint
- **Testing**: Jest with React Testing Library

## 🎁 License

Nova Agenda is licensed under the MIT License. See [LICENSE](/LICENSE) for details.

---

*Building the future of client management with Nova Agenda - one codebase, infinite clients.*