# Amazon Now Snap — Quick Start Guide

**Product:** AmazonGo  
**Tagline:** Get everything on the Go

This guide will get you up and running with the Amazon Now Snap project in under 10 minutes.

---

## 🚀 Step 1: Prerequisites Check

Before you begin, ensure you have these installed:

```bash
# Check Node.js version (must be 20.x or higher)
node --version

# Check npm version (must be 10.x or higher)
npm --version

# Check Docker (for local development)
docker --version

# Check AWS CLI
aws --version
```

If any are missing:
- **Node.js 20.x:** https://nodejs.org/
- **Docker Desktop:** https://www.docker.com/products/docker-desktop
- **AWS CLI:** https://aws.amazon.com/cli/

---

## 📦 Step 2: Install Dependencies

```bash
# Navigate to project directory
cd c:\Users\dell\OneDrive\Desktop\AmazonGo

# Install all npm dependencies (this may take 2-3 minutes)
npm install

# Install AWS CDK globally (if not already installed)
npm install -g aws-cdk
```

---

## ⚙️ Step 3: Environment Configuration

```bash
# Copy the example environment file
copy .env.example .env

# Open .env in your favorite editor and configure:
# - AWS_ACCOUNT_ID (your AWS account ID)
# - AWS_REGION (default: ap-south-1)
# - Other service-specific settings
```

**Note:** The default `.env.example` is pre-configured for Hackathon Mode (all `ENABLE_*` flags set to `false`).

---

## 🐳 Step 4: Start Local Services

For local development, start DynamoDB Local, Redis, and OpenSearch:

```bash
# Start all services in the background
docker-compose up -d

# Verify services are running
docker-compose ps

# You should see:
# - snap-dynamodb-local (port 8000)
# - snap-redis-local (port 6379)
# - snap-opensearch-local (port 9200)
```

**Access OpenSearch Dashboards:** http://localhost:5601 (optional, for debugging search)

---

## 🏗️ Step 5: Build the Project

```bash
# Compile TypeScript to JavaScript
npm run build

# The compiled output will be in the /dist directory
```

---

## ✅ Step 6: Run Tests (Coming in Phase H1)

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

**Note:** Test suites will be implemented in Phase H1.

---

## 🚀 Step 7: Deploy to AWS (Phase 1+)

```bash
# Configure AWS credentials
aws configure

# Bootstrap CDK (first time only)
npm run cdk:bootstrap

# Deploy all stacks to dev environment
npm run cdk:deploy:dev

# Or deploy to staging/production
npm run cdk:deploy:staging
npm run cdk:deploy:prod
```

**Note:** CDK stacks will be implemented in Phase 1.

---

## 🔍 Step 8: Verify Local Setup

Test that your local environment is working:

```bash
# Check DynamoDB Local
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Check Redis
docker exec -it snap-redis-local redis-cli ping
# Should return: PONG

# Check OpenSearch
curl http://localhost:9200
# Should return: OpenSearch cluster info JSON
```

---

## 📚 Step 9: Explore the Documentation

All project documentation is in the `files/` directory:

| Document | Purpose |
|----------|---------|
| [PRD.md](files/PRD.md) | Product vision, features, success metrics |
| [TechSpec.md](files/TechSpec.md) | Architecture, AWS services, API design |
| [AppFlow.md](files/AppFlow.md) | End-to-end flows for all features |
| [Schema.md](files/Schema.md) | DynamoDB tables, data models |
| [ImplementationPlan.md](files/ImplementationPlan.md) | Phase-by-phase development plan |
| [Rules.md](files/Rules.md) | Coding standards and best practices |
| [Tracker.md](files/Tracker.md) | Task tracking and progress |

---

## 🛠️ Development Workflow

### Daily Development

```bash
# 1. Start local services
npm run local:all

# 2. Run TypeScript in watch mode (auto-recompile on save)
npm run watch

# 3. Run tests in watch mode (auto-run on save)
npm run test:watch

# 4. Make your changes in /src

# 5. Lint and format before committing
npm run lint:fix
npm run format

# 6. Commit your changes
git add .
git commit -m "feat(feature): description"
git push
```

### Before Creating a Pull Request

```bash
# 1. Ensure all tests pass
npm test

# 2. Check code coverage (must be ≥80%)
npm test -- --coverage

# 3. Lint check
npm run lint

# 4. Format check
npm run format:check

# 5. Build successfully
npm run build

# 6. CDK synth (if you modified infrastructure)
npm run cdk:synth
```

---

## 🐛 Common Issues and Solutions

### Issue: `npm install` fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rmdir /s /q node_modules
del package-lock.json

# Reinstall
npm install
```

### Issue: Docker services won't start

**Solution:**
```bash
# Stop all containers
docker-compose down

# Remove volumes
docker-compose down -v

# Restart
docker-compose up -d
```

### Issue: DynamoDB Local connection error

**Solution:**
```bash
# Check if DynamoDB Local is running
docker ps | findstr dynamodb

# Verify endpoint in .env
# DYNAMODB_ENDPOINT=http://localhost:8000

# Test connection
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

### Issue: TypeScript errors

**Solution:**
```bash
# Clean build
rmdir /s /q dist

# Rebuild
npm run build

# If errors persist, check tsconfig.json
```

---

## 📊 Monitoring Your Local Development

### View DynamoDB Local Tables

```bash
# List all tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Describe a table
aws dynamodb describe-table --table-name Dev-SnapProducts --endpoint-url http://localhost:8000

# Scan a table (view all items)
aws dynamodb scan --table-name Dev-SnapProducts --endpoint-url http://localhost:8000
```

### View Redis Cache

```bash
# Connect to Redis CLI
docker exec -it snap-redis-local redis-cli

# Inside Redis CLI:
KEYS *                 # List all keys
GET smartcart:user_123 # Get a specific key
TTL smartcart:user_123 # Check TTL
FLUSHALL               # Clear all cache (use with caution!)
```

### View OpenSearch Indices

```bash
# List all indices
curl http://localhost:9200/_cat/indices?v

# Query products index
curl http://localhost:9200/snap-products/_search?pretty

# View OpenSearch Dashboards
# Open browser: http://localhost:5601
```

---

## 🎯 Next Steps

Now that your environment is set up, you're ready to start development!

### For Backend Developers:
1. Read [TechSpec.md](files/TechSpec.md) to understand the architecture
2. Read [Rules.md](files/Rules.md) for coding standards
3. Check [Tracker.md](files/Tracker.md) for available tasks
4. Start with Phase H1.1: Adapter Layer Implementation

### For Frontend Developers:
1. Read [PRD.md](files/PRD.md) to understand product features
2. Read [AppFlow.md](files/AppFlow.md) for user flows
3. Wait for Phase 6 (Client Integration) to begin
4. Review [TechSpec.md § 3](files/TechSpec.md) for API specifications

### For DevOps/Infrastructure:
1. Read [TechSpec.md](files/TechSpec.md) for AWS service architecture
2. Prepare AWS accounts (dev, staging, prod)
3. Set up CI/CD pipeline
4. Configure monitoring and alerting

---

## 📞 Need Help?

- **Documentation Issues:** Check [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Development Questions:** Refer to [Rules.md](files/Rules.md)
- **Architecture Questions:** See [TechSpec.md](files/TechSpec.md)
- **Product Questions:** See [PRD.md](files/PRD.md)

---

## 🎉 You're All Set!

Your Amazon Now Snap development environment is ready. Happy coding!

**Remember:**
- Backend-first. Multi-client. One source of truth.
- Test before ship. Correctness before speed.
- Follow the adapter pattern for Hackathon/Production mode flexibility.

---

**Last Updated:** June 13, 2026  
**Status:** Phase 0 Complete
