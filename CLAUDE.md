# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **virtual product (software license keys) sales platform** with automated order processing, email notifications, and inventory management. The platform consists of a customer-facing frontend, admin dashboard, and a Fastify-based backend API.

## Architecture

### Tech Stack
- **Backend**: Node.js 20+ with Fastify 4.x, Prisma ORM, PostgreSQL 15+, Redis 7+
- **Frontend**: Next.js 14 (planned, not yet implemented)
- **Language**: JavaScript with ES Modules (`type: "module"`)
- **APIs**: RESTful JSON APIs with `/api/public/*` and `/api/admin/*` routes

### Key Design Patterns
- **Service Layer Architecture**: Business logic isolated in `src/services/*.service.js`
- **Route-Service Separation**: Routes in `src/routes/` delegate to services
- **Encrypted Storage**: License keys encrypted with AES-256-GCM before database storage
- **IP-based Pricing**: Automatic price localization using `geoip-lite`
- **JWT Authentication**: Admin routes protected with `@fastify/jwt`
- **Email Verification**: Redis-based verification codes for order lookup

## Essential Commands

### Development

**Backend**:
```bash
# Backend development (auto-restart with nodemon)
cd backend
npm run dev

# Start backend (production)
npm start

# View database in GUI
npm run db:studio
```

**Frontend**:
```bash
# Frontend development (Next.js dev server)
cd frontend
npm run dev
# Runs on http://localhost:3000

# Build for production
npm run build

# Start production server
npm start
```

**Note**: Backend runs on port 3000 by default, frontend also uses 3000. To avoid conflicts, either:
1. Run backend on a different port (set `PORT=3001` in `backend/.env`)
2. Or configure frontend to use a different port in development

### Database
```bash
# Generate Prisma Client after schema changes
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema without migrations
npm run db:push

# Seed database with test data (5 products, 500 keys, 2 orders, admin user)
npm run db:seed
```

**Important**: After modifying `prisma/schema.prisma`, always run `npm run db:generate` before restarting the server.

### Testing Email Service
```bash
# Start MailPit for development (SMTP server with web UI)
cd "d:\tools\密钥网站"
docker-compose -p mailpit -f docker-compose.mailpit.yml up -d

# View emails at http://localhost:8025
# Backend automatically connects to localhost:1025
```

See `docs/EMAIL_SETUP.md` for production email configuration (SendGrid, SMTP relay, Postal).

## Critical Architecture Details

### Database Models (Prisma)
- **Product**: `name`, `slug`, `descriptionZh/En`, `imageUrl`, `status`
- **Price**: Multi-region pricing with `countryCode`, `currency`, `amount`, `originalAmount`
- **LicenseKey**: Encrypted keys (`keyValueEncrypted`) with status tracking (available/sold/revoked)
- **Order**: `orderNo`, `customerEmail`, payment tracking, order items
- **OrderItem**: Links orders to products/prices/keys
- **VerificationCode**: Email verification for order lookup
- **AdminUser**: `username`, `passwordHash` (bcrypt), JWT authentication
- **SystemSetting**: Key-value config store

### Service Layer Responsibilities
- **product.service.js**: Product CRUD, price calculation by IP, stock checking
- **order.service.js**: Order creation, status management, key assignment
- **payment.service.js**: Alipay/WeChat payment integration, callback verification
- **email.service.js**: Nodemailer-based email sending (verification codes, order confirmations)
- **inventory.service.js**: Low-stock monitoring with WeChat notifications (ServerChan)
- **geo.service.js**: IP → country code mapping for price localization
- **admin.service.js**: Admin authentication, bcrypt password hashing
- **statistics.service.js**: Dashboard metrics (sales, revenue, product counts)

### Route Structure
```
/api/products          → GET products, GET :id, GET :id/price
/api/orders            → POST create, GET :id, POST verification-code, POST verify, GET by-email
/api/payments          → POST alipay, POST wechat, POST alipay/callback, POST wechat/callback
/api/admin/auth        → POST login
/api/admin/dashboard   → GET stats
/api/admin/products    → CRUD operations
/api/admin/license-keys → GET, POST import, PUT :id, DELETE :id
/api/admin/orders      → GET with search/pagination
/api/admin/settings    → GET/PUT system settings
```

### Environment Configuration
Key `.env` variables in `backend/.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for caching/sessions
- `JWT_SECRET`: Admin authentication secret
- `ENCRYPTION_KEY`: 32-byte hex key for license key encryption (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `SMTP_HOST`, `SMTP_PORT`: Email server config
- `EMAIL_FROM`, `EMAIL_FROM_NAME`: Sender information
- `STOCK_ALERT_THRESHOLD`: Low inventory threshold (default: 50)

**Backend listens on**: Port 3000 by default (configurable via `PORT` env var in `backend/.env`)

## Testing Strategy

After seeding database (`npm run db:seed`):
- **Admin credentials**: username `admin`, password `admin123`
- **Test data**: 5 products (Windows 11, Office 2021, Adobe CC, Visual Studio, AutoCAD)
- **Test keys**: 100 keys per product
- **Test orders**: 1 completed order, 1 pending order

Use `docs/TEST_PLAN.md` for comprehensive test cases.

## Common Pitfalls

1. **Prisma Client Out of Sync**: After schema changes, must run `npm run db:generate` AND restart server
2. **Port Conflicts**: Default port 3000 may conflict with other services - configure via `PORT` in `.env`
3. **License Key Encryption**: Keys stored encrypted in DB, decrypted only in service layer. `ENCRYPTION_KEY` must be exactly 32 bytes (64 hex characters)
4. **IP Geolocation**: Local IPs (127.0.0.1) default to `CN` country code - may cause price lookup issues in testing
5. **Email Service**: Must configure SMTP or start MailPit before testing email features
6. **Redis Required**: Backend won't start without Redis connection for verification codes
7. **Windows Path Issues**: Use quotes for paths with spaces in Docker commands (e.g., `cd "d:\tools\密钥网站"`)

## Code Style Conventions

- **ES Modules**: All files use `import/export`, not `require()`
- **Async/Await**: All database/external calls use async/await pattern
- **Error Handling**: Use custom error classes in `middleware/errorHandler.js`
- **Validation**: Zod schemas for request validation
- **Logging**: Fastify's built-in Pino logger
- **Database Transactions**: Use Prisma `$transaction` for multi-step operations (e.g., order creation + key assignment)

## Documentation References

- `docs/00-技术架构文档.md`: Full architecture and tech stack
- `docs/01-数据库设计文档.md`: Complete database schema
- `docs/02-快速开始指南.md`: Setup instructions
- `docs/EMAIL_SETUP.md`: Email service configuration options
- `docs/TEST_PLAN.md`: Comprehensive testing guide
- `prisma/schema.prisma`: Database schema source of truth

## Development Workflow

1. Make changes to code or schema
2. If schema changed: `npm run db:migrate` → `npm run db:generate`
3. Restart dev server if needed (nodemon usually auto-restarts)
4. Test endpoints with curl or Postman
5. Check logs for errors (Pino outputs JSON logs)
6. Use `npm run db:studio` to inspect database state

## Additional Notes

### Generating Encryption Key
For Windows users without OpenSSL:
```bash
# Using Node.js (works on all platforms)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend Development
The `frontend/` directory contains a Next.js 14 (TypeScript) application with:
- **Tech Stack**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui components
- **Key Features**: Product listing, product details, checkout flow, order lookup, admin dashboard
- **Development**: Run `npm run dev` in `frontend/` directory (default port: 3000)
- **API Integration**: Uses axios with React Query for API calls to backend
- **Status**: Actively in development with core pages implemented

**Frontend Pages**:
- `/` - Homepage with product showcase
- `/products` - Product listing page
- `/products/[id]` - Product detail page
- `/orders` - Order lookup page
- `/admin/login` - Admin login
- `/admin` - Admin dashboard (requires authentication)
- `/admin/products`, `/admin/licenses`, `/admin/orders`, `/admin/settings` - Admin management pages

### Payment Integration
- Alipay/WeChat payment requires production API keys and proper configuration
- See `docs/03-支付集成文档.md` for setup details
- Payment callbacks at `/api/payments/alipay/notify` and `/api/payments/wechat/notify`

### Inventory Monitoring
- Runs automatically on interval (default: 3600 seconds)
- WeChat notifications via ServerChan require `SERVERCHAN_SEND_KEY` in `.env`
- Email alerts require proper SMTP configuration
