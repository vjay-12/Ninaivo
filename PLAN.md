# M Routine: Daily Tracker (BMW M Theme)

A personal web app for daily checklist, diet tracking, weekly reminders, future reminders and a report tab. Data is stored in **Neon (Postgres)** and the app is deployed on **Vercel**. The look is inspired by the BMW M colour stripes on carbon black. No car images are used, only the colour theme.

---

## 1. Goals

- Tick off daily habits (brush at night, etc.) and diet items (eggs, 3 fruits).
- Weekly reminders tied to weekdays, and one-off future reminders with date and time.
- Every tick is saved per day, so a **Report** tab can analyse history.
- Works well on a phone (installable as a PWA) and on desktop.
- Free to run on Vercel Hobby + Neon Free.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One project for UI and API, first-class Vercel support |
| Styling | **Tailwind CSS** + CSS variables | Fast, easy theming |
| Database | **Neon Postgres** via `@neondatabase/serverless` | Serverless-friendly, free tier |
| ORM | **Drizzle ORM** + drizzle-kit migrations | Light, type-safe, works well with Neon |
| Data fetching | Server Actions + SWR (optimistic UI) | Instant tick feedback |
| Charts | **Recharts** (or hand-built SVG) | Bars, lines, heatmap |
| Auth | Single-user **PIN login** (env var + signed cookie via `jose`) | The app is public on the internet, so the DB must be protected |
| PWA | `manifest.json` + service worker | "Add to Home Screen" on phone |
| Hosting | **Vercel** | Git push to deploy |

> Optional later: multi-user login with Auth.js or Clerk.

## 3. Features by Tab

### Today (home)
- Greeting and date, with a **progress ring** (e.g. 5/8 done).
- **Checklist** card: tap to tick, with a check animation.
- **Diet** card: tick items (eggs) and counter items (fruits 0/3, with +/- or three tappable pips).
- **Reminders due today** (weekly + future).
- Streak flame next to each item.

### Daily (manage)
- Add, edit, delete, reorder daily items.
- Fields: name, type (checklist or diet), target count (1 = simple tick, 3 = fruits), reminder time, active toggle.
- Starter items: *Brush at night*, *Eggs*, *Fruits (3)*.

### Weekly
- Week strip Mon to Sun, with a dot on days that have tasks.
- Tasks repeat on chosen weekdays, with an optional time.
- Tick per occurrence, so history is kept.

### Future
- One-off reminders with title, date, time and notes.
- Groups: **Overdue**, **Today**, **Upcoming**, **Done**.

### Report
- Range switch: **Week / Month / All time**.
- Cards: overall completion %, current streak, best streak, perfect days.
- Charts:
  - Daily completion % (bar or line trend).
  - Heatmap calendar (darker = more done).
  - Per-item completion bars.
  - Diet: average fruits per day vs target; egg days vs missed.
  - Best and worst weekday.
- Auto-insights, e.g. "You skip *Brush at night* most on Fridays."
- Export CSV and JSON backup.

### Settings
- Timezone (default `Asia/Kolkata`), theme intensity, PIN change, export and import.

## 4. Database Schema (Neon / Postgres)

```sql
-- Daily checklist + diet items
create table items (
  id            serial primary key,
  name          text not null,
  type          text not null check (type in ('checklist','diet')),
  target_count  int  not null default 1,      -- 1 = tick, 3 = fruits
  reminder_time time,
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- One row per item per day (upsert on tick)
create table daily_logs (
  id        serial primary key,
  item_id   int  not null references items(id) on delete cascade,
  log_date  date not null,                    -- the user's local date
  count     int  not null default 0,
  done      boolean not null default false,   -- count >= target_count
  updated_at timestamptz not null default now(),
  unique (item_id, log_date)
);

-- Weekly recurring tasks
create table weekly_tasks (
  id            serial primary key,
  name          text not null,
  weekdays      int[] not null,               -- 0=Sun ... 6=Sat
  reminder_time time,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table weekly_logs (
  id       serial primary key,
  task_id  int  not null references weekly_tasks(id) on delete cascade,
  log_date date not null,
  done     boolean not null default true,
  unique (task_id, log_date)
);

-- One-off future reminders
create table future_reminders (
  id         serial primary key,
  title      text not null,
  notes      text,
  due_at     timestamptz not null,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create table settings (
  key   text primary key,
  value jsonb not null
);

create index on daily_logs (log_date);
create index on weekly_logs (log_date);
create index on future_reminders (due_at);
```

**Key design decisions**
- **No daily reset job needed.** A day is just a date. A missing `daily_logs` row means "not done", and the first tick creates the row.
- **Dates are stored as local dates** (computed in the user's timezone), so "today" never shifts because of UTC.
- **Streaks and report numbers are computed with SQL** from the logs, with nothing duplicated.
- Editing an item's target later does not rewrite history, since `done` is stored per log row.

## 5. API / Server Actions

| Action | Purpose |
|---|---|
| `login(pin)` / `logout()` | Set or clear the signed session cookie |
| `getToday(date)` | Items + today's logs + due reminders in one query |
| `setCount(itemId, date, count)` | Upsert tick or counter |
| `CRUD items` / `weekly_tasks` / `future_reminders` | Manage tabs |
| `toggleWeekly(taskId, date)` | Tick weekly occurrence |
| `completeFuture(id)` | Mark reminder done |
| `getReport(range)` | Aggregates for the report |
| `exportData()` / `importData(json)` | Backup and restore |

All actions check the session cookie first.

## 6. Design System: "M Stripe on Carbon"

### Palette (taken from the reference stripes)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08080A` | App background (carbon black) |
| `--surface` | `#111216` | Cards |
| `--surface-2` | `#1A1C22` | Raised or hover |
| `--m-light` | `#4FA3FF` | Primary accent, checklist |
| `--m-dark` | `#0B3A82` | Secondary accent, borders, gradients |
| `--m-red` | `#E4101E` | Highlights, streaks, overdue, CTA |
| `--text` | `#F3F5F8` | Main text |
| `--muted` | `#8A92A3` | Secondary text |

The signature gradient is a **three-stripe accent**: light blue, dark blue and red, set at a diagonal angle (about 60°).

### Section colours
- Checklist: light blue
- Diet: red
- Weekly: dark blue (brightened for contrast)
- Future: gradient of all three

### Visual language
- **Carbon fibre texture:** a subtle repeating CSS pattern on the body background (low opacity).
- **Diagonal M-stripe:** a thin three-colour slanted bar as the header accent, section dividers and progress-ring track.
- **Cards:** dark surface, 1px border, soft inner glow in the section colour, rounded corners (16px).
- **Checkboxes:** large (28px) skewed or rounded squares. On tick they fill with the section colour and a stripe sweeps across.
- **Progress ring:** conic gradient in the three M colours with a glowing end cap.
- **Typography:** *Barlow Condensed* (bold, uppercase, tracked) for headings and numbers, and *Inter* for body text, both through `next/font`.
- **Motion:** quick (150–250ms) ease-out transitions. Tick pulse, ring fill animation, and stripe sweep when a day hits 100%. Respect `prefers-reduced-motion`.
- **Layout:** bottom tab bar on mobile with five icons and the active tab marked by a stripe underline. On desktop, a left sidebar and a centred content column.
- **Dark only** (the M theme looks best dark), with a high-contrast text ratio.

### Accessibility
- Minimum 44px tap targets.
- Colour is never the only signal (icons and labels are used too).
- Visible focus rings in `--m-light`.

## 7. Project Structure

```
m-routine/
├─ app/
│  ├─ (app)/
│  │  ├─ today/page.tsx
│  │  ├─ daily/page.tsx
│  │  ├─ weekly/page.tsx
│  │  ├─ future/page.tsx
│  │  ├─ report/page.tsx
│  │  └─ layout.tsx            # tab bar / sidebar
│  ├─ login/page.tsx
│  ├─ actions/                 # server actions
│  ├─ globals.css              # tokens, carbon texture, stripe utilities
│  └─ manifest.ts
├─ components/                 # ProgressRing, CheckRow, CounterPips, StripeBar, charts...
├─ db/
│  ├─ schema.ts                # Drizzle schema
│  ├─ index.ts                 # Neon client
│  └─ seed.ts                  # starter items
├─ lib/                        # auth, dates/timezone, report queries
├─ drizzle.config.ts
├─ middleware.ts               # protect routes
└─ PLAN.md
```

## 8. Reminders and Notifications

- **Phase 1 (in-app):** while the app is open, due reminders show a banner and optionally a browser notification.
- **Phase 2 (true push):** PWA + Web Push. Note that **Vercel Hobby cron runs at most once per day**, so exact-time push needs either an external free scheduler (e.g. cron-job.org hitting an API route) or a Vercel Pro plan. This is an honest limitation to decide on later.

## 9. Environment Variables

```
DATABASE_URL=postgres://...neon.tech/...?sslmode=require
APP_PIN_HASH=<bcrypt hash of your PIN>
SESSION_SECRET=<random 32+ chars>
TZ_DEFAULT=Asia/Kolkata
```

Set these in `.env.local` for development and in the Vercel project settings for production. Never commit them.

## 10. Build Phases

| Phase | Deliverable |
|---|---|
| **1. Setup** | Next.js + Tailwind, Neon project, Drizzle schema, migrations, seed |
| **2. Auth + shell** | PIN login, middleware, theme tokens, tab bar, carbon + stripe styling |
| **3. Today + Daily** | Core tick flow, counters, manage items, optimistic updates |
| **4. Weekly + Future** | Week strip, recurring tasks, reminders groups |
| **5. Report** | SQL aggregates, summary cards, charts, heatmap, insights |
| **6. Polish** | Animations, PWA install, export/import, empty states, mobile QA |
| **7. Deploy** | Connect repo to Vercel, add env vars, run migrations, test on phone |

## 11. Deployment Steps (Neon + Vercel)

1. Create a Neon project and copy the **pooled** connection string.
2. Push the code to GitHub.
3. Import the repo in Vercel, add the env vars from section 9.
4. Run `drizzle-kit push` (or migrate) against the Neon database, then run the seed.
5. Deploy, open the URL on your phone and choose **Add to Home Screen**.

## 12. Risks and Notes

- **Cold starts:** Neon free tier sleeps when idle, so the first load after a break can take about a second. This is fine for personal use.
- **Timezone bugs:** always compute "today" in the user's timezone, not the server's (Vercel runs in UTC).
- **Security:** the PIN gate and signed cookie are enough for one person. Add rate limiting on login.
- **Backups:** keep the export button, and Neon also offers point-in-time restore on the free tier within a short window.

## 13. Decisions to Confirm

- [ ] Single-user PIN login (default) or full accounts?
- [ ] Fruits as one counter (0/3) or three separate ticks?
- [ ] Is in-app reminder only OK for v1, with true push later?
- [ ] Timezone: Asia/Kolkata?
