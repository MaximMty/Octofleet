# OctoFleet — Yacht Inventory & Fleet Management Platform

Enterprise maritime inventory specification compliance, multi-vessel fleet oversight, role-based access control (`ADMIN`, `MASTER`, `OWNER`), and conflict-safe Google Sheets synchronization.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + Lucide Maritime Icons
- **Database & Auth**: Supabase PostgreSQL + Supabase Auth + Row Level Security (`supabase/migrations/001_initial_schema.sql`)
- **Analytics**: Recharts
- **External Integration**: Server-side Google Sheets Synchronization & Conflict Resolution Engine (`/api/integrations/google-sheets/sync`)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables (Optional for Demo Mode):**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   *Note: If Supabase or Google Service Account credentials are omitted, OctoFleet automatically runs in interactive **Stateful Demo Mode** with realistic maritime seed data and clearly labeled demo spreadsheet telemetry.*

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Run automated tests & production build:**
   ```bash
   npm test
   npm run build
   ```
