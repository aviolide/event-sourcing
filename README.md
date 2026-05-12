# Digital Wallet Platform

### Event-Sourced Microservices with Kafka Commands/Events, Saga Orchestration & Projection Reads

A **production-grade digital wallet platform** built with **NestJS microservices**, **GraphQL Gateway**, **Kafka**, **PostgreSQL**, and **Event Sourcing**. Follows **Hexagonal Architecture**, **CQRS** (Command Query Responsibility Segregation), **Saga Orchestration**, and **OWASP Top 10 (2025)** security guidelines.

> **Design principle:** No service calls another service directly. Everything between services goes through Kafka, except public client traffic into the gateway.

---

## Architecture Overview

```
Client (Web / Mobile)
        │
        ▼
┌─────────────────────────────────────┐
│  00-gateway (GraphQL BFF)           │  :3000
│  Apollo Server · JWT Guard          │
│  Command Publisher · Projection API │
└────────────┬────────────────────────┘
             │ Kafka Commands
    ┌────────┴────────┬──────────────┐
    ▼                 ▼              ▼
┌─────────┐    ┌──────────┐    ┌─────────┐
│05-saga  │    │01-auth   │    │03-pay   │
│ :3050   │    │  :3010   │    │  :3030  │
│Saga     │    │Identity  │    │Status   │
│Orchestr.│    │Provider  │    │State    │
└────┬────┘    └────┬─────┘    └────┬────┘
     │              │               │
     │ Kafka Events │ Kafka Events  │ Kafka Events
     └──────────────┼───────────────┘
                    ▼
             ┌────────────┐
             │   Kafka    │
             │ Event Bus  │
             └─────┬──────┘
                   │
     ┌─────────────┼──────────────┬──────────────┐
     ▼             ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│02-wallet │ │04-logging│ │06-proj   │ │03-pay    │
│  :3020   │ │  :3040   │ │  :3060   │ │consumer  │
│Event     │ │Immutable │ │Read-Model│ │          │
│Sourced   │ │Event Store│ │Projection│ │          │
│Ledger    │ │+ Replay  │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Services

| Service | Port | Role | Description |
|---------|------|------|-------------|
| **00-gateway** | 3000 | **Command API + Projection Reader** | GraphQL BFF — Apollo Server, JWT guards, rate limiting. Publishes Kafka commands for mutations. Reads wallet/payment status from projections. |
| **01-auth** | 3010 | **Identity Provider** | User registration, login, JWT issuance (access + refresh tokens), bcrypt hashing. Emits `evt.user.created` directly via Kafka after DB commit. Internal bounded context. |
| **02-wallet** | 3020 | **Event-Sourced Ledger** | Immutable ledger core. Ledger entries: `WalletCreated`, `FundsReserved`, `FundsCredited`, `TransferCommitted`, `FundsReleased`. Snapshots every 100 events. Balance is derived, not mutated directly. |
| **03-payments** | 3030 | **Status/State Service** | Payment record tracking (PENDING → COMPLETED/FAILED). Listens to saga completion/failure events. No orchestration, no HTTP calls to other services. |
| **04-logging** | 3040 | **Immutable Event Store** | Append-only store for **all** Kafka events with full envelope metadata. Exposes replay and inspection REST APIs. |
| **05-saga** | 3050 | **Saga Orchestrator** | Multi-step transfer saga: `reserve` → `credit` → `commit` with `release` compensation on failure. Owns workflow state in `saga_instances` table. |
| **06-projections** | 3060 | **Read-Side Projection** | Pure read models. Consumes events, updates `wallet_balance_view` and `payment_status_view`. Gateway queries from here. |
| **packages/messaging** | — | **Shared Messaging Library** | KafkaEnvelope, Topic registry, KafkaProducerService, InboxGuard — used by all write-side services. |

### Commands vs Events

```
Commands (Intent)                          Events (Facts)
─────────────────────────────────────────────────────────────────
cmd.user.register         →              evt.user.created
cmd.payment.transfer.create →            evt.payment.completed
cmd.wallet.reserve        →              evt.wallet.reserved
cmd.wallet.credit         →              evt.wallet.credited
cmd.wallet.commit         →              evt.wallet.committed
cmd.wallet.release        →              evt.wallet.released
cmd.wallet.refill         →              evt.wallet.credited
                                         evt.payment.failed
```

### Saga Orchestration Flow

```
00-gateway ──► cmd.payment.transfer.create ──► 05-saga
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │   INITIATED  │
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              cmd.wallet.reserve ──► 02-wallet
                                                     │                    │
                                                     ▼                    ▼
                                              ┌──────────────┐   evt.wallet.reserved
                                              │   RESERVING  │          │
                                              └──────┬───────┘          ▼
                                                     │            05-saga ──► cmd.wallet.credit
                                                     ▼                         │
                                              ┌──────────────┐                 ▼
                                              │   RESERVED   │          02-wallet ──► evt.wallet.credited
                                              └──────┬───────┘                         │
                                                     │                                 ▼
                                                     ▼                          05-saga ──► cmd.wallet.commit
                                              cmd.wallet.credit ──► 02-wallet              │
                                                     │                    │                  ▼
                                                     ▼                    ▼           02-wallet ──► evt.wallet.committed
                                              ┌──────────────┐   evt.wallet.credited       │
                                              │   CREDITING  │                            ▼
                                              └──────┬───────┘                     05-saga ──► evt.payment.completed
                                                     │
           Compensation (on failure):                │
                                                     ▼
                                              ┌──────────────┐
                                              │ CREDIT_FAILED│
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              cmd.wallet.release ──► 02-wallet
                                                     │                    │
                                                     ▼                    ▼
                                              ┌──────────────┐   evt.wallet.released
                                              │  RELEASING   │          │
                                              └──────┬───────┘          ▼
                                                     │            05-saga ──► evt.payment.failed
                                                     ▼
                                              ┌──────────────┐
                                              │    FAILED    │
                                              └──────────────┘
```

---

## Key Technologies

| Technology | Purpose |
|-----------|---------|
| **NestJS** | Microservices framework with dependency injection |
| **GraphQL (Apollo)** | Gateway BFF layer — unified API for clients |
| **Kafka (KRaft)** | Command/event bus for async service communication |
| **PostgreSQL 15** | Relational database with TypeORM (per-service) |
| **Event Sourcing** | Immutable ledger entries + snapshots for wallet |
| **CQRS** | Separate command (write) and projection (read) models |
| **Saga Pattern** | Multi-step transaction orchestration with compensation |
| **Docker** | Multi-stage builds, non-root containers |
| **Zod** | Runtime environment variable validation |
| **class-validator** | DTO validation with decorators |
| **neverthrow** | Functional error handling (`Result<T, E>` pattern) |
| **Jest** | Unit, integration, e2e, chaos, and performance tests |

---

## Hexagonal Architecture + Event Sourcing

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
        │   ├── events/            # Domain events (WalletCreated, FundsReserved...)
        │   └── [feature].ts       # Domain entity / aggregate
        ├── application/           # Use-case orchestration
        │   └── [feature].application.ts
        └── infrastructure/        # Adapters (DB, Kafka, HTTP)
            ├── entities/          # TypeORM entities
            │   ├── [feature].entity.ts
            │   ├── [feature]-ledger.entity.ts
            │   └── [feature]-snapshot.entity.ts
            ├── [feature].infrastructure.ts  # Repository impl
            └── presentation/      # Controllers, DTOs, modules
                ├── dtos/
                ├── kafka.consumer.ts
                └── [feature].module.ts
```

### Event Sourcing in Wallet Service

```
┌─────────────────────────────────────────┐
│           Command Handler               │
│  (cmd.wallet.reserve/credit/release)   │
└─────────────────┬───────────────────────┘
                  │ validate command
                  ▼
┌─────────────────────────────────────────┐
│      Append Ledger Events               │
│  wallet_ledger_entries:                │
│  - WalletCreated                        │
│  - FundsReserved                        │
│  - FundsCredited                        │
│  - TransferCommitted                    │
│  - FundsReleased                        │
└─────────────────┬───────────────────────┘
                  │ every 100 events
                  ▼
┌─────────────────────────────────────────┐
│          Snapshot Aggregate               │
│  wallet_snapshots (balance + version)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Update Projection View               │
│  wallet_balance_view (fast reads)      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Publish Result Event              │
│  evt.wallet.reserved / credited         │
└─────────────────────────────────────────┘
```

**Key principles:**
- **Dependency Inversion** — domain defines interfaces, infrastructure implements them
- **Pure Domain** — domain entities have zero framework dependencies
- **Event Sourcing** — ledger is source of truth; balance is derived
- **CQRS** — writes go to ledger, reads come from projection views
- **Inbox Deduplication** — processed message IDs tracked to prevent replays
- **Functional Errors** — `neverthrow` Result types instead of thrown exceptions

---

## GraphQL API (Gateway)

### Mutations (Async — Return ACCEPTED)

| Operation | Auth | Description | Response |
|-----------|------|-------------|----------|
| `register(input)` | No | Register a new user, returns access + refresh tokens | `LoginResponse` |
| `login(input)` | No | Authenticate, returns access + refresh tokens | `LoginResponse` |
| `refresh(input)` | No | Refresh an expired access token | `RefreshResponse` |
| `transfer(input)` | JWT | Create a payment transfer between users | `{ requestId, status: "ACCEPTED" }` |
| `refillWallet(input)` | JWT | Add funds to the authenticated user's wallet | `{ requestId, status: "ACCEPTED" }` |

> **Note:** Transfer and refill are **asynchronous**. The gateway publishes a Kafka command and returns a `requestId`. Poll the projection query or subscribe to events for status updates.

### Queries (Read from Projections)

| Operation | Auth | Description | Source |
|-----------|------|-------------|--------|
| `wallet(userId)` | JWT | Get wallet balance for a user | `06-projections` (wallet_balance_view) |

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
| Idempotency | InboxGuard deduplication prevents double-processing |

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
#   Logging API:        http://localhost:3040/events
#   Saga:               http://localhost:3050
#   Projections:        http://localhost:3060
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
pnpm start:auth        # 01-auth
pnpm start:wallet      # 02-wallet
pnpm start:payments    # 03-payments
pnpm start:logging     # 04-logging
pnpm start:saga        # 05-saga
pnpm start:projections # 06-projections
pnpm start:gateway     # 00-gateway
```

---

## Event Store & Replay (04-logging)

The logging microservice is a **true immutable event store** — it subscribes to all Kafka topics and persists every event with full envelope metadata.

### Replay Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /events/replay?topic=evt.wallet.credited&limit=100` | Replay events by topic |
| `GET /events/correlation/:correlationId` | Trace all events in a saga/correlation |
| `GET /events/aggregate/:aggregateId` | Replay all events for an aggregate |

### Event Log Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated primary key |
| `topic` | varchar | Kafka topic name (cmd.* or evt.*) |
| `messageId` | varchar | Unique message identifier (dedup key) |
| `correlationId` | varchar | Saga/correlation trace ID |
| `causationId` | varchar | Causation chain ID |
| `aggregateId` | varchar | Aggregate root identifier |
| `aggregateType` | varchar | Aggregate type (Wallet, PaymentTransfer...) |
| `aggregateVersion` | integer | Optimistic concurrency version |
| `producer` | varchar | Service that emitted the event |
| `payload` | jsonb | Full event payload |
| `receivedAt` | timestamp | When the event was persisted |

---

## Saga Orchestration (05-saga)

The saga orchestrator is the **only transaction workflow owner**. It manages multi-step transfer workflows with real rollback behavior:

**Saga Flow:**
1. `CMD_PAYMENT_TRANSFER_CREATE` → create saga state (`INITIATED`)
2. `CMD_WALLET_RESERVE` → lock sender funds (`RESERVING` → `RESERVED`)
3. `CMD_WALLET_CREDIT` → add funds to receiver (`CREDITING` → `CREDITED`)
4. `CMD_WALLET_COMMIT` → finalize sender debit (`COMMITTING` → `COMPLETED`)
5. Emit `EVT_PAYMENT_COMPLETED`

**Compensation (on failure):**
- Reserve fails → emit `EVT_PAYMENT_FAILED` immediately
- Credit fails → `CMD_WALLET_RELEASE` (unlock sender funds) → emit `EVT_PAYMENT_FAILED`

**Saga State Table (`saga_instances`):**

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string (unique) | Business identifier (same as gateway requestId) |
| `type` | enum | Saga type (`Transfer`) |
| `status` | enum | `PENDING`, `COMPLETED`, `FAILED`, `COMPENSATING` |
| `step` | enum | `INITIATED`, `RESERVING`, `RESERVED`, `CREDITING`, `CREDITED`, `COMMITTING`, `RELEASING`, `COMPLETED`, `FAILED` |
| `payload` | jsonb | Original command + transferId |
| `lastError` | text | Error message if failed |

---

## Projections (06-projections)

The projection service is the **read side** of CQRS. It consumes all `evt.*` messages and maintains query-optimized views:

| View | Events Consumed | Purpose |
|------|----------------|---------|
| `wallet_balance_view` | `evt.wallet.created`, `evt.wallet.credited`, `evt.wallet.committed` | Fast wallet balance lookups |
| `payment_status_view` | `evt.payment.completed`, `evt.payment.failed` | Payment status tracking |

**Key features:**
- Views can be **wiped and rebuilt** from Kafka or the event store
- Gateway's `wallet(userId)` query reads from `wallet_balance_view`
- Idempotent consumption via `InboxGuard`
- **Pure read models** — no orchestration, no validation, no command emission

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
pnpm test:e2e:wallet      # Wallet ledger, concurrency, Kafka
pnpm test:e2e:payments    # Payment status tracking
pnpm test:e2e:gateway     # Gateway auth guard
pnpm test:e2e:platform    # Full platform flow

# Event sourcing specific tests
pnpm test:aggregate       # Aggregate replay tests
pnpm test:idempotency     # Duplicate event handling
pnpm test:chaos           # Chaos / resilience tests
pnpm test:performance     # Performance tests
```

### Test Types

| Test | Description |
|------|-------------|
| **Aggregate Replay** | Load events → rebuild wallet → assert balance |
| **Idempotency** | Replay same event 3 times → state must remain identical |
| **Chaos Kafka** | Kill wallet container mid-transfer → restart → replay → consistent |
| **Saga Recovery** | Restart saga service mid-flight → flow must resume |
| **Compensation** | Kill receiver mid-credit → sender funds released → no double-spend |

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
├── packages/
│   └── messaging/           # Shared Kafka library (envelope, topics, producer, inbox)
├── 00-gateway/             # GraphQL BFF gateway — commands + projection reads
├── 01-auth/                # Authentication service — emits user lifecycle events
├── 02-wallet/              # Event-sourced wallet ledger — reserve/credit/commit/release
├── 03-payments/            # Payment status/state service — listens to saga events
├── 04-logging/             # Immutable event store + replay API
├── 05-saga/                # Saga orchestrator — multi-step transfer workflow
├── 06-projections/         # Read-side projection service (CQRS)
├── test/                   # Monorepo test suite
│   ├── e2e/               # End-to-end test flows
│   ├── integration/         # Database integration tests
│   ├── shared/              # Test helpers, builders, mocks
│   └── unit/                # Unit tests
├── docker-compose.yaml             # Dev infra (Postgres + Kafka)
├── docker-compose.stage.yaml       # Full stack (infra + services)
├── jest.config.js                  # Monorepo Jest configuration
├── pnpm-workspace.yaml             # pnpm workspace packages
└── package.json                    # Root scripts and shared deps
```

---

## Environment Variables

Each service validates its environment with Zod at startup. See `src/config/env.validation.ts` in each service for the full schema.

### Common Variables

| Variable | Services | Description |
|----------|----------|-------------|
| `PORT` | All | HTTP port |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | auth, wallet, payments, logging, saga, projections | PostgreSQL connection |
| `KAFKA_BROKER` | All | Kafka broker address |
| `KAFKA_GROUP_ID` | wallet, payments, logging, saga, projections | Kafka consumer group |
| `KAFKA_CLIENT_ID` | All | Kafka client identifier (producer) |
| `JWT_SECRET` | gateway, auth, payments | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | auth | Access token TTL (default: 15m) |
| `JWT_REFRESH_SECRET` | auth | Refresh token signing secret |
| `AUTH_SERVICE_URL` | gateway | Auth service base URL (synchronous calls only) |

### Removed Variables

| Variable | Reason |
|----------|--------|
| `WALLET_SERVICE_URL` | Wallet no longer accepts HTTP calls — commands via Kafka |
| `PAYMENTS_SERVICE_URL` | Payments no longer called via HTTP for transfers — saga orchestrates |

---

## Shared Messaging Library (`packages/messaging`)

All write-side services use the shared `@yupi/messaging` package:

### KafkaEnvelope

Every Kafka message carries metadata:

```typescript
interface KafkaEnvelope<T> {
  eventId: string;           // Unique event identifier
  messageId: string;         // Deduplication key
  correlationId: string;     // Saga trace ID
  causationId?: string;       // Previous event ID (causation chain)
  aggregateId: string;        // Entity ID (walletId, paymentId...)
  aggregateType: string;      // Entity type (Wallet, PaymentTransfer...)
  aggregateVersion: number;  // Optimistic concurrency version
  topicVersion: number;      // Schema version (default: 1)
  occurredAt: string;        // ISO timestamp
  producer: string;           // Service name (e.g., "wallet-service")
  payload: T;                // Domain event payload
}
```

### Inbox Deduplication

```typescript
// In Kafka consumer — idempotent consumption
await inboxGuard.process(messageId, topic, async () => {
  // handler logic — only runs if messageId not seen
});
```

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **No Outbox Pattern** | Simplified for v1. Auth emits directly after DB commit. For stricter guarantees, outbox can be re-added later. |
| **Saga owns workflow** | Only the saga service publishes commands to wallet. Payments and gateway do not orchestrate. |
| **Reservation-based ledger** | `reserve` → `credit` → `commit` gives real rollback via `release`. No hidden balance mutation. |
| **Projections are pure reads** | No business logic in projections. They listen and update. Can be wiped and rebuilt. |
| **Inbox deduplication kept** | Essential for safe Kafka replays and duplicate delivery handling. |

---

## License

UNLICENSED
