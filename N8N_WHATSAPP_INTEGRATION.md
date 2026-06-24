# n8n WhatsApp Integration — PostgreSQL Reference

Database: `postgresql://postgres:anantkamal2002@localhost:5432/nahata`

---

## 1. LEAD TABLE — Complete Column Definition

```sql
CREATE TABLE "Lead" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  primaryPhone  TEXT NOT NULL,
  altPhone      TEXT,
  email         TEXT,
  source        LeadSource NOT NULL,
  sourceDetail  TEXT,
  eventType     EventType NOT NULL,
  guestCount    INTEGER,
  eventDate     TIMESTAMP,
  budgetMin     INTEGER,
  budgetMax     INTEGER,
  stageId       TEXT NOT NULL,
  status        LeadStatus DEFAULT 'OPEN',
  ownerId       TEXT,
  score         INTEGER,
  scoreBand     ScoreBand DEFAULT 'UNSCORED',
  lastContactAt TIMESTAMP,
  firstResponseAt TIMESTAMP,
  nextFollowUpAt  TIMESTAMP,
  notes         TEXT,
  lostReason    TEXT,
  externalRef   TEXT,
  isArchived    BOOLEAN DEFAULT false,
  createdAt     TIMESTAMP NOT NULL DEFAULT now(),
  updatedAt     TIMESTAMP NOT NULL DEFAULT now(),
  deletedAt     TIMESTAMP
);
```

### Lead Column Details

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | - | Primary key (UUID) |
| name | TEXT | NO | - | Lead name |
| primaryPhone | TEXT | NO | - | **MUST be normalized: +91XXXXXXXXXX format** |
| altPhone | TEXT | YES | NULL | Alternative phone |
| email | TEXT | YES | NULL | Email address |
| source | TEXT (enum) | NO | - | Use: `WHATSAPP_INBOUND` |
| sourceDetail | TEXT | YES | NULL | Extra metadata |
| eventType | TEXT (enum) | NO | - | Use: `WEDDING`, `RECEPTION`, `ENGAGEMENT`, `SANGEET`, `BIRTHDAY`, `CORPORATE`, `OTHER` |
| guestCount | INTEGER | YES | NULL | Expected guest count |
| eventDate | TIMESTAMP | YES | NULL | Event date |
| budgetMin | INTEGER | YES | NULL | Minimum budget (in paisa: 100000 = ₹1 lakh) |
| budgetMax | INTEGER | YES | NULL | Maximum budget |
| stageId | TEXT | NO | - | **FK to Stage table. Use: `cmpz2fo7s0004pdzqogtt4b71` for "New Lead"** |
| status | TEXT (enum) | YES | 'OPEN' | Use: `OPEN`, `WON`, `LOST` |
| ownerId | TEXT | YES | NULL | FK to User (assigned agent) |
| score | INTEGER | YES | NULL | Lead scoring 0-100 |
| scoreBand | TEXT (enum) | YES | 'UNSCORED' | Auto-calculated: `HOT`, `WARM`, `COLD`, `UNSCORED` |
| lastContactAt | TIMESTAMP | YES | NULL | Last contact timestamp |
| firstResponseAt | TIMESTAMP | YES | NULL | When lead first replied |
| nextFollowUpAt | TIMESTAMP | YES | NULL | Scheduled follow-up |
| notes | TEXT | YES | NULL | Internal notes (append location here) |
| lostReason | TEXT | YES | NULL | If status=LOST |
| externalRef | TEXT | YES | NULL | External ID (e.g., from Meta) |
| isArchived | BOOLEAN | YES | false | Archive flag |
| createdAt | TIMESTAMP | NO | now() | Creation timestamp |
| updatedAt | TIMESTAMP | NO | now() | Last update timestamp |
| deletedAt | TIMESTAMP | YES | NULL | Soft delete |

---

## 2. MESSAGE TABLE — Complete Column Definition

```sql
CREATE TABLE "Message" (
  id                TEXT PRIMARY KEY,
  leadId            TEXT NOT NULL,
  userId            TEXT,
  direction         MessageDirection NOT NULL,
  channel           MessageChannel NOT NULL,
  status            MessageStatus DEFAULT 'QUEUED',
  body              TEXT NOT NULL,
  templateId        TEXT,
  trigger           AutomationTrigger,
  providerMessageId TEXT,
  providerStatusRaw JSON,
  errorMessage      TEXT,
  sentAt            TIMESTAMP,
  deliveredAt       TIMESTAMP,
  readAt            TIMESTAMP,
  receivedAt        TIMESTAMP,
  createdAt         TIMESTAMP NOT NULL DEFAULT now(),
  updatedAt         TIMESTAMP NOT NULL DEFAULT now()
);
```

### Message Column Details

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | - | Primary key (UUID) |
| leadId | TEXT | NO | - | FK to Lead.id (required) |
| userId | TEXT | YES | NULL | FK to User (if agent-sent) |
| direction | TEXT (enum) | NO | - | Use: `INBOUND` or `OUTBOUND` |
| channel | TEXT (enum) | NO | - | Use: `WHATSAPP` (or `SMS`) |
| status | TEXT (enum) | YES | 'QUEUED' | Use: `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `RECEIVED` |
| body | TEXT | NO | - | Message text |
| templateId | TEXT | YES | NULL | FK to Template (if template-based) |
| trigger | TEXT (enum) | YES | NULL | Use: `LEAD_CREATED`, `STAGE_CHANGED`, `MANUAL` |
| providerMessageId | TEXT | YES | NULL | **CRITICAL: Meta's message ID for idempotency** |
| providerStatusRaw | JSON | YES | NULL | Raw webhook status from Meta |
| errorMessage | TEXT | YES | NULL | Error details if status=FAILED |
| sentAt | TIMESTAMP | YES | NULL | When sent |
| deliveredAt | TIMESTAMP | YES | NULL | When delivered (Meta webhook) |
| readAt | TIMESTAMP | YES | NULL | When read (Meta webhook) |
| receivedAt | TIMESTAMP | YES | NULL | **When inbound message received** |
| createdAt | TIMESTAMP | NO | now() | Record creation |
| updatedAt | TIMESTAMP | NO | now() | Last update |

---

## 3. ENUM VALUES — Copy/Paste Reference

### LeadSource (for `Lead.source`)
```
WEDMEGOOD
JUSTDIAL
GOOGLE_MAPS
WEBSITE
MANUAL
WHATSAPP_INBOUND       ← Use this for WhatsApp leads
IVR_INBOUND
REFERRAL
OTHER
```

### EventType (for `Lead.eventType`)
```
WEDDING
RECEPTION
ENGAGEMENT
SANGEET
BIRTHDAY
CORPORATE
OTHER
```

### LeadStatus (for `Lead.status`)
```
OPEN
WON
LOST
```

### ScoreBand (for `Lead.scoreBand`)
```
HOT
WARM
COLD
UNSCORED
```

### MessageDirection (for `Message.direction`)
```
INBOUND
OUTBOUND
```

### MessageChannel (for `Message.channel`)
```
WHATSAPP
SMS
```

### MessageStatus (for `Message.status`)
```
QUEUED
SENT
DELIVERED
READ
FAILED
RECEIVED
```

---

## 4. STAGE REFERENCE

### "New Lead" Stage

| Field | Value |
|-------|-------|
| Stage ID | `cmpz2fo7s0004pdzqogtt4b71` |
| Stage Name | `New Lead` |
| Stage Key | `new` |

**All other stages (for reference):**
- Contacted: `cmpz2fo7s0004pdzqogtt4b72`
- Site Visit: `cmpz2fo7s0004pdzqogtt4b73`
- Quotation: `cmpz2fo8s0004pdzqogtt4b74`
- Negotiation: `cmpz2fo8s0004pdzqogtt4b75`
- Confirmed: `cmpz2fo8s0004pdzqogtt4b76`
- Lost / Not Interested: `cmpz2fo8s0004pdzqogtt4b77`

---

## 5. INSERT STATEMENT — New WhatsApp Lead

Use this in n8n Postgres node. Replace `{{variable}}` with n8n expressions.

```sql
INSERT INTO "Lead" (
  id,
  name,
  primaryPhone,
  source,
  eventType,
  stageId,
  status,
  scoreBand,
  lastContactAt,
  createdAt,
  updatedAt
) VALUES (
  gen_random_uuid()::TEXT,
  {{$node["HTTP Request"].json.body.contacts[0].profile.name}},
  {{$node["HTTP Request"].json.body.messages[0].from}},
  'WHATSAPP_INBOUND',
  'OTHER',
  'cmpz2fo7s0004pdzqogtt4b71',
  'OPEN',
  'UNSCORED',
  NOW(),
  NOW(),
  NOW()
)
RETURNING id;
```

**Required Variables:**
- Lead name: From webhook contacts[0].profile.name
- Phone: From webhook messages[0].from (already normalized as +91XXXXXXXXXX)
- Source: Always `WHATSAPP_INBOUND`
- EventType: Default to `OTHER` (populate from Flow later)
- StageId: Always `cmpz2fo7s0004pdzqogtt4b71`

---

## 6. INSERT STATEMENT — Message Row

```sql
INSERT INTO "Message" (
  id,
  leadId,
  direction,
  channel,
  status,
  body,
  providerMessageId,
  receivedAt,
  createdAt,
  updatedAt
) VALUES (
  gen_random_uuid()::TEXT,
  {{$node["Create Lead"].json[0].id}},
  'INBOUND',
  'WHATSAPP',
  'RECEIVED',
  {{$node["HTTP Request"].json.body.messages[0].text.body}},
  {{$node["HTTP Request"].json.body.messages[0].id}},
  to_timestamp({{$node["HTTP Request"].json.body.messages[0].timestamp}}::INTEGER),
  NOW(),
  NOW()
);
```

**Required Variables:**
- leadId: From previous INSERT RETURNING
- direction: Always `INBOUND` (for customer messages)
- channel: Always `WHATSAPP`
- status: Always `RECEIVED` (for inbound)
- body: Message text
- **providerMessageId: Meta message ID (CRITICAL for idempotency!)**
- receivedAt: Unix timestamp from Meta (convert to TIMESTAMP)

---

## 7. UPDATE STATEMENT — Populate Lead from Flow Response

For when customer submits WhatsApp Flow with event details.

```sql
UPDATE "Lead" SET
  name = COALESCE(
    NULLIF({{$node["Parse Flow"].json.name_field}}, ''),
    name
  ),
  eventType = CASE
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'WEDDING' THEN 'WEDDING'
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'RECEPTION' THEN 'RECEPTION'
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'ENGAGEMENT' THEN 'ENGAGEMENT'
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'SANGEET' THEN 'SANGEET'
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'BIRTHDAY' THEN 'BIRTHDAY'
    WHEN {{$node["Parse Flow"].json.event_type_field}} = 'CORPORATE' THEN 'CORPORATE'
    ELSE 'OTHER'
  END,
  guestCount = NULLIF({{$node["Parse Flow"].json.guests_field}}::INTEGER, NULL),
  budgetMin = NULLIF({{$node["Parse Flow"].json.budget_min_field}}::INTEGER, NULL),
  budgetMax = NULLIF({{$node["Parse Flow"].json.budget_max_field}}::INTEGER, NULL),
  eventDate = NULLIF({{$node["Parse Flow"].json.event_date_field}}::TIMESTAMP, NULL),
  notes = CASE 
    WHEN NULLIF({{$node["Parse Flow"].json.location_field}}, '') IS NOT NULL
    THEN CASE
      WHEN notes IS NULL OR notes = '' THEN {{$node["Parse Flow"].json.location_field}}
      ELSE notes || E'\n' || {{$node["Parse Flow"].json.location_field}}
    END
    ELSE notes
  END,
  updatedAt = NOW()
WHERE id = {{$node["Create Lead"].json[0].id}};
```

**Field Mappings:**
- `name_field` → Lead.name
- `event_type_field` → Lead.eventType
- `guests_field` → Lead.guestCount
- `budget_min_field` → Lead.budgetMin
- `budget_max_field` → Lead.budgetMax
- `event_date_field` → Lead.eventDate
- `location_field` → Lead.notes (appended with newline)

---

## 8. IDEMPOTENCY CHECK — Before Insert

Run this BEFORE inserting a message to prevent duplicates:

```sql
SELECT id FROM "Message"
WHERE "providerMessageId" = {{$node["HTTP Request"].json.body.messages[0].id}}
LIMIT 1;
```

**If returns a row:** Message already processed, skip insert.
**If returns empty:** Safe to insert (new message).

---

## 9. CONNECTION STRING

```
postgresql://postgres:anantkamal2002@localhost:5432/nahata
```

For n8n Postgres node:
- **Host:** localhost
- **Port:** 5432
- **Database:** nahata
- **User:** postgres
- **Password:** anantkamal2002

---

## 10. WEBHOOK PAYLOAD EXAMPLE (from Meta)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "919876543210",
              "phone_number_id": "105555555555"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Raj Kumar"
                },
                "wa_id": "919876543210"
              }
            ],
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.test.msg_001",
                "timestamp": "1673544632",
                "type": "text",
                "text": {
                  "body": "Hi, interested in booking!"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 11. FLOW RESPONSE PAYLOAD EXAMPLE

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456",
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.test.flow_001",
                "timestamp": "1673544800",
                "type": "interactive",
                "interactive": {
                  "type": "nfm_reply",
                  "nfm_reply": {
                    "response_json": "{\"name_field\":\"Priya Sharma\",\"event_type_field\":\"WEDDING\",\"guests_field\":\"300\",\"budget_min_field\":\"1000000\",\"budget_max_field\":\"2000000\",\"event_date_field\":\"2025-06-15\",\"location_field\":\"Delhi\"}"
                  }
                }
              }
            ],
            "contacts": [
              {
                "wa_id": "919876543210",
                "profile": {
                  "name": "Priya Sharma"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 12. N8N WORKFLOW SKELETON

```
1. Webhook Trigger (receive Meta webhook)
   ↓
2. Set Variables (extract phone, name, message ID, etc.)
   ↓
3. Lookup Lead (SELECT * FROM Lead WHERE primaryPhone = $1)
   ↓
4. If Lead Exists:
     → Check if Message Idempotent (SELECT FROM Message WHERE providerMessageId)
     → If not exists: INSERT Message
     → If Flow Response: Parse JSON → UPDATE Lead
   ↓
5. If Lead Not Exists:
     → INSERT New Lead (returns lead.id)
     → INSERT Message
     → If Flow Response: UPDATE Lead
```

---

## Quick Copy-Paste Checklist

- ✅ Stage ID for "New Lead": `cmpz2fo7s0004pdzqogtt4b71`
- ✅ Source value: `WHATSAPP_INBOUND`
- ✅ Default EventType: `OTHER`
- ✅ Message Direction: `INBOUND`
- ✅ Message Channel: `WHATSAPP`
- ✅ Message Status: `RECEIVED`
- ✅ Phone Format: Must be `+91XXXXXXXXXX` (normalized before insert)
- ✅ providerMessageId: Meta's message ID (for deduplication)
- ✅ Location appends to notes with `\n` separator
- ✅ Budget values in paisa (100000 = ₹1 lakh)
