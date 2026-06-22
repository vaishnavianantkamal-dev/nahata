# 🧪 WhatsApp Integration Testing Guide

This document provides step-by-step testing procedures for the WhatsApp automation system.

---

## Prerequisites

- Backend running: `npm run dev` (port 4000)
- Database initialized with test data
- WhatsApp configured with either:
  - Mock provider (no credentials needed)
  - Live Meta credentials (for production testing)

---

## Unit Tests: Quick Local Checks

### Test 1: Webhook Verification

Simulate Meta's webhook verification request:

```bash
curl -X GET "http://localhost:4000/api/v1/webhooks?hub.mode=subscribe&hub.challenge=test_challenge_123&hub.verify_token=nahata_webhook_verify_2024" \
  -v
```

**Expected Response:**
```
HTTP/1.1 200 OK
test_challenge_123
```

If you see `403 Forbidden`, check:
- `META_WEBHOOK_VERIFY_TOKEN` in `.env`
- Token matches Meta's webhook settings

---

### Test 2: Invalid Webhook Token

```bash
curl -X GET "http://localhost:4000/api/v1/webhooks?hub.mode=subscribe&hub.challenge=test_123&hub.verify_token=wrong_token" \
  -v
```

**Expected Response:**
```
HTTP/1.1 403 Forbidden
{"error": "Invalid verify token"}
```

---

### Test 3: Signature Verification

Create a test webhook payload with correct HMAC signature:

```bash
#!/bin/bash

APP_SECRET="your_meta_app_secret"
PAYLOAD='{"entry":[{"id":"123","changes":[]}]}'

# Generate HMAC-SHA256 signature
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" | sed 's/^.* //')"

curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD" \
  -v
```

**Expected Response:**
```
HTTP/1.1 200 OK
{"received": true}
```

---

## Integration Tests: Full Message Flow

### Test 4: Incoming Text Message

Simulate a customer sending a text message:

```bash
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{
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
                  "id": "wamid.xxx123",
                  "timestamp": "1673544632",
                  "type": "text",
                  "text": {
                    "body": "Hi, I am interested in booking for my wedding!"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }'
```

**Expected Behavior:**
1. ✅ Webhook returns 200 OK immediately
2. ✅ New Lead created with:
   - `name`: "Raj Kumar"
   - `primaryPhone`: "+919876543210"
   - `source`: "WHATSAPP_INBOUND"
   - `stage`: "New Lead"
3. ✅ Message stored in database
4. ✅ Auto-reply sent
5. ✅ Activity log created

**Verify with:**
```bash
# Check database
psql -U postgres -d nahata -c "
  SELECT * FROM \"Lead\" 
  WHERE \"primaryPhone\" LIKE '%9876543210%' 
  ORDER BY \"createdAt\" DESC LIMIT 1;"

# Check messages
psql -U postgres -d nahata -c "
  SELECT id, \"leadId\", direction, body, \"createdAt\" 
  FROM \"Message\" 
  WHERE channel = 'WHATSAPP' 
  ORDER BY \"createdAt\" DESC LIMIT 5;"
```

---

### Test 5: Duplicate Message Handling (Idempotency)

Send the same message twice with same message ID:

```bash
# Message 1
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"919876543210","id":"msg_123_unique","timestamp":"1673544632","type":"text","text":{"body":"Hello!"}}],"contacts":[{"wa_id":"919876543210","profile":{"name":"John"}}]}}]}]}'

# Message 2 (same ID)
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"919876543210","id":"msg_123_unique","timestamp":"1673544632","type":"text","text":{"body":"Hello!"}}],"contacts":[{"wa_id":"919876543210","profile":{"name":"John"}}]}}]}]}'
```

**Expected Behavior:**
- ✅ First message: stored
- ✅ Second message: skipped (idempotency check prevents duplicate)
- Database should have only 1 message with ID `msg_123_unique`

---

### Test 6: Message Status Updates

Simulate delivery and read receipts:

```bash
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "changes": [
          {
            "value": {
              "statuses": [
                {
                  "id": "wamid.xxx123",
                  "status": "delivered",
                  "timestamp": "1673544700"
                }
              ]
            }
          }
        ]
      }
    ]
  }'
```

**Verify:**
```bash
psql -U postgres -d nahata -c "
  SELECT \"providerMessageId\", status, \"deliveredAt\" 
  FROM \"Message\" 
  WHERE \"providerMessageId\" = 'wamid.xxx123';"
```

---

### Test 7: Flow Response (Lead Data Collection)

Simulate customer submitting form via WhatsApp Flow:

```bash
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "changes": [
          {
            "value": {
              "messages": [
                {
                  "from": "919876543210",
                  "id": "flow_response_123",
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
  }'
```

**Expected Behavior:**
- ✅ Lead fields updated:
  - `name`: "Priya Sharma"
  - `eventType`: "WEDDING"
  - `guestCount`: 300
  - `budgetMin`: 1000000
  - `budgetMax`: 2000000
  - `eventDate`: 2025-06-15
- ✅ Activity log created with type `FIELD_UPDATED`

**Verify:**
```bash
psql -U postgres -d nahata -c "
  SELECT name, \"eventType\", \"guestCount\", 
         \"budgetMin\", \"budgetMax\", \"eventDate\" 
  FROM \"Lead\" 
  WHERE \"primaryPhone\" = '919876543210';"
```

---

## API Endpoint Tests

### Test 8: Get Conversation History

```bash
# Assuming lead_id from previous tests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/v1/conversations/lead_uuid_here
```

**Expected Response:**
```json
[
  {
    "id": "msg_123",
    "leadId": "lead_uuid",
    "direction": "INBOUND",
    "channel": "WHATSAPP",
    "body": "Hi, interested in booking!",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "msg_124",
    "leadId": "lead_uuid",
    "direction": "OUTBOUND",
    "channel": "WHATSAPP",
    "body": "Thank you! Please fill out...",
    "createdAt": "2024-01-15T10:31:00Z"
  }
]
```

---

### Test 9: Send Manual Message

```bash
curl -X POST http://localhost:4000/api/v1/send/lead_uuid_here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Thanks for your interest! Can you share your event date?"
  }'
```

**Expected Response:**
```json
{"success": true}
```

Note: If `WHATSAPP_PROVIDER=mock`, no actual message is sent.

---

### Test 10: Integration Status Check

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/v1/status
```

**Expected Response:**
```json
{
  "provider": "meta",
  "configured": true,
  "leadFormMode": "link",
  "hasFlowId": false,
  "stats": {
    "totalMessages": 42,
    "totalLeads": 12
  }
}
```

---

## End-to-End Testing Checklist

- [ ] Webhook verification (Test 1)
- [ ] Invalid token rejection (Test 2)
- [ ] Signature verification (Test 3)
- [ ] New lead creation from message (Test 4)
- [ ] Duplicate message prevention (Test 5)
- [ ] Message status tracking (Test 6)
- [ ] Lead data from Flow (Test 7)
- [ ] Conversation history API (Test 8)
- [ ] Manual message sending (Test 9)
- [ ] Status endpoint (Test 10)
- [ ] Auto-reply is sent
- [ ] Activity log is created
- [ ] Stage automation triggers
- [ ] Database transactions work
- [ ] Error handling works
- [ ] Logging captures all events

---

## Production Readiness Checklist

- [ ] All environment variables set in production
- [ ] HTTPS enabled (webhook must use https://)
- [ ] Rate limiting configured appropriately
- [ ] Logging and monitoring active
- [ ] Error alerts configured
- [ ] Backup and recovery tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] GDPR compliance verified
- [ ] Documentation updated

---

## Troubleshooting Common Issues

### Messages not appearing in CRM

1. Check backend is running
2. Verify webhook URL is correct in Meta settings
3. Check X-Hub-Signature-256 validation logs
4. Ensure database connection is working

```bash
curl http://localhost:4000/healthz
```

### Auto-replies not being sent

1. Check `WHATSAPP_PROVIDER` is not set to `mock`
2. Verify `META_WABA_TOKEN` is valid
3. Check template is configured
4. Review backend logs for send errors

### Leads not being created

1. Verify phone number format (should be valid)
2. Check "New Lead" stage exists
3. Ensure `WHATSAPP_INBOUND` is in LeadSource enum
4. Check database has space

### Flow responses not updating lead

1. Verify flow field names match mapping in `SourceIntegration`
2. Check Flow is published in Meta Business Manager
3. Ensure `LEAD_FORM_MODE=flow` is set
4. Review response_json in webhook logs

---

## Load Testing

Simulate high message volume:

```bash
#!/bin/bash
# Send 100 messages in rapid succession

for i in {1..100}; do
  PHONE="91987654321$i"
  curl -X POST http://localhost:4000/api/v1/webhooks \
    -H "Content-Type: application/json" \
    -d "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"from\":\"$PHONE\",\"id\":\"msg_$i\",\"timestamp\":\"1673544632\",\"type\":\"text\",\"text\":{\"body\":\"Test message $i\"}}],\"contacts\":[{\"wa_id\":\"$PHONE\",\"profile\":{\"name\":\"User $i\"}}]}}]}]}" \
    &
done
```

Monitor database:

```bash
psql -U postgres -d nahata -c "
  SELECT COUNT(*) FROM \"Lead\";
  SELECT COUNT(*) FROM \"Message\";
  SELECT source, COUNT(*) FROM \"Lead\" GROUP BY source;"
```

---

**Questions? Check the main WHATSAPP_SETUP.md for more details!** 📚
