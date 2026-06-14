# Amazon Now Snap

**Tagline:** Get everything on the Go

**Version:** 1.2  
**Status:** Phase 0 (Documentation Complete)  
**Region:** AWS ap-south-1 (Mumbai)

---

## 🚀 Product Overview

Amazon Now Snap is a reimagined quick-commerce shopping experience that collapses the traditional `search → browse → decide → checkout` journey into a **single intent-detection moment**: point a camera, speak a sentence, or let the app pre-fill the cart — and confirm in one tap.

**Target:** Buy in under 10 seconds. Your urgent order placed before you blink.

---

## 📁 Project Structure

```
AmazonGo/
├── files/                    # Documentation
│   ├── PRD.md               # Product Requirements Document
│   ├── TechSpec.md          # Technical Specification
│   ├── AppFlow.md           # Application Flows
│   ├── Schema.md            # Database Schema
│   ├── ImplementationPlan.md # Development Plan
│   ├── Tracker.md           # Project Tracker
│   ├── Rules.md             # Development Rules
│   └── Design.md            # UI/UX Design (coming soon)
├── src/                     # Source code (Phase 1+)
│   ├── handlers/            # Lambda handlers
│   ├── services/            # Business logic
│   ├── clients/             # AWS SDK wrappers
│   ├── adapters/            # Adapter pattern for dual deployment
│   ├── models/              # TypeScript types
│   ├── utils/               # Shared utilities
│   └── constants/           # Static constants
├── cdk/                     # AWS CDK Infrastructure (Phase 1+)
│   ├── stacks/              # CDK stacks
│   ├── constructs/          # Reusable constructs
│   └── config/              # Environment configs
├── tests/                   # Tests (Phase 2+)
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # End-to-end tests
└── README.md                # This file
```

---

## 🎯 Core Features

| Feature | Mode | Priority |
|---------|------|----------|
| **Photo-to-Order** | Hackathon: Barcode + Text / Production: Rekognition + Bedrock | P0 |
| **Voice-to-Order** | Hackathon: Web Speech API / Production: Transcribe + Bedrock | P1 |
| **Smart Cart** | Hackathon: Rule-based / Production: Personalize ML | P0 |
| **One-tap Reorder** | Both | P0 |
| **Real-time Stock Filter** | Both | P0 |
| **ETA Before Confirmation** | Both | P0 |
| **AI Best-Match** | Hackathon: Keyword / Production: Bedrock Claude | P0 |

---

## 🏗️ Deployment Modes

### Hackathon Mode (Default)
- **Cost:** ~$0/month (AWS Free Tier)
- **Services:** Lambda, API Gateway, DynamoDB, S3, Cognito, CloudWatch, EventBridge, SNS
- **AI:** Rule-based adapters (no paid AI services)
- **Feature Flags:** All `ENABLE_*` flags set to `false`

### Production Mode
- **Cost:** Pay-per-use
- **Services:** All Hackathon services + OpenSearch, ElastiCache, Bedrock, Rekognition, Transcribe, Personalize
- **AI:** Full ML stack
- **Feature Flags:** `ENABLE_*` flags set to `true` per service

**Switching modes:** Flip feature flags in SSM Parameter Store. No code changes required.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 20.x (TypeScript)
- **Infrastructure:** AWS CDK
- **Database:** Amazon DynamoDB
- **Cache:** ElastiCache Redis (Production) / DynamoDB (Hackathon)
- **Search:** Amazon OpenSearch (Production) / DynamoDB (Hackathon)
- **AI/ML:** Bedrock (Claude 3.5), Rekognition, Transcribe, Personalize
- **Auth:** Amazon Cognito
- **API:** API Gateway HTTP API v2
- **Serverless:** AWS Lambda

---

## 📋 Current Phase: Phase 0 (Documentation)

### Phase 0 Checklist
- [x] PRD.md - Product Requirements Document
- [x] TechSpec.md - Technical Specification
- [x] AppFlow.md - Application Flows
- [x] Schema.md - Database Schema
- [x] ImplementationPlan.md - Development Plan
- [x] Tracker.md - Project Tracker
- [x] Rules.md - Development Rules
- [ ] Design.md - UI/UX Design Document

### Next Phase: Phase H1 (Hackathon MVP)
- Adapter Layer Implementation
- API Implementation (Hackathon Mode)
- Full demo flow: barcode scan → stock check → smart cart → order placement

---

## 🚦 Getting Started

### Prerequisites
- Node.js 20.x
- AWS CLI configured
- AWS CDK installed globally: `npm install -g aws-cdk`
- Docker (for local testing with DynamoDB Local, Redis)

### Setup (Coming in Phase 1)
```bash
# Install dependencies
npm install

# Bootstrap CDK
cdk bootstrap

# Deploy to dev
cdk deploy --all --context env=dev

# Run tests
npm test

# Run local development
npm run dev
```

---

## 📚 Documentation

All project documentation is located in the `files/` directory:

1. **[PRD.md](files/PRD.md)** - Product vision, features, user stories, success metrics
2. **[TechSpec.md](files/TechSpec.md)** - Architecture, AWS services, API design
3. **[AppFlow.md](files/AppFlow.md)** - End-to-end flows for all features
4. **[Schema.md](files/Schema.md)** - DynamoDB tables, OpenSearch indices, Redis patterns
5. **[ImplementationPlan.md](files/ImplementationPlan.md)** - Phase-by-phase development plan
6. **[Tracker.md](files/Tracker.md)** - Task tracking and status
7. **[Rules.md](files/Rules.md)** - Development standards and best practices

---

## 🎨 Design Philosophy

**Backend-first. Multi-client. One source of truth.**

- No business logic in clients
- No client-specific API endpoints
- All clients (mobile, web, future) use the same API
- Correctness before speed
- Test before ship

---

## 📊 Success Metrics (6-Month Targets)

| Metric | Target |
|--------|--------|
| Time-to-order (photo/voice) | < 30 seconds |
| Smart cart acceptance rate | > 40% |
| Reorder rate (one-tap) | > 60% |
| Cart abandonment rate | < 15% |
| Out-of-stock discovery post-cart | < 2% |

---

## 🔐 Security

- Zero secrets in code
- AWS Secrets Manager for production credentials
- IAM least-privilege roles
- TLS 1.3 for all communications
- AES-256 encryption at rest
- DPDP Act (India) compliant

---

## 📞 Contact & Support

- **Project Lead:** [To be assigned]
- **Tech Lead:** [To be assigned]
- **Product Owner:** [To be assigned]

---

## 📄 License

[To be determined]

---

**Built with ❤️ for Amazon Now Snap - Get everything on the Go**
