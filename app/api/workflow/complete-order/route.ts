import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json()
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      )
    }

    // Get the order details
    const orderDoc = await db.collection("manual_orders").doc(orderId).get()
    const orderData = orderDoc.data()
    
    if (!orderData) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // 1. Update order status to completed
    await db.collection("manual_orders").doc(orderId).update({
      status: "completed",
      updatedAt: new Date()
    })

    // 2. Update accounting sales order status
    await db.collection("acc_sales_orders").doc(orderId).update({
      status: "completed",
      updated_at: new Date()
    })

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
      const invoice = {
        id: invoiceId,
        sales_order_id: orderId,
        customer_id: orderData.userId || "manual_user",
        customer_name: orderData.shippingAddress?.fullName || "Manual Customer",
        amount: orderData.total || 0,
        tax_amount: 0, // You can add tax calculation here
        total_amount: orderData.total || 0,
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
