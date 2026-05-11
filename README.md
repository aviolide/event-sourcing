# Digital Wallet Platform
### Secure Microservices Architecture with NestJS, GraphQL & Docker

This is a clone of a  **production-grade digital wallet platform** built using **NestJS microservices**, **GraphQL Gateway**, **Kafka**, and **PostgreSQL**, following **Hexagonal Architecture**, **SOLID principles**, **Docker best practices**, and **OWASP Top 10 (2025)** security guidelines.

This project is designed as a **real-world reference architecture** for secure financial systems.
commands
 & "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "Ubuntu" --type headless
 & "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" guestproperty enumerate "Ubuntu"

---

## 🧱 High-Level Architecture

Client (Web / Mobile)
        |
        v
GraphQL Gateway (BFF)
        |
 Auth | Wallet | Payments
        |
     PostgreSQL
        |
      Kafka

---

## 🔐 Security – OWASP Top 10 (2025)

| OWASP Risk | Mitigation |
|-----------|-----------|
Broken Access Control | JWT Guards (Gateway & Services) |
Injection | class-validator + whitelist |
Auth Failures | Access + Refresh token strategy |
Sensitive Data Exposure | bcrypt + JWT secrets |
Security Misconfiguration | Zod env validation |
Excessive Resource Consumption | Rate limiting |
CSRF | Apollo CSRF protection |
Information Disclosure | Error sanitization |
Dependency Risks | Minimal Docker images |
---

# 📚 NestJS Digital Wallet Clone - Detailed Architecture Documentation

Based on my analysis of the repository at `https://github.com/andrucar25/nestjs-digital-wallet-clone`, here is a comprehensive breakdown of the project's architecture, nested modules, DTOs, and design patterns.

---

## 🏗️ High-Level Architecture Overview

```
Client (Web / Mobile)
        │
        ▼
┌───────────────────────┐
│  GraphQL Gateway (BFF)│  ← 00-gateway
│  • Apollo Server      │
│  • JWT Auth Guards    │
│  • Downstream HTTP    │
└────────┬──────────────┘
         │
    ┌────┴────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌─────────┐ ┌────────┐
│ Auth │ │Wallet│ │Payments │ │ Kafka  │
│01-auth││02-wallet││03-payments││ Event Bus│
└──┬───┘ └──┬───┘ └────┬────┘ └────────┘
   │        │          │
   ▼        ▼          ▼
┌─────────────────────────┐
│   PostgreSQL (Shared)   │
│   • TypeORM Entities    │
│   • Auto-sync enabled   │
└─────────────────────────┘
```

### 🔑 Key Technologies
| Technology | Purpose |
|-----------|---------|
| **NestJS** | Microservices framework with dependency injection |
| **GraphQL (Apollo)** | Gateway BFF layer for unified API |
| **Kafka** | Event-driven communication between services |
| **PostgreSQL** | Relational database with TypeORM |
| **Docker** | Containerization with multi-stage builds |
| **Zod** | Runtime environment variable validation |
| **class-validator** | DTO validation with decorators |
| **neverthrow** | Functional error handling (Result/Either pattern) |

---

## 📦 Nested Modules Structure (Hexagonal Architecture)

Each microservice follows **Hexagonal Architecture** (Ports & Adapters) with a consistent nested module pattern:

### 🗂️ Module Folder Structure Template
```
src/
├── config/                    # Global configuration
│   └── env.validation.ts     # Zod schema for env vars
├── core/                      # Shared cross-cutting concerns
│   ├── guards/               # JWT guards, auth strategies
│   ├── exceptions/           # Custom exception classes
│   └── interceptors/         # Logging, error handling
├── modules/
│   ├── [feature]/            # e.g., auth, wallets, users
│   │   ├── domain/           # 🎯 Core business logic (PURE)
│   │   │   ├── repositories/ # Repository interfaces (Ports)
│   │   │   ├── entities/     # Domain entities (User, Wallet)
│   │   │   └── [feature].types.ts  # Domain types/DTOs
│   │   │
│   │   ├── application/      # 🔄 Use cases / Application services
│   │   │   └── [feature].application.ts  # Orchestrates domain logic
│   │   │
│   │   └── infrastructure/   # 🔌 External adapters (Adapters)
│   │       ├── entities/     # TypeORM entities (DB schema)
│   │       ├── presentation/ # Controllers, DTOs, Kafka consumers
│   │       │   ├── dtos/     # Input validation DTOs
│   │       │   ├── [feature].controller.ts
│   │       │   ├── kafka.producer.ts
│   │       │   └── jwt.strategy.ts
│   │       └── [feature].infrastructure.ts  # Repository implementation
│   │
│   └── [feature]/presentation/[feature].module.ts  # Module wiring
└── main.ts                    # Bootstrap
```

### 🔗 Module Dependency Injection Pattern
```typescript
// Example: WalletModule (02-wallet/src/modules/wallets/infrastructure/presentation/wallet.module.ts)
@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity])],
  controllers: [WalletController, WalletKafkaConsumer],
  providers: [
    WalletInfrastructure,           // Adapter implementation
    WalletApplication,              // Use case service
    {
      provide: WalletRepository,    // Domain port interface
      useExisting: WalletInfrastructure, // Inject adapter as port
    },
  ],
  exports: [WalletApplication, WalletRepository], // Expose for other modules
})
export class WalletModule {}
```

### 🔄 Cross-Module Communication
```typescript
// AuthModule imports UsersModule for user operations
imports: [
  TypeOrmModule.forFeature([RefreshToken]),
  ConfigModule,
  UsersModule,  // ← Nested module dependency
  
  // JWT configuration
  JwtModule.registerAsync({...}),
  
  // Kafka client for event emission
  ClientsModule.registerAsync([{
    name: 'AUTH_KAFKA_CLIENT',
    useFactory: (config: ConfigService) => ({
      transport: Transport.KAFKA,
      options: { /* broker config */ }
    })
  }])
]
```

---

## 📋 DTOs (Data Transfer Objects) Implementation

### 🔐 Validation Strategy
All DTOs use **`class-validator`** decorators for runtime validation with **whitelist** enabled to prevent injection attacks.

### 📝 DTO Examples

#### `RegisterDto` - User Registration
```typescript
// 01-auth/src/modules/auth/infrastructure/presentation/dtos/register.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()  // Built-in email format validation
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @MinLength(8)  // OWASP: Minimum password length
  password: string;
}
```

#### `LoginDto` - Authentication
```typescript
// 01-auth/src/modules/auth/infrastructure/presentation/dtos/login.dto.ts
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;  // Accepts email as identifier

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

#### `RefreshTokenDto` - Token Refresh
```typescript
// 01-auth/src/modules/auth/infrastructure/presentation/dtos/refresh-token.dto.ts
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

### 🎯 Domain Types vs Presentation DTOs

| Layer | Purpose | Example |
|-------|---------|---------|
| **Domain Types** | Internal business contracts | `YupiJwtPayload`, `AuthTokens` |
| **Presentation DTOs** | External API input validation | `RegisterDto`, `LoginDto` |
| **Entity Props** | Database mapping | `UserProps`, `WalletEntity` |

```typescript
// Domain type (01-auth/src/modules/auth/domain/auth.types.ts)
export interface YupiJwtPayload {
  sub: string;  // userId
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
```

---

## 🔄 Hexagonal Architecture Flow

### Request Lifecycle Example: User Registration

```
1. HTTP Request → AuthController (Presentation Layer)
   │
   ▼
2. RegisterDto validation via class-validator
   │
   ▼
3. AuthApplication.register() (Application Layer)
   │  • Calls bcrypt.hash() for password
   │  • Creates User domain entity
   │
   ▼
4. UserApplication.save() → AuthRepository.save() (Domain Port)
   │
   ▼
5. AuthInfrastructure.save() (Infrastructure Adapter)
   │  • TypeORM persists to PostgreSQL
   │
   ▼
6. KafkaProducer.emitUserCreated() (Event Adapter)
   │  • Publishes event to Kafka topic
   │
   ▼
7. Response sanitized (no password hash) → Client
```

### Key Architecture Principles

✅ **Dependency Inversion**: Domain layer defines interfaces (`AuthRepository`), infrastructure implements them  
✅ **Pure Domain Logic**: Domain entities (`User`) have no framework dependencies  
✅ **Testability**: Application services can be tested with mock repositories  
✅ **Loose Coupling**: Services communicate via Kafka events, not direct HTTP calls  
✅ **Security by Design**: Passwords never leave application layer; responses are sanitized

---

## 🔐 Security Implementation (OWASP Top 10 2025)

| Risk | Mitigation in Project |
|------|---------------------|
| **Broken Access Control** | `JwtAuthGuard` on protected routes; role-based checks |
| **Injection** | `class-validator` whitelist + TypeORM parameterized queries |
| **Authentication Failures** | Access + Refresh token strategy; bcrypt hashing (12 rounds) |
| **Sensitive Data Exposure** | Passwords never returned; JWT secrets ≥32 chars; error sanitization |
| **Security Misconfiguration** | Zod env validation; GraphQL introspection disabled in prod |
| **Resource Consumption** | Rate limiting ready; Kafka backpressure handling |
| **CSRF** | Apollo CSRF protection configured |
| **Information Disclosure** | `formatError` hides stack traces in production |
| **Dependency Risks** | Minimal Docker images; non-root containers |

### Environment Validation (Zod)
```typescript
// 01-auth/src/config/env.validation.ts
export const envSchema = z.object({
  JWT_SECRET: z.string().min(32, "Must be ≥32 chars for security"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  DB_PASSWORD: z.string().min(1, "Required"),
  // ... other validated env vars
});
```

---

## 🐳 Docker & Deployment Best Practices

### Multi-Service Docker Compose
```yaml
# docker-compose.yaml highlights
services:
  postgres:
    healthcheck: pg_isready  # Ensures DB ready before services start
  
  kafka:
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"  # Dev convenience
  
  gateway:
    depends_on: [auth, wallet, payments]  # Service orchestration
  
  auth/wallet/payments:
    build:
      context: ./0X-service
      dockerfile: Dockerfile  # Multi-stage builds
    environment:
      DB_HOST: postgres  # Service discovery via Docker network
      KAFKA_BROKER: kafka:9092
```

### Dockerfile Best Practices Implemented
```dockerfile
# Multi-stage build example pattern:
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Security: Non-root user
USER node
CMD ["node", "dist/main"]
```

---

## 🚀 Running the Project

```bash
# 1. Copy environment example
cp .env.example .env

# 2. Build and start all services
docker compose build
docker compose up

# Services available at:
# • Gateway: http://localhost:3000/graphql
# • Auth: http://localhost:3010
# • Wallet: http://localhost:3020  
# • Payments: http://localhost:3030
# • Kafka: localhost:9092
# • PostgreSQL: localhost:5432
```

---

## 📚 Learning Resources & Patterns Used

1. **Functional Error Handling**: `neverthrow` library for `Result<T, E>` pattern instead of try/catch [[1]]
2. **Repository Pattern**: Domain interfaces decoupled from TypeORM implementation
3. **CQRS-lite**: Application services orchestrate, domain entities hold state
4. **Event-Driven Architecture**: Kafka for async communication (e.g., `USER_CREATED` events)
5. **BFF Pattern**: GraphQL Gateway aggregates microservice responses for clients

---

> 💡 **Key Takeaway**: This project exemplifies a **production-ready NestJS microservices architecture** that balances strict separation of concerns (Hexagonal) with practical NestJS patterns (Modules, DI). The nested module structure enables independent deployment while maintaining clear boundaries between domain logic, application use cases, and infrastructure concerns.

For deeper exploration, examine:
- `01-auth/src/modules/auth/application/auth.application.ts` - Application service orchestration
- `02-wallet/src/modules/wallets/domain/repositories/wallet.repository.ts` - Domain port definition
- `00-gateway/src/modules/gateway/infrastructure/gateway.module.ts` - GraphQL BFF configuration

Let me know if you'd like me to dive deeper into any specific component! 🎯