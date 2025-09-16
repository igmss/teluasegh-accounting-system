# CSP-Friendly Webhook Integration Solution

## Problem
The main website has a Content Security Policy (CSP) that blocks connections to external domains, preventing the webhook from being called directly from the client-side JavaScript.

## Solution Options

### Option 1: Server-Side Webhook Call (Recommended)
Instead of calling the webhook from client-side JavaScript, call it from your main website's server-side code.

### Option 2: CSP Update (If Possible)
Update the CSP to allow connections to your accounting system domain.

### Option 3: Proxy Endpoint
Create a proxy endpoint on your main website that forwards requests to the accounting system.

## Implementation

### Option 1: Server-Side Integration (Recommended)

#### 1. Create a server-side function on your main website:

```javascript
// On your main website's server (Node.js/Express example)
const express = require('express');
const fetch = require('node-fetch'); // or use built-in fetch in Node 18+

app.post('/api/update-order-status', async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    
    // 1. Update order in your main database
    await updateOrderInDatabase(orderId, newStatus);
    
    // 2. Call accounting system webhook from server-side
    const webhookResponse = await fetch('https://teluasegh-accounting-system.vercel.app/api/webhooks/order-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: newStatus,
        webhookSecret: process.env.ACCOUNTING_WEBHOOK_SECRET
      })
    });
    
    if (webhookResponse.ok) {
      const result = await webhookResponse.json();
      console.log(`✅ Accounting system notified: Order ${orderId} -> ${newStatus}`);
      res.json({ success: true, workOrderId: result.workOrderId });
    } else {
      console.error('❌ Failed to notify accounting system');
      res.json({ success: false, error: 'Accounting system notification failed' });
    }
    
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### 2. Update your client-side code to call your own API:

```javascript
// On your main website's client-side
async function updateOrderStatus(orderId, newStatus) {
  try {
    // Call your own server-side API instead of external webhook
    const response = await fetch('/api/update-order-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        newStatus: newStatus
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Order ${orderId} status updated to ${newStatus}`);
      if (result.workOrderId) {
        console.log(`📋 Work Order ID: ${result.workOrderId}`);
      }
      return true;
    } else {
      console.error('❌ Failed to update order status');
      return false;
    }
  } catch (error) {
    console.error('Error updating order:', error);
    return false;
  }
}
```

### Option 2: CSP Update (If You Control the Main Website)

If you can modify the CSP on your main website, add your accounting system domain:

```html
<!-- In your main website's HTML head -->
<meta http-equiv="Content-Security-Policy" 
      content="connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.cloudfunctions.net https://teluasegh-accounting-system.vercel.app">
```

### Option 3: Proxy Endpoint

Create a proxy endpoint on your main website:

```javascript
// On your main website
app.post('/api/proxy-accounting-webhook', async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    // Forward to accounting system
    const response = await fetch('https://teluasegh-accounting-system.vercel.app/api/webhooks/order-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: status,
        webhookSecret: process.env.ACCOUNTING_WEBHOOK_SECRET
      })
    });
    
    const result = await response.json();
    res.json(result);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy failed' });
  }
});
```

## Recommended Approach

**Use Option 1 (Server-Side Integration)** because:
- ✅ Works with existing CSP
- ✅ More secure (webhook secret stays on server)
- ✅ Better error handling
- ✅ No CSP modifications needed
- ✅ Works with any hosting platform

## Testing

After implementing Option 1, test with:

```bash
curl -X POST https://your-main-website.com/api/update-order-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "3BzExHXnvYpEu0jOaFDP",
    "newStatus": "processing"
  }'
```

This should successfully update the order and create the work order in your accounting system!
