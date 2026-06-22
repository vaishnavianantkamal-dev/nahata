# 📱 WhatsApp Integration Setup Guide

This guide explains how to set up WhatsApp automation with Nahata CRM using the Meta WhatsApp Cloud API.

---

## 📋 Prerequisites

1. **Meta Business Account** — Create one at [business.facebook.com](https://business.facebook.com)
2. **WhatsApp Business Account** — Set up via Meta Business Manager
3. **Phone Number** — A phone number to register with Meta (won't receive SMS)
4. **Webhook URL** — Your server's public URL or ngrok tunnel (for local testing)

---

## 🚀 Setup Steps

### Step 1: Get WhatsApp Business Account Credentials

1. Go to **Meta Business Manager** → **Apps & Assets** → **Apps**
2. Create a new app (or use existing) with **Business** type
3. Navigate to **WhatsApp** product
4. Go to **API Setup** section
5. Copy these values:
   - **Permanent Access Token** → `META_WABA_TOKEN`
   - **Phone Number ID** → `META_WABA_PHONE_NUMBER_ID`
   - **Business Account ID** → `META_WABA_BUSINESS_ACCOUNT_ID` (for later)

### Step 2: Generate App Secret

1. Go to **App Settings** → **Basic**
2. Find **App Secret** → Copy it → `META_APP_SECRET`
3. Keep this secret — never commit to version control!

### Step 3: Create Webhook Verify Token

Generate a strong random token:
```bash
# On macOS/Linux
openssl rand -hex 32

# Or just use a long string
echo "my_super_secret_webhook_token_$(date +%s)"
```

Save this as `META_WEBHOOK_VERIFY_TOKEN` in `.env`

### Step 4: Register Webhook Callback URL

#### For Production (Render, Vercel, etc.):
1. Your webhook URL is: `https://your-domain.com/api/v1/webhooks`
2. Go to **WhatsApp** → **Configuration** → **Webhooks**
3. Click **Edit** → enter your callback URL
4. Paste your `META_WEBHOOK_VERIFY_TOKEN` as the verify token
5. Subscribe to these webhook fields:
   - ✅ `messages` — Incoming messages
   - ✅ `message_status` — Delivery/read receipts
6. Click **Verify and Save**

#### For Local Development (with ngrok):

```bash
# Terminal 1: Start ngrok tunnel
ngrok http 4000

# Copy the forwarding URL, e.g., https://abc123.ngrok.io
```

Then follow the same steps above, but use:
- Callback URL: `https://abc123.ngrok.io/api/v1/webhooks`

---

## 🔧 Environment Variables

Update your `.env` file:

```bash
# WhatsApp credentials (get from steps above)
META_WABA_PHONE_NUMBER_ID=your_phone_number_id_here
META_WABA_TOKEN=your_permanent_token_here
META_APP_SECRET=your_app_secret_here
META_WEBHOOK_VERIFY_TOKEN=your_webhook_token_here

# API configuration
GRAPH_API_VERSION=v18.0

# Lead form delivery mode
LEAD_FORM_MODE=link                              # or "flow"
LEAD_FORM_URL=https://yourapp.com/lead          # when mode=link
WHATSAPP_FLOW_ID=                                # when mode=flow (optional)

# Switch provider from mock to meta
WHATSAPP_PROVIDER=meta  # ← Change from "mock"
```

**Don't hardcode secrets!** Use environment variables or `.env` files only.

---

## ✅ Testing the Integration

### 1. Verify Webhook is Connected

```bash
# Send a test message to your WhatsApp Business Account phone number
# The webhook should receive the message
```

Check backend logs:
```bash
tail -f backend.log | grep -i whatsapp
```

You should see:
```
✅ Message stored
💬 New lead created from WhatsApp
✉️ Auto-reply sent
```

### 2. Test with cURL (local development)

```bash
# Test webhook verification
curl -X GET "http://localhost:4000/api/v1/webhooks?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=nahata_webhook_verify_2024"
```

Expected response: `test123` (plain text)

### 3. Monitor Message Flow

```bash
# Check recent messages
curl -H "Authorization: Bearer your_jwt_token" \
  http://localhost:4000/api/v1/conversations/lead_id

# Send manual message to a lead
curl -X POST http://localhost:4000/api/v1/send/lead_id \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{"body": "Hello from Nahata CRM!"}'
```

### 4. Check Integration Status

```bash
curl -H "Authorization: Bearer your_jwt_token" \
  http://localhost:4000/api/v1/status
```

Response:
```json
{
  "provider": "meta",
  "configured": true,
  "leadFormMode": "link",
  "stats": {
    "totalMessages": 42,
    "totalLeads": 12
  }
}
```

---

## 🎯 Features Explained

### Auto-Reply on New Lead

When a customer sends their first message:
1. ✅ New Lead is created in CRM
2. ✅ `lastContactAt` is updated
3. ✅ Message is logged
4. ✅ Auto-reply is sent with:
   - **Mode "link"**: CTA button → Your web form
   - **Mode "flow"**: Interactive WhatsApp Flow for instant data collection

### Lead Details from Flow

If using `LEAD_FORM_MODE=flow`, customers fill a form inside WhatsApp:
- Name, Event Type, Guest Count
- Budget Range, Event Date, Location

Fields are auto-saved to the Lead record:
```json
{
  "name": "Raj Sharma",
  "eventType": "WEDDING",
  "guestCount": 250,
  "budgetMin": 500000,
  "budgetMax": 1000000,
  "eventDate": "2025-12-15",
  "notes": "Location: Delhi"
}
```

### Stage-Based Automation

When a Lead moves to a stage, the configured template message is sent automatically:

```
Lead moves to "Contacted" stage
    ↓
Fetch stage's message binding
    ↓
Get template: "Hello {Name}, thanks for choosing us!"
    ↓
Render with lead's name
    ↓
Send via WhatsApp
    ↓
Log to Message table
```

---

## 🚨 Troubleshooting

### "Webhook verification failed"
- ❌ Verify token mismatch
- ✅ Check `META_WEBHOOK_VERIFY_TOKEN` matches exactly in Meta's settings
- ✅ Restart backend after env changes

### "Invalid signature"
- ❌ `META_APP_SECRET` is wrong or missing
- ✅ Regenerate in Meta App Settings → Basic
- ✅ Use permanent token, not temporary

### Messages not arriving
- ❌ Backend isn't listening on correct port
- ✅ Check `API_PORT` in `.env` (default 4000)
- ✅ Verify ngrok tunnel is active (if local)
- ✅ Test with: `curl http://localhost:4000/healthz`

### Auto-replies not sending
- ❌ WhatsApp provider set to "mock"
- ✅ Change `WHATSAPP_PROVIDER=meta` in `.env`
- ✅ Verify `META_WABA_TOKEN` is valid
- ✅ Check backend logs: `WHATSAPP_PROVIDER=meta`

### Flow not opening
- ❌ Flow is not published in Meta Business Manager
- ✅ Publish flow and get Flow ID
- ✅ Set `LEAD_FORM_MODE=flow` and `WHATSAPP_FLOW_ID=...`

---

## 📊 Monitoring & Analytics

### Database Queries

```sql
-- Count messages by channel
SELECT channel, COUNT(*) FROM "Message" GROUP BY channel;

-- Recent WhatsApp leads
SELECT name, "primaryPhone", "createdAt" 
FROM "Lead" 
WHERE source = 'WHATSAPP_INBOUND' 
ORDER BY "createdAt" DESC LIMIT 10;

-- Conversation history for a lead
SELECT direction, body, "createdAt" 
FROM "Message" 
WHERE "leadId" = 'lead_id_here' 
ORDER BY "createdAt" DESC;
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/conversations/:leadId` | Message history |
| POST | `/api/v1/send/:leadId` | Send manual message |
| GET | `/api/v1/status` | Integration health |

---

## 🔐 Security Best Practices

1. **Never commit secrets**
   - Use `.env` locally
   - Use environment secrets in production (Render, Vercel)

2. **Rotate tokens periodically**
   - Regenerate `META_APP_SECRET` monthly
   - Create new `META_WEBHOOK_VERIFY_TOKEN` if compromised

3. **Webhook signature verification**
   - All incoming requests are HMAC-verified
   - Invalid signatures return 403

4. **Rate limiting**
   - Webhooks are rate-limited to 100 requests/minute
   - Configure in `src/index.ts` if needed

---

## 📚 Resources

- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhooks Reference](https://developers.facebook.com/docs/whatsapp/webhooks)
- [Flow Builder Guide](https://www.whatsapp.com/business/flows/)
- [ngrok Docs](https://ngrok.com/docs)

---

## ❓ FAQ

**Q: Can I use this without a live WhatsApp account?**
A: Yes! Use `WHATSAPP_PROVIDER=mock` for development. It doesn't call Meta's API.

**Q: What's the difference between "link" and "flow" mode?**
A: **Link**: Customer clicks button → goes to your web form. **Flow**: Form is inside WhatsApp (faster, higher conversion).

**Q: Does this charge me per message?**
A: No! WhatsApp messaging to customers is free. You only pay for media messages (images, documents).

**Q: Can I send bulk messages?**
A: Not yet. Current implementation sends transactional messages. Bulk campaigns require different Meta product.

**Q: What if a customer replies to the form message?**
A: Their reply is captured as a Message and associated with the Lead. You can respond manually.

---

**Questions? Issues? Open an issue on GitHub!** 🚀
