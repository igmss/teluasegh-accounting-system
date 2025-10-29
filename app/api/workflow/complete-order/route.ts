import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json()
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      )
    }

    // Try to get the order from multiple possible collections
    let orderData = null
    let orderSource = null
    
    // Try manual_orders first
    const manualOrderDoc = await db.collection("manual_orders").doc(orderId).get()
    if (manualOrderDoc.exists) {
      orderData = manualOrderDoc.data()
      orderSource = "manual_orders"
    } else {
      // Try orders collection (web orders)
      const webOrderDoc = await db.collection("orders").doc(orderId).get()
      if (webOrderDoc.exists) {
        orderData = webOrderDoc.data()
        orderSource = "orders"
      } else {
        // Try acc_sales_orders (accounting system)
        const salesOrderDoc = await db.collection("acc_sales_orders").doc(orderId).get()
        if (salesOrderDoc.exists) {
          orderData = salesOrderDoc.data()
          orderSource = "acc_sales_orders"
        }
      }
    }
    
    if (!orderData || !orderSource) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // 1. Update order status to completed in the source collection
    if (orderSource === "manual_orders") {
      await db.collection("manual_orders").doc(orderId).update({
        status: "completed",
        updatedAt: new Date()
      })
    } else if (orderSource === "orders") {
      await db.collection("orders").doc(orderId).update({
        status: "completed",
        updatedAt: new Date()
      })
    }

    // 2. Update accounting sales order status (create if doesn't exist)
    const salesOrderRef = db.collection("acc_sales_orders").doc(orderId)
    const salesOrderDoc = await salesOrderRef.get()
    
    if (salesOrderDoc.exists) {
      await salesOrderRef.update({
        status: "completed",
        updated_at: new Date()
      })
    } else {
      // Create sales order if it doesn't exist in accounting system
      await salesOrderRef.set({
        id: orderId,
        website_order_id: orderId,
        customer_id: orderData.userId || orderData.customer_id || "unknown",
        customer_name: orderData.shippingAddress?.fullName || orderData.customer_name || "Unknown Customer",
        items: orderData.items || [],
        status: "completed",
        total_amount: orderData.total || orderData.total_amount || 0,
        order_source: orderSource === "orders" ? "web" : "manual",
        created_at: orderData.createdAt?.toDate?.() || new Date(),
        updated_at: new Date()
      })
    }

    // 3. Complete work order (if not already completed)
    const workOrdersSnapshot = await db.collection("acc_work_orders")
      .where("sales_order_id", "==", orderId)
      .get()
    
    if (!workOrdersSnapshot.empty) {
      const workOrderDoc = workOrdersSnapshot.docs[0]
      const workOrderData = workOrderDoc.data()
      
      // Only update if not already completed
      if (workOrderData.status !== "completed") {
        await workOrderDoc.ref.update({
          status: "completed",
          completionPercentage: 100,
          completed_at: new Date(),
          updated_at: new Date()
        })
      }

      // 4. Move from WIP to Finished Goods (only if not already done)
      const existingJournalEntry = await db.collection("acc_journal_entries")
        .where("linked_doc", "==", workOrderDoc.id)
        .where("entries", "array-contains", { account_id: "INVENTORY_FINISHED" })
        .get()
      
      if (existingJournalEntry.empty) {
        const journalEntry = {
          date: new Date(),
          entries: [
            { account_id: "INVENTORY_FINISHED", debit: orderData.total || 0, credit: 0, description: `Completed work order ${workOrderDoc.id}` },
            { account_id: "INVENTORY_WIP", debit: 0, credit: orderData.total || 0, description: `Completed work order ${workOrderDoc.id}` }
          ],
          linked_doc: workOrderDoc.id,
          created_at: new Date()
        }
        
        await db.collection("acc_journal_entries").add(journalEntry)
      }
    }

    // 5. Generate invoice (if not already generated)
    const invoiceId = `INV-${orderId.slice(-8)}`
    
    // Check if invoice already exists
    const existingInvoice = await db.collection("acc_invoices").doc(invoiceId).get()
    
    if (!existingInvoice.exists) {
      // Extract customer info based on order source
      const customerId = orderData.userId || orderData.customer_id || "unknown"
      const customerName = orderData.shippingAddress?.fullName || orderData.customer_name || "Unknown Customer"
      const totalAmount = orderData.total || orderData.total_amount || 0
      
      const invoice = {
        id: invoiceId,
        sales_order_id: orderId,
        customer_id: customerId,
        customer_name: customerName,
        amount: totalAmount,
        total: totalAmount, // Also include 'total' field for consistency
        tax_amount: 0, // You can add tax calculation here
        total_amount: totalAmount,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: "unpaid",
        created_at: new Date(),
        items: orderData.items || []
      }

      await db.collection("acc_invoices").doc(invoiceId).set(invoice)

      // 6. Create journal entry for invoice
      const invoiceJournalEntry = {
        date: new Date(),
        entries: [
          { account_id: "ACCOUNTS_RECEIVABLE", debit: orderData.total || 0, credit: 0, description: `Invoice ${invoiceId}` },
          { account_id: "SALES_REVENUE", debit: 0, credit: orderData.total || 0, description: `Sales revenue ${invoiceId}` }
        ],
        linked_doc: invoiceId,
        created_at: new Date()
      }
      
      await db.collection("acc_journal_entries").add(invoiceJournalEntry)
    }

    return NextResponse.json({ 
      success: true, 
      orderId, 
      invoiceId,
      message: "Order completed and invoice generated successfully"
    })

  } catch (error) {
    console.error("Error completing order:", error)
    return NextResponse.json(
      { error: "Failed to complete order" },
      { status: 500 }
    )
  }
}
