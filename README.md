# M Routine: Daily Tracker (BMW M Theme)

A high-performance personal web app for daily habit checklist, diet tracking, weekly recurring tasks, future one-off reminders, and a comprehensive SQL-driven performance report.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**, backed by **Neon Postgres** via `@neondatabase/serverless` + **Drizzle ORM**, and ready for **Vercel** deployment.

---

## Features

- **BMW M Theme**: Carbon-black background (`#08080A`), dark surfaces, and signature tri-color diagonal accents (Light Blue `#4FA3FF`, Dark Blue `#0B3A82`, M Red `#E4101E`). Responsive mobile-first design with bottom navigation bar and desktop sidebar.
- **PIN Authentication**: Single-user security gate with bcrypt PIN hash verification and signed JWT session cookies (`jose`). Default PIN: `1234`.
- **Today (Home)**:
  - Dynamic greeting and date in `Asia/Kolkata` timezone.
  - Conic SVG **Progress Ring** showing completed tasks (e.g., 5/8 or 100%).
  - **Checklist** card: instant optimistic tick with streak flame badges.
  - **Diet & Nutrition** card: single tick (Eggs) and interactive counter pips / stepper (Fruits 0/3).
  - **Reminders Due Today**: weekly occurrences and scheduled future deadlines.
  - In-app notification banner for due items.
- **Daily (Manage)**:
  - Add, edit, delete, reorder, and toggle daily items.
  - Seeded starter items: *Brush at night*, *Eggs*, *Fruits (3)*.
- **Weekly**:
  - Interactive Mon–Sun week strip with task indicator dots.
  - Manage tasks that repeat on specific weekdays with optional reminder times.
  - Ticks stored per date occurrence for accurate historical reporting.
- **Future**:
  - One-off reminders grouped into **Overdue**, **Due Today**, **Upcoming**, and **Completed**.
  - Add, edit, delete, and mark done/undone.
- **Report**:
  - Filter by **7 Days / 30 Days / All Time**.
  - Key metrics: Overall completion %, active streak, best streak, and perfect 100% days.
  - Daily completion trend bar chart.
  - Habit heatmap calendar (darker/red = higher completion).
  - Per-item consistency bars and diet metrics (Fruits/day avg vs target; Egg compliance).
  - Best and worst weekday performance comparison.
  - Automated rule-based insights.
  - **Export CSV logs** and **Download JSON database backup**.
- **Settings**:
  - **Change Security PIN**: Update your master login PIN directly inside the app by entering your current PIN. It is automatically hashed with bcrypt and persisted to the Neon database.
  - Timezone selector (defaults to `Asia/Kolkata`).
  - BMW M theme palette specs.
  - **Restore JSON backup** directly into Neon database.
- **PWA (Mobile Web App Ready)**:
  - Full PWA manifest (`manifest.webmanifest`) with standard and maskable icons.
  - Service worker (`sw.js`) with offline caching strategy and install prompt handler (`PwaRegister`).
  - Native standalone display mode without browser address bar.
  - Full-screen iOS Safari support (`apple-mobile-web-app-capable`, `apple-touch-icon`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) + React 18 + TypeScript |
| **Styling** | Tailwind CSS + Lucide Icons |
| **Database** | Neon Serverless Postgres (`@neondatabase/serverless`) |
| **ORM & Migrations** | Drizzle ORM + drizzle-kit |
| **Auth** | `jose` (JWT) + `bcryptjs` (PIN hashing) |
| **Timezone** | `Asia/Kolkata` (computed via `Intl.DateTimeFormat`) |

---

## Quick Start: How to Run Locally

### 1. Prerequisites
- **Node.js**: v18 or later (Node v20+ recommended)
- **Neon Postgres Database**: A free serverless database URL from [Neon](https://neon.tech)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Ensure `.env.local` has your credentials:
```env
DATABASE_URL=postgresql://neondb_owner:password@ep-something-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require
APP_PIN_HASH=$2a$10$Y1AJAX3I13yIYEYBJDY7IOrE42d5mqg6buXuw/MoYL95NaFChTVGu
SESSION_SECRET=bmw_m_routine_secret_key_7c9f8e4a1b2c3d4e5f6a7b8c9d0e1f2
TZ_DEFAULT=Asia/Kolkata
```
> **Default PIN**: `1234` (the provided hash matches `1234`). To use a custom PIN, generate a new hash using:
> `node -e "console.log(require('bcryptjs').hashSync('YOUR_PIN', 10))"`

### 4. Database Setup & Seed
Push the Drizzle schema to Neon and seed starter items:
```bash
# Push tables to Neon
npm run db:push

# Seed starter items (Brush at night, Eggs, Fruits 3x)
npm run db:seed
```

### 5. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:3008](http://localhost:3008)** in your browser:
1. Enter PIN: `1234`
2. Tap **Unlock Tracker** to open the dashboard.

---

## Production Build & Run

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```

---

## Deploying to Vercel

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of M Routine tracker"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. **Import into Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/new).
   - Select the GitHub repository.
3. **Set Environment Variables in Vercel Project Settings**:
   - `DATABASE_URL`: Your pooled Neon connection string (`...-pooler.neon.tech/neondb?sslmode=require`).
   - `APP_PIN_HASH`: Bcrypt hash of your PIN.
   - `SESSION_SECRET`: Random 32+ character string.
   - `TZ_DEFAULT`: `Asia/Kolkata`.
4. **Deploy**:
   - Click **Deploy**.
   - After deployment, open the app on your mobile browser (Safari on iOS or Chrome on Android) and tap **Add to Home Screen** to install as a PWA.

---

## Database Architecture

- **`items`**: Daily habits & diet items (`id`, `name`, `type`, `target_count`, `reminder_time`, `sort_order`, `active`).
- **`daily_logs`**: One row per item per date (`item_id`, `log_date`, `count`, `done`, `updated_at`). Upserted on tick. No daily reset cron job needed.
- **`weekly_tasks`**: Tasks tied to weekdays (`id`, `name`, `weekdays int[]`, `reminder_time`, `active`).
- **`weekly_logs`**: Ticks per weekly task occurrence per date (`task_id`, `log_date`, `done`).
- **`future_reminders`**: One-off reminders with deadlines (`id`, `title`, `notes`, `due_at`, `done_at`).
- **`settings`**: Key-value JSON store for timezone and preferences.

---

## Scope & Deferred Items

As specified in PLAN.md:
- **Phase 1 In-App Reminders Only**: Reminders currently notify via the in-app banner while the app is open. Web Push / background notifications require an external scheduled trigger (due to Vercel Hobby free tier running crons at most once per day).
- **Single-User Architecture**: Purpose-built for single-user security via master PIN. Multi-user OAuth accounts (Clerk / Auth.js) were deferred to a future milestone.

