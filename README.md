# Amazon Now Snap — Monorepo

> **Get everything on the Go** — Quick-commerce platform powered by AWS Lambda, DynamoDB & TypeScript.

## Structure

| Directory | Description | Status |
|-----------|-------------|--------|
| `backend/` | AWS Lambda API (Node.js + TypeScript + DynamoDB) | ✅ Active |
| `frontend/` | Web app (Next.js / React) | 🚧 Coming soon |
| `mobile/` | Android app | 🚧 Coming soon |

## Quick Start — Backend

```bash
cd backend
npm install
docker-compose up -d dynamodb-local
npm run tables:local
npm run seed:dev
npm run serverless:offline
```

API runs at **http://localhost:3000**

## Repository Layout

```
AmazonGo/
├── backend/          ← AWS Lambda API (Node.js + TypeScript + DynamoDB)
│   ├── src/          ← Application source (handlers, services, clients…)
│   ├── cdk/          ← AWS CDK infrastructure-as-code
│   ├── scripts/      ← Dev utility scripts (seed data, create tables)
│   ├── tests/        ← Unit & integration tests (Jest)
│   ├── serverless.yml
│   ├── package.json
│   └── tsconfig.json
├── frontend/         ← Web app (coming soon)
├── mobile/           ← Android app (coming soon)
├── .husky/           ← Git hooks
├── .kiro/            ← Kiro spec files
├── files/            ← Project documentation assets
├── postman/          ← Postman collections for API testing
└── .gitignore
```

## Tech Stack (Backend)

- **Runtime**: Node.js 20 + TypeScript 5
- **Compute**: AWS Lambda (via Serverless Framework)
- **Database**: Amazon DynamoDB (local via Docker for development)
- **Infrastructure**: AWS CDK v2
- **Auth**: Amazon Cognito
- **Testing**: Jest with ts-jest (~230 tests)
- **Local Dev**: serverless-offline + DynamoDB Local

## Contributing

All backend development happens inside the `backend/` directory.

```bash
cd backend
npm install          # install dependencies
npm test             # run all tests
npm run lint:fix     # fix lint issues
```
