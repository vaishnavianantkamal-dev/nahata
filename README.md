# 🌿 Nahata Lawns CRM

**Lead Management & CRM Platform** — Built by Anantkamal Software Labs  
*Build · Automate · Grow*

> "Not a single lead should ever be missed."

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20 LTS
- PostgreSQL (database named `nahata` already created in pgAdmin)
- Redis (optional — if not running, queued jobs are skipped gracefully)
- pnpm (`npm install -g pnpm`)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Run database migration
```bash
cd apps/api
npx prisma migrate dev --schema=prisma/schema.prisma
```

### 3. Seed demo data
```bash
cd apps/api
npx ts-node prisma/seed.ts
```

### 4. Start both servers

**Option A — Use the batch files (Windows):**
Double-click `start-all.bat` — opens API and Web in separate terminals.

**Option B — Two terminals:**
```bash
# Terminal 1 — API
cd apps/api
npx ts-node-dev --respawn --transpile-only src/index.ts

# Terminal 2 — Web
cd apps/web
npx vite
```

### 5. Open the app
- **Web:** http://localhost:5173
- **API:** http://localhost:4000
- **Login:** `owner@nahatalawns.com` / `NahataOwner2024!`

---

## 📋 The 13 Deliverables — All Implemented

| # | Feature | Status |
|---|---------|--------|
| D1 | Unified Lead Inbox (WedMeGood, JustDial, Google Maps, Website) | ✅ |
| D2 | List & Kanban Views | ✅ |
| D3 | Customisable Pipeline (6 stages + Lost) | ✅ |
| D4 | WhatsApp Automation (Trigger 1 + Trigger 2) | ✅ |
| D5 | Template Manager (5 groups, 13 templates) | ✅ |
| D6 | Follow-up Sequences (auto-stop on reply) | ✅ |
| D7 | Dashboard & Analytics (8 KPIs, 5 charts) | ✅ |
| D8 | Reports & Exports (CSV + XLSX) | ✅ |
| D9 | Click-to-Call, IVR & Recording (+91 only) | ✅ |
| D10 | AI Call Summary & Lead Scoring (Hot/Warm/Cold) | ✅ |
| D11 | Source Tagging + Source Editing | ✅ |
| D12 | Duplicate Detection | ✅ |
| D13 | Role-Based Access (Owner/Manager/Agent) | ✅ |

---

## 🏗️ Architecture

```
4 Lead Sources → Unified Inbox → Lead Engine (dedupe + normalise)
                                        ↓
                              WhatsApp Automation Engine
                              (Trigger 1: Lead Created)
                              (Trigger 2: Stage Changed)
                              (Sequences: 0/Day2/Day5)
                                        ↓
                              AI Call Pipeline
                              Click-to-Call → Record → Transcribe → Score
                                        ↓
                              Analytics & Reports Dashboard
```

**Stack:** PostgreSQL · Express · React 18 · Node.js 20  
**Language:** TypeScript everywhere  
**State:** TanStack Query + Zustand  
**UI:** Tailwind CSS + Radix UI  
**Realtime:** Socket.IO  
**Jobs:** BullMQ + Redis  
**Providers:** All behind interfaces, mock adapters run offline

---

## 🔑 Accounts

| Email | Password | Role |
|-------|----------|------|
| owner@nahatalawns.com | NahataOwner2024! | Owner |
| manager@nahatalawns.com | Manager2024! | Manager |
| siyer@nahatalawns.com | Agent2024! | Agent |
| mjoshi@nahatalawns.com | Agent2024! | Agent |

---

## 📡 Webhook Test (simulate a lead from WedMeGood)

```bash
curl -X POST http://localhost:4000/api/v1/webhooks/leads/wedmegood \
  -H "Content-Type: application/json" \
  -d '{"name":"Riya & Raj","mobile":"+919876543200","functionType":"wedding","guests":400}'
```

This creates a lead, fires instant WhatsApp welcome (mock-logged), and enrolls in the follow-up sequence.

---

## 🌿 Environment

Copy `.env.example` to `.env` and configure. All providers default to `mock` — the app runs fully offline.  
Set `WHATSAPP_PROVIDER=meta`, `TELEPHONY_PROVIDER=exotel`, `LLM_PROVIDER=anthropic` when going live.
