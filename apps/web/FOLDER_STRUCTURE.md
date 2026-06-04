# Nahata CRM — Web App Folder Structure

```
apps/web/src/
│
├── app/                        # App-level wiring
│   ├── router.tsx              # All React Router routes (protected + public)
│   └── providers.tsx           # TanStack Query, Toast, global providers
│
├── components/
│   ├── ui/                     # Primitive UI components (shadcn/Radix based)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── toast.tsx
│   │   └── toaster.tsx
│   │
│   └── dashboard/              # Dashboard-specific widgets & charts
│       ├── KpiCard.tsx         # Single KPI stat card with delta arrow
│       ├── EnquiriesByWeekChart.tsx  # Bar chart — weekly enquiry volume
│       ├── LeadsBySourceChart.tsx    # Donut chart — source breakdown
│       ├── ConversionFunnelChart.tsx # Horizontal funnel — stage progression
│       ├── SourcePerformanceChart.tsx # Bar list — win rate per source
│       └── index.ts            # Barrel export
│
├── features/                   # Page-level feature modules (one folder per module)
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx   # Assembles KpiCards + chart components
│   ├── leads/
│   │   ├── LeadsPage.tsx       # List view with search/filter/sort
│   │   ├── LeadDetailPage.tsx  # Detail + timeline + WhatsApp + Calls tabs
│   │   └── NewLeadModal.tsx    # Create lead dialog
│   ├── pipeline/
│   │   └── PipelinePage.tsx    # Kanban board with dnd-kit drag-and-drop
│   ├── whatsapp/
│   │   └── WhatsAppPage.tsx    # Automation overview + sequence viewer
│   ├── templates/
│   │   └── TemplatesPage.tsx   # Template group cards + add/edit/delete
│   ├── reports/
│   │   └── ReportsPage.tsx     # CSV/XLSX export controls
│   └── settings/
│       └── SettingsPage.tsx    # Stages, team, sequences, venue config
│
├── hooks/
│   └── use-toast.ts            # Toast notification state
│
├── layouts/
│   └── AppShell.tsx            # Fixed sidebar + responsive header + <Outlet/>
│
├── lib/
│   ├── api.ts                  # Axios instance with JWT + auto-refresh
│   ├── socket.ts               # Socket.IO client singleton
│   └── utils.ts                # cn(), formatters, color helpers
│
├── store/
│   └── auth.ts                 # Zustand auth store (user + token)
│
├── styles/
│   └── globals.css             # Tailwind base + custom utilities
│
└── main.tsx                    # React entry point
```

## Design decisions

| Decision | Rationale |
|----------|-----------|
| `features/` for pages | Groups all the logic, queries and JSX for a feature in one place |
| `components/dashboard/` for widgets | Dashboard charts are reusable widgets, not page logic |
| `components/ui/` for primitives | Keeps shadcn/Radix atoms separate from feature-specific components |
| `layouts/` for AppShell | The shell is shared infrastructure, not a feature |
| `lib/` for utilities | Stateless helpers: API client, socket, formatters |
| `store/` for Zustand | Keeps persistent client state isolated |

## Fonts
- **Headings / KPI numbers:** `font-display` → Poppins 600/700
- **Body / labels / tables:** `font-sans` → Inter 400/500

## Colour tokens (Tailwind)
- `evergreen-700` `#1F5C45` — primary brand / sidebar active
- `gold-500` `#C9A24B` — accent / badge highlights
- `cream` `#FAF8F5` — app background
