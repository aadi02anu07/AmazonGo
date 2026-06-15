# AmazonGo — Quick Commerce, Reimagined

> **Get everything on the Go.** Point a camera, speak a sentence, or let the app pre-fill your cart — and confirm in one tap. Your urgent order placed in under 10 seconds.

**Live API:** `https://ro3hqhc695.execute-api.ap-south-1.amazonaws.com`  
**Stack:** Next.js · AWS Lambda · DynamoDB · TypeScript · Cognito  
**Region:** `ap-south-1` (Mumbai)

---

## What is this?

AmazonGo is a quick-commerce platform that solves the UX problem regular e-commerce ignores. The logistics (10-minute delivery) are solved. The interface isn't — most quick-commerce apps are just grocery stores with a faster delivery badge.

This app collapses the `search → browse → decide → checkout` journey into a **single intent moment**:

- 🎤 Say *"I need milk and eggs"* → cart pre-filled, ready to confirm
- 📷 Point at an empty Crocin box → same product ordered, no typing
- 🧠 Open the app → your Smart Cart is already waiting with what you'll likely need

---

## Repo Structure

```
AmazonGo/
├── frontend/          Next.js web app
│   └── src/
│       ├── app/       Pages (home, products, cart, orders, intent-result…)
│       ├── components/ Shared UI components
│       ├── lib/       API client + normalizers
│       └── store/     Zustand state (auth, cart, pincode)
├── backend/           AWS Lambda API
│   ├── src/
│   │   ├── handlers/  Lambda entry points (products, orders, intent, eta…)
│   │   ├── services/  Business logic
│   │   ├── adapters/  Pluggable implementations (Hackathon ↔ Production)
│   │   ├── clients/   DynamoDB client
│   │   ├── models/    TypeScript types + Zod schemas
│   │   └── utils/     Logger, response formatter
│   ├── cdk/           AWS CDK infrastructure
│   ├── scripts/       Seed scripts, table creation, image updater
│   └── tests/         Jest unit + integration tests
├── files/             Project docs (PRD, TechSpec, Schema, AppFlow…)
└── postman/           Postman collection for API testing
```

---

## Tech Stack

### Frontend
| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Data fetching | TanStack Query |
| HTTP | Axios |
| Deployment | AWS Amplify |

### Backend
| | |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Compute | AWS Lambda (Serverless Framework) |
| API | AWS API Gateway HTTP v2 |
| Auth | Amazon Cognito (JWT) |
| Database | Amazon DynamoDB |
| Cache | DynamoDB (Hackathon) / ElastiCache Redis (Production) |
| Search | DynamoDB scan (Hackathon) / Amazon OpenSearch (Production) |
| AI/NLP | Keyword scoring (Hackathon) / Bedrock Claude 3.5 (Production) |
| Vision | Client-side barcode (Hackathon) / Rekognition (Production) |
| Voice | Web Speech API (Hackathon) / AWS Transcribe (Production) |
| Recommendations | Rule-based 3-tier (Hackathon) / Amazon Personalize (Production) |
| IaC | AWS CDK v2 |

---

## Key Features

### 🎤 Voice & Text Intent
Say or type anything natural — *"I want to make pasta tonight"*, *"need paracetamol"*, *"get me Amul butter"*. The intent engine scores against the product catalog and routes you directly to the right product at high confidence, or shows alternatives at medium confidence.

### 🛒 Smart Cart (3-Tier)
Personalizes based on order history:
- **0–4 orders** → Trending products near you
- **5–19 orders** → Blend of recent purchases + trending
- **20+ orders** → Frequency-ranked from your full purchase history

### ⚡ Real-time Stock + ETA
Every product check validates live inventory before you can add to cart. ETA is calculated from the nearest operational dark store and shown before you confirm.

### 🔄 One-tap Reorder
Full order history with a single reorder button. Re-runs a stock check on the original items before placing.

### 🏪 Dark Store Coverage
Currently serving Delhi NCR (110001, 110003, 110023, 110024), Bangalore (560034, 560095), and Mumbai (400050, 400051).

---

## Dual Deployment Mode

The architecture runs in two modes, switchable via feature flags — no code changes needed.

| Adapter | Hackathon Mode (~$0/mo) | Production Mode |
|---|---|---|
| Cache | DynamoDB TTL table | ElastiCache Redis |
| Search | DynamoDB keyword scan | Amazon OpenSearch |
| Intent | Weighted keyword scoring | Bedrock Claude 3.5 |
| Vision | Client-side barcode | AWS Rekognition |
| Voice | Web Speech API transcript | AWS Transcribe |
| Recommendations | Rule-based 3-tier | Amazon Personalize |

Flip flags in SSM Parameter Store:
```
ENABLE_BEDROCK=true
ENABLE_OPENSEARCH=true
ENABLE_REDIS=true
ENABLE_PERSONALIZE=true
ENABLE_REKOGNITION=true
ENABLE_TRANSCRIBE=true
```

---

## API Endpoints

All endpoints require `Authorization: Bearer <cognito-jwt>` except where noted.

```
GET    /v1/products/{productId}
GET    /v1/products/search?q=&pincode=
GET    /v1/products/trending?pincode=
GET    /v1/products/barcode/{code}

GET    /v1/inventory/{pincode}/{productId}
POST   /v1/inventory/batch-check

GET    /v1/eta?pincode=                    (no auth)

POST   /v1/intent/text                     { transcript, pincode }
POST   /v1/intent/voice                    { transcript, pincode }

GET    /v1/smart-cart
POST   /v1/smart-cart/refresh

POST   /v1/orders                          place order
GET    /v1/orders                          order history
GET    /v1/orders/{orderId}
GET    /v1/orders/recent
POST   /v1/orders/{orderId}/reorder
```

Full collection: [`postman/AmazonNowSnap.postman_collection.json`](postman/AmazonNowSnap.postman_collection.json)

---

## Local Development

### Prerequisites
- Node.js 20+
- Docker Desktop
- AWS CLI configured (`aws configure`)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Start local DynamoDB
docker-compose up -d

# Create tables locally
npm run tables:local

# Seed test data (50 products, 3 dark stores, users)
npm run seed:dev

# Start serverless offline
npm run serverless:offline
# → API at http://localhost:3000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env (update NEXT_PUBLIC_API_URL to http://localhost:3000 for local)
cp .env.local.example .env.local

# Start dev server
npm run dev
# → App at http://localhost:3001
```

### Running Tests

```bash
cd backend
npm test                  # all tests
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

---

## DynamoDB Tables

| Table | Purpose |
|---|---|
| `Dev-SnapUsers` | User profiles, order counts, smart cart tier |
| `Dev-SnapProducts` | Product catalog (50 SKUs across 5 categories) |
| `Dev-SnapInventory` | Stock levels per pincode per product |
| `Dev-SnapOrders` | Order records with soft-reserve state |
| `Dev-SnapPurchaseCadence` | Per-user purchase frequency for Tier 3 smart cart |
| `Dev-SnapDarkStores` | Store locations, serviceable pincodes, ETA data |
| `Dev-SnapCache` | DynamoDB-backed cache (TTL enabled) |
| `Dev-SnapSearchIndex` | Keyword search index for Hackathon Mode |

---

## Project Docs

| Doc | Description |
|---|---|
| [`files/PRD.md`](files/PRD.md) | Product vision, personas, feature specs, success metrics |
| [`files/TechSpec.md`](files/TechSpec.md) | Architecture, AWS services, API contracts, adapter pattern |
| [`files/Schema.md`](files/Schema.md) | DynamoDB tables, GSIs, access patterns |
| [`files/AppFlow.md`](files/AppFlow.md) | End-to-end flows (FL-01 through FL-10) |
| [`files/ImplementationPlan.md`](files/ImplementationPlan.md) | Phase-by-phase plan |
| [`files/Tracker.md`](files/Tracker.md) | Task status across all phases |
| [`files/Rules.md`](files/Rules.md) | Coding standards, adapter constraints, test requirements |

---

## Design Principles

- **Backend-first.** All business logic lives in Lambda. Clients are thin.
- **One API, all clients.** Web, mobile, and future platforms share identical endpoints.
- **Adapters, not `if` statements.** Hackathon and Production modes swap implementations, not code paths.
- **Correctness before speed.** Stock is validated twice — at intent resolution and at order placement.
- **Intent over search.** The primary UX entry point is natural language, not a search bar.

---

## License

Private — Amazon Hackathon Project
