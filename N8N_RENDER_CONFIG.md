# n8n ↔ Render PostgreSQL ↔ Meta WhatsApp Configuration

**Live Setup:**
- Frontend: Vercel
- Backend API: Render (https://nahata-crm-api.onrender.com)
- Database: Render PostgreSQL (nahata-db)
- n8n Workflow: connexo.in (hosted external to Render)
- Target: n8n writes WhatsApp leads directly to Render DB

---

## 1️⃣ RENDER POSTGRESQL — EXTERNAL CONNECTION FOR N8N

### **Where to Find Connection Details**

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Click:** `nahata-db` (PostgreSQL database)
3. **Scroll to:** "Connections" section
4. **Copy:** "External Database URL" (NOT "Internal Database URL")
   - Internal URL works only within Render services
   - External URL required for n8n (outside Render)

### **Connection Details Format**

```
Host:          [EXTERNAL_HOST].c.db.onrender.com
Port:          5432
Database:      nahata
User:          nahata_user
Password:      [SHOWN IN RENDER DASHBOARD]
SSL Mode:      require (Render forces SSL for external connections)
```

### **Full External Connection String**

```
postgresql://nahata_user:[PASSWORD]@[EXTERNAL_HOST].c.db.onrender.com:5432/nahata?sslmode=require
```

**Where to copy:**
- **Render Dashboard** → `nahata-db` → "Connections" section
- Look for: **"External Database URL"** (copy the full URL)
- Format: `postgresql://user:password@host:port/database?sslmode=require`

### **SSL Configuration**

| Setting | Value | Why |
|---------|-------|-----|
| **SSL Mode in n8n Postgres Node** | `require` | Render forces SSL for all external connections |
| **Certificate** | Self-signed OK | n8n handles Render's certificates automatically |
| **Connection Pool** | Keep default | n8n manages pooling |

---

## 2️⃣ VERIFY LIVE DATABASE — STAGE IDs & ENUM VALUES

### **Critical: Confirm Production DB Matches Config**

Your n8n SQL uses hardcoded values. **If live DB differs, all inserts fail.**

### **Verification Checklist**

Run these queries in your n8n Postgres node (or via Render dashboard) to confirm:

#### **Query 1: Verify "New Lead" Stage**

```sql
SELECT id, name, key FROM "Stage" WHERE name = 'New Lead' LIMIT 1;
```

**Expected Result:**
```
id                      | name     | key
cmpz2fo7s0004pdzqogtt4b71 | New Lead | new
```

⚠️ **If ID is different,** you must update all your n8n SQL statements to use the correct ID.

#### **Query 2: Verify All Stages Exist**

```sql
SELECT id, name, key FROM "Stage" ORDER BY "order";
```

**Expected Result (7 stages):**
```
New Lead               | new
Contacted             | contacted
Site Visit            | site_visit
Quotation             | quotation
Negotiation           | negotiation
Confirmed             | confirmed
Lost / Not Interested | lost
```

#### **Query 3: Verify LeadSource Enum**

```sql
SELECT unnest(enum_range(NULL::"LeadSource")) as source;
```

**Expected Values:**
```
WEDMEGOOD
JUSTDIAL
GOOGLE_MAPS
WEBSITE
MANUAL
WHATSAPP_INBOUND  ← This is what n8n will insert
IVR_INBOUND
REFERRAL
OTHER
```

#### **Query 4: Verify EventType Enum**

```sql
SELECT unnest(enum_range(NULL::"EventType")) as type;
```

**Expected Values:**
```
WEDDING
RECEPTION
ENGAGEMENT
SANGEET
BIRTHDAY
CORPORATE
OTHER  ← Default for incoming messages
```

#### **Query 5: Verify Message Enums**

```sql
SELECT 
  (SELECT unnest(enum_range(NULL::"MessageDirection"))) as direction,
  (SELECT unnest(enum_range(NULL::"MessageChannel"))) as channel,
  (SELECT unnest(enum_range(NULL::"MessageStatus"))) as status;
```

**Expected Values:**
```
Direction: INBOUND, OUTBOUND
Channel:   WHATSAPP, SMS
Status:    QUEUED, SENT, DELIVERED, READ, FAILED, RECEIVED
```

### **Correction Template**

If live DB differs, update your n8n config with actual values:

| Field | Hardcoded Value | Actual Live Value | Location in n8n |
|-------|-----------------|-------------------|-----------------|
| New Lead Stage ID | cmpz2fo7s0004pdzqogtt4b71 | [RUN QUERY 1] | INSERT stageId |
| LeadSource | WHATSAPP_INBOUND | [CONFIRM] | INSERT source |
| EventType Default | OTHER | [CONFIRM] | INSERT eventType |
| Message Direction | INBOUND | [CONFIRM] | INSERT direction |
| Message Channel | WHATSAPP | [CONFIRM] | INSERT channel |

---

## 3️⃣ META CREDENTIALS — WHERE TO GET THEM

### **3A: PERMANENT ACCESS TOKEN (System User)**

**Why Permanent?** Session tokens expire. System User tokens persist for your workflow.

**Steps:**

1. **Go to:** https://business.facebook.com/settings/system-users
2. **Click:** Your system user (or create one if needed)
3. **Select:** "Generate New Token"
4. **Scopes Needed:**
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_account_management`
5. **Copy:** The token shown (expires: never)
6. **Never share:** This is like an API key

**In n8n:**
- Store in: **Credentials → WhatsApp → Permanent Token**
- Masked example: `EAAG...xyz123` (starts with EAAG)

---

### **3B: META APP SECRET**

**Where to find:**

1. **Go to:** https://developers.facebook.com/apps
2. **Select:** Your Meta App
3. **Go to:** "Settings" → "Basic"
4. **Find:** "App Secret"
5. **Copy:** The secret (click "Show" to reveal)
6. **Never commit:** This is a secret key

**In n8n:**
- Store in: **Credentials → WhatsApp → App Secret**
- Masked example: `a1b2c...xyz789`

---

### **3C: WHATSAPP BUSINESS ACCOUNT (WABA) PHONE NUMBER ID**

**Where to find:**

1. **Go to:** https://business.facebook.com
2. **Select:** Your business account
3. **Go to:** "WhatsApp" → "Getting Started"
4. **Find:** "Phone Number ID" (you mentioned: 1147436441792309)
5. **Copy:** The ID

**In n8n:**
- Store in: **Credentials → WhatsApp → Phone Number ID**
- Format: `1147436441792309`

---

### **Credentials Masking Template**

When storing in n8n, use this format (never log/share full values):

| Credential | Value in n8n | Example (Masked) |
|-----------|--------------|------------------|
| Permanent Token | `META_WABA_TOKEN` | `EAAG****...****xyz123` |
| App Secret | `META_APP_SECRET` | `a1b2c****...****xyz789` |
| Phone Number ID | `META_WABA_PHONE_NUMBER_ID` | `114743****92309` |

---

## 4️⃣ META WEBHOOK REGISTRATION — DETAILED STEPS

### **⚠️ CRITICAL: Meta GET Verification Challenge**

**How Meta Webhook Verification Works:**

1. You register webhook URL: `https://connexo.in/webhook/nahata-whatsapp`
2. Meta sends GET request with parameters:
   ```
   GET https://connexo.in/webhook/nahata-whatsapp?hub.mode=subscribe&hub.challenge=XXXXXX&hub.verify_token=YOUR_TOKEN
   ```
3. Your webhook MUST respond with **plain text** (not JSON):
   ```
   [XXXXXX]  (the hub.challenge value)
   ```
4. Meta checks response matches hub.challenge
5. If match → webhook registered ✅
6. If no match → webhook rejected ❌

**Problem:** n8n's default webhook node returns JSON, not plain text challenge.

**Solution:** Configure n8n to handle GET separately (see section 4B).

---

### **4A: Create Meta App Webhook Entry**

**Steps:**

1. **Go to:** https://developers.facebook.com/apps
2. **Select:** Your Meta App
3. **Go to:** "Messenger" → "Settings"
4. **Find:** "Webhooks" section
5. **Click:** "Add Webhook" or "Edit Subscription"
6. **Fill in:**
   - **Callback URL:** `https://connexo.in/webhook/nahata-whatsapp`
   - **Verify Token:** `nahata_webhook_verify_2024` (or your custom token)
   - **Subscribe to fields:** 
     - ✅ `messages` (incoming messages)
     - ✅ `message_status` (delivery/read receipts)
     - ✅ `message_template_status_update` (optional)
7. **Click:** "Verify and Save"
   - ⚠️ This will FAIL if n8n doesn't echo hub.challenge
   - Solution: Configure GET handler first (see 4B)

---

### **4B: Configure n8n for Meta's GET Verification**

**Problem:** Meta's GET verification expects plain text response, not JSON.

**Solution: Two-Path Webhook Design**

#### **Path 1: GET Verification (Separate Webhook)**

Create a **second** webhook in n8n just for verification:

```
Webhook 1 (GET): https://connexo.in/webhook/nahata-whatsapp-verify
  ├─ Accept: GET requests
  ├─ Respond: Plain text (only hub.challenge)
  └─ No processing

Webhook 2 (POST): https://connexo.in/webhook/nahata-whatsapp
  ├─ Accept: POST requests
  ├─ Process: Incoming messages → Insert to DB
  └─ Respond: JSON {"received": true}
```

**OR Alternative: Single Webhook with Conditional Response**

```
Webhook: https://connexo.in/webhook/nahata-whatsapp
├─ Accept: GET & POST
├─ If GET:
│  ├─ Extract hub.challenge from query params
│  └─ Return plain text: {{$url.query.hub.challenge}}
└─ If POST:
   ├─ Process message
   └─ Return JSON: {"received": true}
```

**n8n Configuration (Webhook Node):**

| Setting | Value |
|---------|-------|
| Path | `/webhook/nahata-whatsapp` |
| Authentication | None (Meta doesn't use auth on verification) |
| HTTP Method | GET, POST |
| Response Mode | "On Execution Completion" or "Immediately" |
| Response Data | Raw |

**For GET Verification Specifically:**

```
Input: GET query: ?hub.mode=subscribe&hub.challenge=ABC123&hub.verify_token=XYZ
Output: Plain text response: ABC123
```

**n8n Expression for hub.challenge:**

```javascript
{{$url.query["hub.challenge"]}}
```

---

### **4C: Register Webhook in Meta Dashboard**

**Once n8n is ready:**

1. Go to Meta App → Webhooks
2. **Callback URL:** `https://connexo.in/webhook/nahata-whatsapp`
3. **Verify Token:** `nahata_webhook_verify_2024`
4. **Subscribed Fields:**
   - ✅ `messages`
   - ✅ `message_status`
5. Click "Verify and Save"
   - n8n GET endpoint returns hub.challenge ✅
   - Meta verifies match ✅
   - Webhook registered ✅

---

### **4D: Meta Webhook Payload Structure**

**n8n will receive POST from Meta like this:**

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "919876543210",
              "phone_number_id": "1147436441792309"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Customer Name"
                },
                "wa_id": "919876543210"
              }
            ],
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.XXXXX",
                "timestamp": "1673544632",
                "type": "text",
                "text": {
                  "body": "Hello, interested in your services!"
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

**n8n should extract:**
- `entry[0].changes[0].value.messages[0].from` → phone (919876543210)
- `entry[0].changes[0].value.messages[0].id` → providerMessageId
- `entry[0].changes[0].value.messages[0].timestamp` → receivedAt
- `entry[0].changes[0].value.contacts[0].profile.name` → contact name
- `entry[0].changes[0].value.messages[0].text.body` → message body

---

## 5️⃣ CRITICAL WARNING: DUAL WEBHOOK CONFLICT

### ⚠️ **Meta Can Only Point to ONE Webhook**

**Current Setup:**
- **Backend Webhook:** `https://nahata-crm-api.onrender.com/api/v1/webhooks` (unused if you switch to n8n)
- **n8n Webhook:** `https://connexo.in/webhook/nahata-whatsapp` (new)

### **What Happens:**

```
┌─────────────────────────────────────────────────┐
│ Meta WhatsApp Cloud API                         │
│ Can send messages to ONE URL only               │
└──────────────────┬──────────────────────────────┘
                   │ Webhook POST
        ┌──────────┴──────────┐
        ↓                     ↓
     n8n                  Backend (UNUSED)
(if configured)          (not reached)
```

### **No Double-Processing**

✅ **You won't get duplicate leads if:**
1. You remove/disable the backend webhook registration in Meta
2. Only point Meta to n8n webhook
3. Delete the backend's webhook subscription in Meta dashboard

### **How to Disable Backend Webhook:**

1. Go to Meta App → Webhooks
2. Find backend webhook URL: `https://nahata-crm-api.onrender.com/api/v1/webhooks`
3. Click "Delete Subscription" or uncheck it
4. Confirm only n8n webhook remains

### **Verification:**

```
Before:
  Meta → Backend webhook (active)
  Meta → n8n webhook (disabled)
  Result: Backend processes messages ✅, n8n sees nothing ❌

After switching:
  Meta → Backend webhook (DELETED)
  Meta → n8n webhook (active)
  Result: Backend unused, n8n processes all messages ✅
```

---

## 📋 COMPLETE N8N CONFIGURATION CHECKLIST

### **Render PostgreSQL Credentials**

Copy these from Render Dashboard → `nahata-db` → "Connections":

| n8n Field | Value | From |
|-----------|-------|------|
| **Host** | [EXTERNAL_HOST].c.db.onrender.com | External Database URL |
| **Port** | 5432 | External Database URL |
| **Database** | nahata | External Database URL |
| **Username** | nahata_user | External Database URL |
| **Password** | [MASKED: first 4]****[last 4] | Render dashboard - copy full |
| **SSL Mode** | require | Always for Render external |
| **Connection String** | postgresql://nahata_user:[PASS]@[HOST]:5432/nahata?sslmode=require | External Database URL (copy full) |

**Where to Paste in n8n:**
```
Credentials → Create → PostgreSQL
├─ Host: [paste host]
├─ Port: 5432
├─ Database: nahata
├─ User: nahata_user
├─ Password: [paste]
└─ SSL/TLS Mode: Require
```

---

### **Meta WhatsApp Credentials**

| n8n Field | Value | From | Masked Example |
|-----------|-------|------|-----------------|
| **Permanent Token** | [36-char token starting EAAG] | Meta App → System User → Generate Token | EAAG****...****xyz123 |
| **App Secret** | [32-char secret] | Meta App → Settings → Basic → App Secret | a1b2c****...****xyz789 |
| **Phone Number ID** | 1147436441792309 | Meta Business → WhatsApp → Phone Number ID | 114743****92309 |
| **Webhook Verify Token** | nahata_webhook_verify_2024 | Your custom token (same in Render env) | nahata****2024 |

**Where to Paste in n8n:**
```
Credentials → Create → Meta WhatsApp
├─ Permanent Token: [paste from Meta]
├─ App Secret: [paste from Meta]
├─ Phone Number ID: 1147436441792309
└─ Verify Token: nahata_webhook_verify_2024
```

---

### **n8n Webhook Configuration**

| Setting | Value | Notes |
|---------|-------|-------|
| **Webhook Path** | `/webhook/nahata-whatsapp` | Full URL: https://connexo.in/webhook/nahata-whatsapp |
| **HTTP Method** | GET, POST | GET for Meta verification; POST for messages |
| **Authentication** | None | Meta doesn't authenticate |
| **Response Mode** | On Completion | Return response after processing |
| **GET Response** | `{{$url.query["hub.challenge"]}}` | Meta verification requirement |
| **POST Response** | `{"received": true}` | Acknowledge message receipt |

---

### **Database Values for n8n SQL**

From verified live DB (run queries in section 2️⃣):

| SQL Variable | Value | Confirm in DB |
|--------------|-------|---------------|
| **New Lead Stage ID** | cmpz2fo7s0004pdzqogtt4b71 | Query: `SELECT id FROM "Stage" WHERE name = 'New Lead'` |
| **LeadSource** | WHATSAPP_INBOUND | Query: `SELECT unnest(enum_range(NULL::"LeadSource"))` |
| **EventType Default** | OTHER | Enum value exists |
| **Message Direction** | INBOUND | Enum value exists |
| **Message Channel** | WHATSAPP | Enum value exists |
| **Message Status** | RECEIVED | Enum value exists |

---

### **n8n SQL Nodes — Ready Templates**

#### **Node 1: Check Idempotency (Prevent Duplicates)**

```sql
SELECT id FROM "Message"
WHERE "providerMessageId" = '{{$json.messages[0].id}}'
LIMIT 1
```

**If result exists → Skip insert (already processed)**

---

#### **Node 2: Lookup or Create Lead**

```sql
SELECT id FROM "Lead"
WHERE "primaryPhone" = '+91{{$json.messages[0].from}}'
LIMIT 1
```

**If no result → Insert new lead (Node 3)**

---

#### **Node 3: Insert New Lead**

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
  '{{$json.contacts[0].profile.name}}',
  '+91{{$json.messages[0].from}}',
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

---

#### **Node 4: Insert Message**

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
  '{{$node["Create Lead"].json[0].id}}',
  'INBOUND',
  'WHATSAPP',
  'RECEIVED',
  '{{$json.messages[0].text.body}}',
  '{{$json.messages[0].id}}',
  to_timestamp({{$json.messages[0].timestamp}}::INTEGER),
  NOW(),
  NOW()
);
```

---

## ✅ FINAL DEPLOYMENT CHECKLIST

Before going live:

- [ ] **Render DB Verified:** Run all 5 queries (section 2️⃣), confirm values match
- [ ] **Permanent Token Generated:** From Meta System User (doesn't expire)
- [ ] **App Secret Copied:** From Meta App → Settings → Basic
- [ ] **Phone Number ID Confirmed:** 1147436441792309
- [ ] **n8n Webhook Created:** GET + POST paths configured
- [ ] **Meta Verification Tested:** n8n returns hub.challenge correctly
- [ ] **Meta Webhook Registered:** Callback URL + Verify Token + Fields subscribed
- [ ] **Backend Webhook Disabled:** Removed from Meta (to prevent conflicts)
- [ ] **n8n Postgres Node Tested:** Connection successful to Render DB
- [ ] **n8n SQL Nodes Created:** Idempotency check → Lookup → Insert (all 4 nodes)
- [ ] **Test Message Sent:** Via WhatsApp → Check DB for lead + message rows
- [ ] **Credentials Secured:** All tokens stored in n8n, never hardcoded

---

## 🚀 NEXT: Deploy n8n Workflow

Once checklist complete, activate the workflow and test with a real WhatsApp message from your test phone.

Result: Lead appears in Render PostgreSQL within 1 second ✅
