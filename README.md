# Digital Wallet Platform

### Secure Microservices Architecture with NestJS, GraphQL & Docker

A **production-grade digital wallet platform** built with **NestJS microservices**, **GraphQL Gateway**, **Kafka**, and **PostgreSQL**, following **Hexagonal Architecture**, **SOLID principles**, **Docker best practices**, and **OWASP Top 10 (2025)** security guidelines.

---

## Architecture Overview

```
Client (Web / Mobile)
        │
        ▼
┌────────────────────────────┐
│  00-gateway (GraphQL BFF)  │  :3000
│  Apollo Server · JWT Guard │
└────────────┬───────────────┘
             │  HTTP
   ┌─────────┼─────────┬──────────────┐
   ▼         ▼         ▼              │
┌──────┐ ┌──────┐ ┌─────────┐        │
│01-auth│ │02-wal│ │03-pay   │        │
│ :3010 │ │ :3020│ │  :3030  │        │
└──┬───┘ └──┬───┘ └────┬────┘        │
   │        │          │              │
   └────────┴────┬─────┘              │
                 ▼                    │
          ┌────────────┐              │
          │   Kafka    │              │
          │ Event Bus  │              │
          └─────┬──────┘              │
                │                     │
   ┌────────────┼────────────┐        │
   ▼            ▼            ▼        │
┌──────┐  ┌──────────┐  ┌────────┐   │
│04-log│  │04-logging │  │02-wal  │   │
│ :3050│  │  :3040    │  │consumer│   │
└──┬───┘  └────┬─────┘  └────────┘   │
   │           │                      │
   └───────────┴──────────────────────┘
                 ▼
       ┌──────────────────┐
       │   PostgreSQL     │
       │   (shared DB)    │
       └──────────────────┘
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **00-gateway** | 3000 | GraphQL BFF — Apollo Server, JWT auth guards, rate limiting. Routes to downstream services via HTTP. |
| **01-auth** | 3010 | Identity provider — user registration, login, JWT issuance (access + refresh tokens), password hashing (bcrypt). Emits `user.created` events. |
| **02-wallet** | 3020 | Financial ledger — manages user wallets and balances. Consumes `user.created` to auto-create wallets. Handles transfers with pessimistic locking. |
| **03-payments** | 3030 | Transaction processing — creates payments, triggers wallet transfers via Kafka. Consumes `wallet.transfer.processed` to update payment status. Supports refill operations. |
| **04-log** | 3050 | User activity log — creates per-user log entries on `user.created` events. Maintains user-scoped ledger records. |
| **04-logging** | 3040 | Append-only event store — consumes **all** Kafka events from every service and persists them to PostgreSQL. Exposes SSE stream + REST API. Includes a live dashboard frontend. |

### Kafka Event Flow

```
01-auth ──► user.created ──────────► 02-wallet (creates wallet)
                                 ├─► 04-log   (creates user log)
                                 └─► 04-logging (persists event)

03-payments ──► wallet.transfer.requested ──► 02-wallet (executes transfer)
                                           └─► 04-logging (persists event)

02-wallet ──► wallet.transfer.processed ──► 03-payments (updates status)
                                         └─► 04-logging (persists event)
```

---

## Key Technologies

| Technology | Purpose |
|-----------|---------|
| **NestJS** | Microservices framework with dependency injection |
| **GraphQL (Apollo)** | Gateway BFF layer — unified API for clients |
| **Kafka (KRaft)** | Event-driven async communication between services |
| **PostgreSQL 15** | Relational database with TypeORM |
| **Docker** | Multi-stage builds, non-root containers |
| **Zod** | Runtime environment variable validation |
| **class-validator** | DTO validation with decorators |
| **neverthrow** | Functional error handling (`Result<T, E>` pattern) |
| **Pact** | Consumer-driven contract testing |
| **Jest** | Unit, integration, e2e, chaos, and performance tests |

---

## Hexagonal Architecture

Each microservice follows **Hexagonal Architecture** (Ports & Adapters):

```
src/
├── config/
│   └── env.validation.ts          # Zod schema for env vars
├── core/
│   ├── guards/                    # JWT guards, auth strategies
│   ├── exceptions/                # Custom typed exceptions
│   └── interceptors/              # Logging, error handling
└── modules/
    └── [feature]/
        ├── domain/                # Core business logic (framework-free)
        │   ├── repositories/      # Port interfaces (abstractions)
        │   └── [feature].ts       # Domain entity
        ├── application/           # Use-case orchestration
        │   └── [feature].application.ts
        └── infrastructure/        # Adapters (DB, Kafka, HTTP)
            ├── entities/          # TypeORM entities
            ├── [feature].infrastructure.ts  # Repository impl
            └── presentation/      # Controllers, DTOs, modules
                ├── dtos/
                ├── kafka.consumer.ts
                ├── kafka.producer.ts
                └── [feature].module.ts
```

**Key principles:**
- **Dependency Inversion** — domain defines interfaces, infrastructure implements them
- **Pure Domain** — domain entities have zero framework dependencies
- **Loose Coupling** — services communicate via Kafka events, not direct calls
- **Functional Errors** — `neverthrow` Result types instead of thrown exceptions

---

## GraphQL API (Gateway)

The gateway exposes the following operations:

### Mutations

| Operation | Auth | Description |
|-----------|------|-------------|
| `register(input)` | No | Register a new user, returns access + refresh tokens |
| `login(input)` | No | Authenticate, returns access + refresh tokens |
| `refresh(input)` | No | Refresh an expired access token |
| `transfer(input)` | JWT | Create a payment transfer between users |
| `refillWallet(input)` | JWT | Add funds to the authenticated user's wallet |

### Queries

| Operation | Auth | Description |
|-----------|------|-------------|
| `wallet(userId)` | JWT | Get wallet balance for a user |

---

## Security — OWASP Top 10 (2025)

| Risk | Mitigation |
|------|------------|
| Broken Access Control | `JwtAuthGuard` on protected routes (gateway + services) |
| Injection | `class-validator` whitelist + TypeORM parameterized queries |
| Authentication Failures | Access + refresh token strategy; bcrypt hashing |
| Sensitive Data Exposure | Passwords never returned; JWT secrets >= 32 chars |
| Security Misconfiguration | Zod env validation; GraphQL introspection disabled in prod |
| Resource Consumption | Rate limiting; GraphQL depth & complexity limits |
| CSRF | Apollo CSRF protection |
| Information Disclosure | `formatError` hides stack traces in production |
| Dependency Risks | Minimal Alpine Docker images; non-root containers |

---

## Running the Project

### Prerequisites

- **Node.js** >= 22
- **pnpm** (via corepack)
- **Docker** & **Docker Compose**

### Quick Start (Docker)

```bash
# 1. Start infrastructure (Postgres + Kafka)
pnpm compose:stage:infra

# 2. Start all services (builds and launches containers)
pnpm start:services

# Services available at:
#   Gateway (GraphQL):  http://localhost:3000/graphql
#   Auth:               http://localhost:3010
#   Wallet:             http://localhost:3020
#   Payments:           http://localhost:3030
#   Logging Dashboard:  http://localhost:3040
#   Kafka:              localhost:9092
#   PostgreSQL:         localhost:5432

# 3. Tear down everything
pnpm compose:stage:down
```

### Local Development (without Docker for services)

```bash
# Install dependencies
pnpm install

# Start infrastructure only
pnpm compose:stage:infra

# Start individual services (each needs its own .env)
pnpm start:auth
pnpm start:wallet
pnpm start:payments
pnpm start:logging
pnpm start:gateway
```

---

## Event Logging & Live Dashboard (04-logging)

The logging microservice acts as an **append-only event store** — it subscribes to all Kafka topics and persists every event to a `event_logs` PostgreSQL table.

- **SSE stream**: `GET http://localhost:3040/events/stream` — real-time event feed via Server-Sent Events
- **REST API**: `GET http://localhost:3040/events?limit=50` — query recent events
- **Dashboard**: `http://localhost:3040` — live web UI with color-coded events, auto-reconnect

The `event_logs` table is append-only (no updates or deletes):

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated primary key |
| `topic` | varchar | Kafka topic name |
| `key` | varchar | Kafka message key (nullable) |
| `payload` | jsonb | Full event payload |
| `receivedAt` | timestamp | When the event was persisted |

---

## Testing

The project includes a multi-tier test suite managed by Jest:

```bash
# Run all tests
pnpm test

# By category
pnpm test:unit            # Unit tests
pnpm test:integration     # Integration tests (Postgres)
pnpm test:e2e             # All e2e suites
pnpm test:e2e:auth        # Auth flows (register, login, refresh)
pnpm test:e2e:wallet      # Wallet transfers, concurrency, Kafka
pnpm test:e2e:payments    # Payment processing
pnpm test:e2e:gateway     # Gateway auth guard
pnpm test:e2e:platform    # Full platform flow
pnpm test:contracts       # Pact consumer-driven contracts
pnpm test:chaos           # Chaos / resilience tests
pnpm test:performance     # Performance tests
```

> **Note:** E2e tests require running infrastructure (Postgres + Kafka). Start with `pnpm compose:stage:infra` first.

---

## Docker

Each service uses a **4-stage multi-stage Dockerfile**:

1. **deps** — installs all dependencies (cached layer)
2. **build** — compiles TypeScript to `dist/`
3. **prod-deps** — installs production-only dependencies
4. **runner** — minimal Alpine image, non-root user, runs `node dist/main.js`

```bash
# Build and run everything
docker compose -f docker-compose.stage.yaml --profile services up -d --build
```

---

## Project Structure

```
.
├── 00-gateway/          # GraphQL BFF gateway
├── 01-auth/             # Authentication service
├── 02-wallet/           # Wallet / ledger service
├── 03-payments/         # Payment processing service
├── 04-log/              # User activity log service
├── 04-logging/          # Append-only event store + SSE dashboard
├── test/                # Monorepo test suite
│   ├── e2e/             # End-to-end test flows
│   ├── integration/     # Database integration tests
│   ├── shared/          # Test helpers, builders, mocks
│   └── unit/            # Unit tests
├── docker-compose.yaml          # Dev infra (Postgres + Kafka)
├── docker-compose.stage.yaml    # Full stack (infra + services)
├── jest.config.js               # Monorepo Jest configuration
├── pnpm-workspace.yaml          # pnpm workspace packages
└── package.json                 # Root scripts and shared deps
```

---

## Environment Variables

Each service validates its environment with Zod at startup. See `src/config/env.validation.ts` in each service for the full schema. Common variables:

| Variable | Services | Description |
|----------|----------|-------------|
| `PORT` | All | HTTP port |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | auth, wallet, payments, log, logging | PostgreSQL connection |
| `KAFKA_BROKER` | wallet, payments, log, logging | Kafka broker address |
| `KAFKA_GROUP_ID` | wallet, payments, log, logging | Kafka consumer group |
| `KAFKA_CLIENT_ID` | payments, logging | Kafka client identifier |
| `JWT_SECRET` | gateway, auth, payments | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | auth | Access token TTL (default: 15m) |
| `JWT_REFRESH_SECRET` | auth | Refresh token signing secret |
| `WALLET_SERVICE_URL` | payments | Wallet service base URL |
| `AUTH_SERVICE_URL` | gateway | Auth service base URL |
| `PAYMENTS_SERVICE_URL` | gateway | Payments service base URL |
