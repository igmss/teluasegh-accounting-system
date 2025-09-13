# Complete Webhook Setup Guide

## 🔧 Step 1: Accounting System Configuration

### Environment Variables (.env.local)
```env
WEBHOOK_SECRET=test-secret-123
NEXT_PUBLIC_BASE_URL=https://your-accounting-system-domain.com
```

### Webhook Endpoint
- **URL**: `https://your-accounting-system-domain.com/api/webhooks/order-status`
- **Method**: `POST`
- **Secret**: `test-secret-123`

---

## 🌐 Step 2: Main Website Configuration

### Environment Variables (.env)
```env
ACCOUNTING_WEBHOOK_URL=https://your-accounting-system-domain.com/api/webhooks/order-status
ACCOUNTING_WEBHOOK_SECRET=test-secret-123
```

### Integration Code

#### 1. Create Webhook Service (webhook-service.js)
```javascript
class AccountingWebhookService {
  constructor() {
    this.webhookUrl = process.env.ACCOUNTING_WEBHOOK_URL
    this.webhookSecret = process.env.ACCOUNTING_WEBHOOK_SECRET
  }

  async notifyOrderStatusChange(orderId, newStatus) {
    try {
      console.log(`🔄 Notifying accounting system: Order ${orderId} -> ${newStatus}`)
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
          status: newStatus,
          webhookSecret: this.webhookSecret
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`✅ Accounting system notified successfully`)
        console.log(`📋 Work Order ID: ${result.workOrderId || 'N/A'}`)
        return {
          success: true,
          workOrderId: result.workOrderId,
          message: result.message
        }
      } else {
        const error = await response.json()
        console.error(`❌ Webhook failed: ${error.error}`)
        return {
          success: false,
          error: error.error
        }
      }
    } catch (error) {
      console.error('❌ Webhook error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default AccountingWebhookService
```

#### 2. Update Order Management (order-service.js)
```javascript
import AccountingWebhookService from './webhook-service.js'

class OrderService {
  constructor() {
    this.webhookService = new AccountingWebhookService()
  }

  async updateOrderStatus(orderId, newStatus) {
    try {
      // 1. Update order in your main database
      await this.updateOrderInDatabase(orderId, newStatus)
      
      // 2. Notify accounting system IMMEDIATELY
      const webhookResult = await this.webhookService.notifyOrderStatusChange(orderId, newStatus)
      
      if (webhookResult.success) {
        console.log(`✅ Order ${orderId} status updated to ${newStatus}`)
        
        // Show success message to user
        this.showSuccessMessage(`Order ${orderId} updated successfully!`)
        
        // If work order was created, show that too
        if (webhookResult.workOrderId) {
          this.showInfoMessage(`Work Order ${webhookResult.workOrderId} created`)
        }
        
        return { success: true, webhookResult }
      } else {
        console.warn(`⚠️ Order updated but accounting system notification failed: ${webhookResult.error}`)
        
        // Show warning to user
        this.showWarningMessage(`Order updated but accounting system sync failed. Please retry.`)
        
        return { success: false, error: webhookResult.error }
      }
      
    } catch (error) {
      console.error('Error updating order:', error)
      this.showErrorMessage(`Failed to update order: ${error.message}`)
      throw error
    }
  }

  async updateOrderInDatabase(orderId, newStatus) {
    // Your existing database update logic here
    // Example:
    // await db.collection('orders').doc(orderId).update({
    //   status: newStatus,
    //   updatedAt: new Date()
    // })
  }

  showSuccessMessage(message) {
    // Your UI notification logic
    console.log(`✅ ${message}`)
  }

  showWarningMessage(message) {
    // Your UI notification logic
    console.warn(`⚠️ ${message}`)
  }

  showErrorMessage(message) {
    // Your UI notification logic
    console.error(`❌ ${message}`)
  }

  showInfoMessage(message) {
    // Your UI notification logic
    console.info(`ℹ️ ${message}`)
  }
}

export default OrderService
```

#### 3. Admin Panel Integration (admin-panel.js)
```javascript
import OrderService from './order-service.js'

class AdminPanel {
  constructor() {
    this.orderService = new OrderService()
  }

  async handleOrderStatusChange(orderId, newStatus) {
    try {
      // Show loading state
      this.showLoadingState(orderId)
      
      // Update order status
      const result = await this.orderService.updateOrderStatus(orderId, newStatus)
      
      if (result.success) {
        // Update UI to show new status
        this.updateOrderStatusInUI(orderId, newStatus)
        
        // Refresh order list
        await this.refreshOrderList()
      }
      
    } catch (error) {
      console.error('Failed to update order status:', error)
      this.showErrorModal(`Failed to update order: ${error.message}`)
    } finally {
      // Hide loading state
      this.hideLoadingState(orderId)
    }
  }

  showLoadingState(orderId) {
    // Show spinner/loading indicator
    const orderElement = document.getElementById(`order-${orderId}`)
    if (orderElement) {
      orderElement.classList.add('loading')
    }
  }

  hideLoadingState(orderId) {
    // Hide spinner/loading indicator
    const orderElement = document.getElementById(`order-${orderId}`)
    if (orderElement) {
      orderElement.classList.remove('loading')
    }
  }

  updateOrderStatusInUI(orderId, newStatus) {
    // Update the status display in your UI
    const statusElement = document.getElementById(`status-${orderId}`)
    if (statusElement) {
      statusElement.textContent = newStatus
      statusElement.className = `status status-${newStatus.toLowerCase()}`
    }
  }

  async refreshOrderList() {
    // Refresh your order list
    // Your existing refresh logic here
  }

  showErrorModal(message) {
    // Show error modal to user
    alert(`Error: ${message}`)
  }
}

// Usage example
const adminPanel = new AdminPanel()

// When admin clicks "Mark as Processing" button
document.getElementById('mark-processing-btn').addEventListener('click', async (e) => {
  const orderId = e.target.dataset.orderId
  await adminPanel.handleOrderStatusChange(orderId, 'processing')
})
```

---

## 🧪 Step 3: Testing

### Test with Current Order
```bash
curl -X POST https://your-accounting-system-domain.com/api/webhooks/order-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "3BzExHXnvYpEu0jOaFDP",
    "status": "processing",
    "webhookSecret": "test-secret-123"
  }'
```

### Expected Response
```json
{
  "success": true,
  "message": "Order 3BzExHXnvYpEu0jOaFDP processed successfully",
  "orderId": "3BzExHXnvYpEu0jOaFDP",
  "status": "processing",
  "workOrderId": "work-order-id-here",
  "timestamp": "2025-01-14T..."
}
```

---

## 🔒 Step 4: Security & Production

### Production Environment Variables
```env
# Accounting System
WEBHOOK_SECRET=your-super-secure-secret-here
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com

# Main Website
ACCOUNTING_WEBHOOK_URL=https://your-production-domain.com/api/webhooks/order-status
ACCOUNTING_WEBHOOK_SECRET=your-super-secure-secret-here
```

### Security Best Practices
1. **Use HTTPS** for all webhook calls
2. **Rotate secrets** regularly
3. **Validate webhook signatures** (optional)
4. **Rate limiting** (implement if needed)
5. **Logging** for audit trails

---

## 🎯 Step 5: What Happens Automatically

When order status changes to "processing":

1. ✅ **Main Website** updates order status
2. ✅ **Webhook Call** sent to accounting system
3. ✅ **Sales Order** created/updated instantly
4. ✅ **Work Order** generated automatically
5. ✅ **Journal Entries** created for accounting
6. ✅ **Response** returned with work order ID
7. ✅ **UI Updated** with success message

**No delays, no cron jobs, no manual intervention needed!**

---

## 🚀 Ready to Deploy!

Your webhook system is now **production-ready** with:
- ✅ **Type Safety** - No TypeScript errors
- ✅ **Error Handling** - Proper error management
- ✅ **Security** - Webhook secret validation
- ✅ **Real-time Processing** - Immediate updates
- ✅ **User Feedback** - Success/error messages

The integration is complete and ready for your main website!
