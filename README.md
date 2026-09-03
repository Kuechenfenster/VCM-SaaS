# VCM SaaS — Vendor Compliance Management

A factory audit and vendor compliance management platform built as a Next.js 14 SaaS application.

## Features

- Role-based access (Admin / Auditor)
- Factory / supplier management
- Configurable checklist templates and sections
- End-to-end audit lifecycle with background timer and GPS tracking
- Photo evidence with camera capture and gallery upload
- Checklist scoring (PASS / FAIL / N/A) with automatic section and overall scores
- Corrective Action Plans (CAPs) with attachments and Excel export
- PDF report generation
- Change history / audit trail

## Technology Stack

- **Framework:** Next.js 14 (App Router, standalone output)
- **Auth:** NextAuth.js v4 + Credentials provider + JWT sessions + bcryptjs
- **Database:** PostgreSQL with Prisma ORM
- **Storage:** AWS S3 or S3-compatible object storage (e.g., MinIO)
- **PDF:** Playwright (Chromium)
- **Excel:** ExcelJS
- **UI:** Tailwind CSS + shadcn/ui-style Radix components + Sonner toasts

## Quick Start (local)

```bash
# 1. Clone the repo
git clone https://github.com/Kuechenfenster/VCM-SaaS.git
cd VCM-SaaS

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Copy environment variables and edit as needed
cp .env.example .env

# 4. Start Postgres and MinIO
docker compose up -d postgres minio createbuckets

# 5. Generate Prisma client, run migrations, and seed demo data
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed.ts

# 6. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with one of the seeded accounts:

| Role   | Email            | Password     |
|--------|------------------|--------------|
| Admin  | john@doe.com     | johndoe123   |
| Auditor| auditor@vcm.com  | auditor123   |

## Local Docker Compose

Run everything (app + Postgres + MinIO) with one command:

```bash
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000).

The first build:
- Applies database migrations
- Seeds demo data because `RUN_SEED=true`

## Deploy to Coolify (vcm.complihq.org)

1. In Coolify, create a new **Application** and select the **GitHub repository** `Kuechenfenster/VCM-SaaS`.
2. Choose **Docker Compose** as the build type and point it to `coolify-compose.yml`.
3. In Coolify, create or link a **PostgreSQL database** resource and expose it to the application.
4. Set the required environment variables in Coolify:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db>?schema=public
NEXTAUTH_URL=https://vcm.complihq.org
NEXTAUTH_SECRET=<random-32-char-secret>
S3_ENDPOINT=https://s3.example.com          # or your MinIO endpoint
S3_REGION=us-east-1
S3_BUCKET=vcm-saas-uploads
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_FORCE_PATH_STYLE=false                    # set true for MinIO
S3_PUBLIC_URL=                               # optional CDN base URL
RUN_SEED=false                               # set true only for first deployment
```

5. Configure the domain `vcm.complihq.org` in Coolify for the application service.
6. Deploy. The entrypoint will run `prisma migrate deploy` on startup.

### Optional: seed on first production deploy

Set `RUN_SEED=true` before the first deploy to create the demo admin/auditor accounts and sample data, then set it back to `false` for subsequent deploys.

## Project Structure

```
app/
  api/          Next.js API routes
  admin/        Admin-only pages (users, templates)
  audits/       Audit list and detail
  caps/         CAP management
  factories/    Factory management
  reports/      Report downloads
  dashboard/    Dashboard home
components/     Shared React components and UI primitives
lib/            Utilities, auth, Prisma client, S3 helpers
prisma/         Prisma schema and seed script
```

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run db:migrate       # Create a migration (dev)
npm run db:deploy        # Deploy migrations (production)
npm run db:seed          # Run seed script
npm run db:generate      # Generate Prisma client
```

## License

Proprietary — CompliHQ.
