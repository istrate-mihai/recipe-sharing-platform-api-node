# Recipe Sharing Platform — Node.js API

> REST API rewrite of the original Laravel backend. Built with Node.js 22, Express 5, Prisma ORM, and PostgreSQL. Deployed on Railway with Cloudflare R2 for image storage and Stripe for subscription billing.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (ESM) |
| Framework | Express 5 |
| ORM | Prisma 5 + PostgreSQL |
| Auth | JWT (jsonwebtoken) |
| File Storage | Cloudflare R2 (S3-compatible) |
| Payments | Stripe (subscriptions) |
| PDF Export | Puppeteer |
| Deploy | Railway + Neon PostgreSQL |

## Features

- **Auth** — register, login, logout, JWT Bearer tokens
- **Recipes** — full CRUD, search, filter by category/difficulty, pagination
- **Images** — multi-image upload with drag-to-reorder, stored on Cloudflare R2
- **Ingredients** — normalized table, ordered
- **Collections** — create/manage recipe collections
- **Favourites & Likes** — toggle endpoints
- **Profile** — public/private profile, avatar upload
- **Subscriptions** — Stripe Checkout, Billing Portal, webhook handler
- **PDF Export** — premium feature, generates recipe card via Puppeteer
- **Sitemap** — dynamic XML sitemap for SEO
- **Free tier limit** — max 10 recipes for non-premium users

## Project Structure

```
src/
├── app.js                        # Express entry point
├── config/
│   ├── database.js               # Prisma client singleton
│   ├── r2.js                     # Cloudflare R2 client
│   └── stripe.js                 # Stripe client
├── middleware/
│   ├── auth.js                   # authenticate() + optionalAuth()
│   ├── premium.js                # requirePremium() + helpers
│   └── upload.js                 # Multer (memory storage)
├── modules/
│   ├── serializers.js            # Response serializers (replaces Laravel Resources)
│   ├── auth/                     # POST /api/auth/{register,login,logout} GET /api/auth/me
│   ├── recipes/                  # GET|POST /api/recipes, CRUD, sitemap, PDF
│   ├── collections/              # CRUD + add/remove recipes
│   ├── favourites/               # GET /api/favourites, POST /api/recipes/:id/favourite
│   ├── likes/                    # POST /api/recipes/:id/like
│   ├── profile/                  # GET|POST /api/profile, GET /api/users/:id
│   ├── subscriptions/            # /api/subscribe, /api/billing-portal, /api/subscription
│   └── webhook/                  # POST /api/webhook/stripe
prisma/
└── schema.prisma                 # Database schema
scripts/
└── migrate-mysql-to-postgres.js  # One-time data migration from Laravel MySQL
```

## API Endpoints

```
POST    /api/auth/register
POST    /api/auth/login
POST    /api/auth/logout
GET     /api/auth/me

GET     /api/recipes                     ?search= &category= &difficulty= &per_page= &page=
POST    /api/recipes
GET     /api/recipes/:id
POST    /api/recipes/:id                 (update — FormData friendly)
DELETE  /api/recipes/:id
GET     /api/recipes/:id/export-pdf      (premium)
POST    /api/recipes/:id/favourite
POST    /api/recipes/:id/like
GET     /api/my-recipes
GET     /api/sitemap.xml

GET     /api/collections
POST    /api/collections
GET     /api/collections/:id
PUT     /api/collections/:id
DELETE  /api/collections/:id
POST    /api/collections/:id/recipes
DELETE  /api/collections/:id/recipes/:recipeId

GET     /api/favourites

GET     /api/profile
POST    /api/profile
GET     /api/users/:id

POST    /api/subscribe
POST    /api/billing-portal
GET     /api/subscription

POST    /api/webhook/stripe

GET     /up
```

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, R2_*, STRIPE_*, FRONTEND_URL

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate deploy

# 5. Start dev server
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=64-byte-random-hex
JWT_EXPIRES_IN=30d

R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
R2_PUBLIC_URL=

STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

FRONTEND_URL=https://recipe-sharing-platform.com
NODE_ENV=production
```

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Data Migration (MySQL → PostgreSQL)

One-time script to migrate existing production data from the Laravel MySQL database.

```bash
# Install migration deps (only needed once)
npm install mysql2 pg

# Configure source + destination
cp .env.migration.example .env.migration
# Fill in MYSQL_* and DATABASE_URL

# Run
node scripts/migrate-mysql-to-postgres.js
```

## Deploy — Railway

1. Connect this repo to a Railway service
2. Add a PostgreSQL service on Railway (or use Neon free tier)
3. Set all environment variables in Railway → Variables
4. Railway auto-deploys on push — build runs `prisma generate` then `prisma migrate deploy && node src/app.js`

## Frontend

Vue 3 frontend repo: [recipe-sharing-platform](https://github.com/istrate-mihai/recipe-sharing-platform)

Update the API base URL in the Vue app after deploy:
```js
const API_URL = 'https://your-railway-url.up.railway.app'
```
