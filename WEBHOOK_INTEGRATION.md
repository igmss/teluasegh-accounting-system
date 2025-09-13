# Webhook Integration Guide for Main Website

## Overview
This webhook system provides **immediate** order processing without cron jobs. When order status changes on your main website, it instantly notifies the accounting system.

## Webhook Endpoint
```
POST https://your-accounting-system-domain.com/api/webhooks/order-status
```

## Integration Code for Main Website

### 1. Add this function to your main website:

```javascript
// Add this to your main website's order management system
async function notifyAccountingSystem(orderId, newStatus) {
  try {
    const response = await fetch('https://your-accounting-system-domain.com/api/webhooks/order-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        status: newStatus,
        webhookSecret: process.env.ACCOUNTING_WEBHOOK_SECRET
      })
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Accounting system notified: Order ${orderId} -> ${newStatus}`)
      console.log(`📋 Work Order ID: ${result.workOrderId || 'N/A'}`)
      return true
    } else {
      const error = await response.json()
      console.error(`❌ Failed to notify accounting system: ${error.error}`)
      return false
    }
  } catch (error) {
    console.error('❌ Error notifying accounting system:', error)
    return false
  }
}
```

### 2. Call this function when order status changes:

```javascript
// In your order status update function on main website
async function updateOrderStatus(orderId, newStatus) {
  try {
    // 1. Update order in your main database
    await updateOrderInDatabase(orderId, newStatus)
    
    // 2. Notify accounting system IMMEDIATELY
    const accountingSuccess = await notifyAccountingSystem(orderId, newStatus)
    
    if (accountingSuccess) {
      console.log(`✅ Order ${orderId} status updated to ${newStatus}`)
      // Show success message to user
    } else {
      console.warn(`⚠️ Order updated but accounting system notification failed`)
      // Show warning to user
    }
    
  } catch (error) {
    console.error('Error updating order:', error)
    throw error
  }
}
```

### 3. Environment Variables for Main Website:

```env
ACCOUNTING_WEBHOOK_SECRET=your-webhook-secret-here
ACCOUNTING_WEBHOOK_URL=https://your-accounting-system-domain.com/api/webhooks/order-status
```

### 4. Test with Current Order:

For your current order `3BzExHXnvYpEu0jOaFDP`, you can test by calling:

```bash
curl -X POST https://your-accounting-system-domain.com/api/webhooks/order-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "3BzExHXnvYpEu0jOaFDP",
    "status": "processing",
    "webhookSecret": "your-webhook-secret-here"
  }'
```

## What Happens Automatically

When your main website calls this webhook:

1. ✅ **Immediate Processing** - No delays, no cron jobs
2. ✅ **Updates Order Status** in accounting system
3. ✅ **Creates Sales Order** record
4. ✅ **Generates Work Order** automatically
5. ✅ **Creates Journal Entries** for accounting
6. ✅ **Updates Inventory Accounts**
7. ✅ **Returns Work Order ID** for tracking

## Benefits Over Cron Jobs

- ⚡ **Instant Processing** - No waiting for cron intervals
- 🔄 **Real-time Updates** - Accounting system stays in sync
- 💰 **Resource Efficient** - No unnecessary API calls
- 🎯 **Event-driven** - Only processes when needed
- 📊 **Better UX** - Users see immediate results

## Security

- Webhook secret validation
- Order ID verification
- Error handling and logging
- No duplicate processing

## Status Mapping

| Website Status | Accounting Status | Action |
|----------------|-------------------|---------|
| `pending` | `pending` | Create sales order |
| `processing` | `producing` | Create work order + journal entries |
| `completed` | `completed` | Update status |
| `cancelled` | `cancelled` | Update status |

This webhook system is **production-ready** and provides **immediate, efficient** order processing without any cron job dependencies!
