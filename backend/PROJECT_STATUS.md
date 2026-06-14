# Amazon Now Snap — Project Status

**Generated:** June 13, 2026  
**Product Name:** AmazonGo  
**Tagline:** Get everything on the Go

---

## 📊 Current Status: Phase 0 Complete ✅

### Phase 0: Documentation (Week 1) — **COMPLETE**

All foundational documentation is complete and project structure is established:

#### ✅ Documentation Files
- [x] **PRD.md** - Product Requirements Document (Complete)
- [x] **TechSpec.md** - Technical Specification (Complete)
- [x] **AppFlow.md** - Application Flows (Complete)
- [x] **Schema.md** - Database Schema (Complete)
- [x] **ImplementationPlan.md** - Development Plan (Complete)
- [x] **Tracker.md** - Project Tracker (Complete)
- [x] **Rules.md** - Development Rules (Complete)
- [ ] **Design.md** - UI/UX Design Document (Pending)

#### ✅ Project Setup
- [x] README.md created
- [x] .gitignore configured for AWS/Node.js project
- [x] package.json with all dependencies
- [x] tsconfig.json with strict TypeScript settings
- [x] ESLint configuration (.eslintrc.json)
- [x] Prettier configuration (.prettierrc.json)
- [x] Docker Compose for local development (DynamoDB, Redis, OpenSearch)
- [x] .env.example with all configuration variables
- [x] Directory structure created

#### ✅ Source Code Foundation
- [x] Adapter interfaces defined (src/adapters/interfaces.ts)
- [x] Adapter factory created (src/adapters/factory.ts)
- [x] Structured logger utility (src/utils/logger.ts)
- [x] Response formatter utility (src/utils/response.ts)
- [x] Error constants and classes (src/constants/errors.ts)

---

## 📁 Project Structure Created

```
AmazonGo/
├── files/                    # ✅ Complete documentation
│   ├── PRD.md
│   ├── TechSpec.md
│   ├── AppFlow.md
│   ├── Schema.md
│   ├── ImplementationPlan.md
│   ├── Tracker.md
│   └── Rules.md
├── src/                      # ✅ Structure created, starter files added
│   ├── handlers/             # Lambda handlers (Phase 2)
│   ├── services/             # Business logic (Phase 2)
│   ├── clients/              # AWS SDK wrappers (Phase 1)
│   ├── adapters/             # ✅ Interfaces and factory created
│   ├── models/               # TypeScript types (Phase 1)
│   ├── utils/                # ✅ Logger, response utilities created
│   └── constants/            # ✅ Error constants created
├── cdk/                      # Infrastructure (Phase 1)
│   ├── stacks/
│   ├── constructs/
│   └── config/
├── tests/                    # Tests (Phase 2+)
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                  # Seed scripts (Phase 1)
├── .gitignore                # ✅ Created
├── .eslintrc.json            # ✅ Created
├── .prettierrc.json          # ✅ Created
├── tsconfig.json             # ✅ Created
├── package.json              # ✅ Created
├── docker-compose.yml        # ✅ Created
├── .env.example              # ✅ Created
├── README.md                 # ✅ Created
└── PROJECT_STATUS.md         # ✅ This file
```

---

## 🎯 Next Steps: Phase H1 (Hackathon MVP)

### Phase H1.1: Adapter Layer Implementation

**Priority: CRITICAL** — All other features depend on this

#### H1.1.1 Adapter Factory + Interfaces ✅
- [x] Define TypeScript interfaces (COMPLETE)
- [x] Implement factory.ts (COMPLETE)
- [ ] Unit tests: factory returns correct adapter for both flag values

#### H1.1.2 DynamoCacheAdapter (replaces Redis)
- [ ] Create SnapCache DynamoDB table
- [ ] Implement get(key): PK lookup, TTL validation
- [ ] Implement set(key, value, ttlSeconds): PutItem with TTL
- [ ] Implement del(key): DeleteItem
- [ ] Unit tests: cache hit, cache miss, expired entry, set, delete

#### H1.1.3 DynamoSearchAdapter (replaces OpenSearch)
- [ ] Create SnapSearchIndex table + CategoryIndex GSI
- [ ] Implement buildSearchTokens(product): tokenizer
- [ ] DynamoDB Streams processor: SnapProducts → SnapSearchIndex upsert
- [ ] Implement search(query, pincode, category?): tokenize + scan + rank
- [ ] Unit tests: keyword match, category filter, no results

#### H1.1.4 KeywordIntentAdapter (replaces Bedrock)
- [ ] Implement token normalization
- [ ] Implement weighted scoring: name×3, brand×2, tags×2, category×1
- [ ] Implement confidence calculation
- [ ] Implement threshold branching (≥0.75, 0.50-0.74, <0.50)
- [ ] Unit tests: exact match, partial match, ambiguous, no match

#### H1.1.5 RuleBasedRecommendationAdapter (replaces Personalize)
- [ ] Implement tier detection (read SnapUsers.totalOrders)
- [ ] Tier 1: trending products query
- [ ] Tier 2: union of recent + trending
- [ ] Tier 3: frequency sort from SnapPurchaseCadence
- [ ] Write smartCartTier to SnapUsers
- [ ] Unit tests: all three tiers, stock filtering

#### H1.1.6 BarcodeVisionAdapter & BrowserSpeechAdapter
- [ ] BarcodeVisionAdapter: stub implementation (client-side barcode)
- [ ] BrowserSpeechAdapter: stub implementation (transcript pass-through)

### Phase H1.2: Core API Implementation (Hackathon Mode)

**Depends on:** H1.1 (Adapters must be complete first)

- [ ] `GET /v1/products/{productId}` — DynamoDB GetItem
- [ ] `GET /v1/products/barcode/{code}` — FL-10 fast path
- [ ] `GET /v1/products/trending?pincode=` — rule-based
- [ ] `GET /v1/products/search?q=&pincode=` — DynamoSearchAdapter
- [ ] `GET /v1/inventory/{pincode}/{productId}` — SnapCache + DynamoDB
- [ ] `POST /v1/inventory/batch-check`
- [ ] `GET /v1/eta?pincode=&productId=` — rule-based ETA
- [ ] `POST /v1/intent/text` — KeywordIntentAdapter
- [ ] `POST /v1/intent/voice` — accepts transcript → KeywordIntentAdapter
- [ ] `GET /v1/smart-cart` — RuleBasedRecommendationAdapter (3-tier)
- [ ] `POST /v1/orders` — placement with soft-reserve
- [ ] `GET /v1/orders`, `GET /v1/orders/{id}`, `GET /v1/orders/recent`
- [ ] `POST /v1/orders/{id}/reorder`

### Phase H1.3: Hackathon Exit Criteria

- [ ] Full demo flow: barcode scan → stock check → smart cart → order placement
- [ ] Text intent: 8/10 test queries return correct product (confidence ≥0.75)
- [ ] Voice: transcript → correct product
- [ ] Smart cart: all 3 tiers return correct data and labels
- [ ] CloudWatch dashboard: orders/min, latency P50/P99, error rate <1%
- [ ] AWS billing check: total month cost < $5

---

## 🛠️ Getting Started (For Developers)

### Prerequisites

1. **Install Node.js 20.x**
   - Download from: https://nodejs.org/
   - Verify: `node --version` (should show v20.x.x)

2. **Install AWS CLI**
   - Download from: https://aws.amazon.com/cli/
   - Configure: `aws configure`

3. **Install AWS CDK**
   ```bash
   npm install -g aws-cdk
   ```

4. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop
   - Required for local DynamoDB, Redis, OpenSearch

### Initial Setup

```bash
# 1. Clone the repository (if not already done)
cd c:\Users\dell\OneDrive\Desktop\AmazonGo

# 2. Install dependencies
npm install

# 3. Copy environment variables
copy .env.example .env
# Edit .env with your AWS account details

# 4. Start local services (DynamoDB, Redis, OpenSearch)
docker-compose up -d

# 5. Run tests (once implemented)
npm test

# 6. Build the project
npm run build

# 7. Deploy to AWS (Phase 1+)
npm run cdk:deploy:dev
```

### Development Workflow

```bash
# Start local DynamoDB + Redis + OpenSearch
npm run local:all

# Run TypeScript in watch mode
npm run watch

# Run tests in watch mode
npm run test:watch

# Lint and format code
npm run lint:fix
npm run format

# Deploy to dev environment
npm run cdk:deploy:dev

# View CDK diff before deploying
npm run cdk:diff
```

---

## 📋 Quick Reference

### Key Documents
- **Product Vision:** [files/PRD.md](files/PRD.md)
- **Architecture:** [files/TechSpec.md](files/TechSpec.md)
- **Data Models:** [files/Schema.md](files/Schema.md)
- **Development Plan:** [files/ImplementationPlan.md](files/ImplementationPlan.md)
- **Coding Standards:** [files/Rules.md](files/Rules.md)

### Important Concepts

#### Dual Deployment Mode
- **Hackathon Mode (Default):** ~$0/month, AWS Free Tier only, rule-based AI
- **Production Mode:** Pay-per-use, full ML/AI stack
- **Switching:** Flip `ENABLE_*` flags in SSM Parameter Store (no code changes)

#### Adapter Pattern
All AWS service interactions go through adapters:
- `SearchAdapter`: DynamoDB (Hackathon) vs OpenSearch (Production)
- `CacheAdapter`: DynamoDB (Hackathon) vs Redis (Production)
- `RecommendationAdapter`: Rule-based (Hackathon) vs Personalize (Production)
- `IntentResolutionAdapter`: Keyword (Hackathon) vs Bedrock (Production)
- `VisionAdapter`: Barcode (Hackathon) vs Rekognition (Production)
- `VoiceAdapter`: Browser API (Hackathon) vs Transcribe (Production)

#### Three-Tier Smart Cart
- **Tier 1 (0-4 orders):** Trending products (label: "Popular Near You")
- **Tier 2 (5-19 orders):** Hybrid (label: "Based on Your Orders")
- **Tier 3 (20+ orders):** Full Personalize (label: "Your Smart Cart")

---

## 🎨 Design Philosophy

**Backend-first. Multi-client. One source of truth.**

1. **No business logic in clients** — All logic in Lambda
2. **No client-specific APIs** — All clients use same endpoints
3. **Correctness before speed** — Test before ship
4. **Adapters for flexibility** — Easy switch between Hackathon/Production modes

---

## 📞 Team Contacts

- **Project Lead:** [To be assigned]
- **Tech Lead:** [To be assigned]
- **Product Owner:** [To be assigned]
- **Backend Team:** [To be assigned]
- **Frontend Team:** [To be assigned]

---

## 🚀 Timeline

- **Week 1:** Phase 0 — Documentation ✅ **COMPLETE**
- **Week 2-3:** Phase H1 — Hackathon MVP (In Progress)
- **Week 4-6:** Phase 2 — Core Backend APIs
- **Week 7-9:** Phase 3 — AI/ML Integration (Production Mode)
- **Week 10-11:** Phase 4 — Local Testing
- **Week 12-13:** Phase 5 — AWS Deployment
- **Week 14-15:** Phase 6 — Client Integration
- **Week 16-20:** Phase 7 — Frontend Rebuild

---

**Last Updated:** June 13, 2026  
**Status:** Phase 0 Complete, Phase H1 Ready to Start
