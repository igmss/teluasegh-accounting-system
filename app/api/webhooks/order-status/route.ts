import { NextRequest, NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, status, webhookSecret } = body

    // Verify webhook secret for security
    if (webhookSecret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required" },
        { status: 400 }
      )
    }

    console.log(`🔄 Webhook: Processing order ${orderId} -> ${status}`)

    // Get the order from the main website orders collection
    const orderDoc = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get()
    
    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: `Order ${orderId} not found` },
        { status: 404 }
      )
    }

    const orderData = orderDoc.data()
    
    if (!orderData) {
      return NextResponse.json(
        { error: `Order ${orderId} data not found` },
        { status: 404 }
      )
    }
    
    const now = new Date()

    // Update the order status in the main orders collection
    await orderDoc.ref.update({
      status: status,
      updatedAt: now
    })

    // Create/Update sales order in accounting system
    const salesOrder = {
      id: orderId,
      website_order_id: orderId,
      customer_id: orderData.userId || "unknown",
      customer_name: orderData.shippingAddress?.fullName || "Unknown Customer",
      items: orderData.items?.map((item: any) => ({
        sku: item.productId,
        qty: item.quantity,
        unit_price: item.basePrice || item.adjustedPrice
      })) || [],
      status: mapOrderStatus(status),
      created_at: orderData.createdAt?.toDate?.() || now,
      total_amount: orderData.total || 0,
      order_source: "web",
      updated_at: now
    }

    await db.collection(COLLECTIONS.SALES_ORDERS).doc(orderId).set(salesOrder)
    console.log(`✅ Created/Updated sales order for ${orderId}`)

    // If status is "processing", create work order immediately
    if (status === "processing") {
      // Check if work order already exists
      const existingWorkOrderSnapshot = await db.collection(COLLECTIONS.WORK_ORDERS)
        .where("sales_order_id", "==", orderId)
        .get()

      if (existingWorkOrderSnapshot.empty) {
        // Create work order
        const workOrder = {
          sales_order_id: orderId,
          status: "pending",
          completionPercentage: 0,
          raw_materials_used: [],
          overhead_cost: 0,
          labor_cost: 0,
          total_cost: 0,
          created_at: now,
          updated_at: now,
          estimated_completion: null,
          completed_at: null
        }

        const workOrderRef = await db.collection(COLLECTIONS.WORK_ORDERS).add(workOrder)
        
        // Create journal entry for work order start
        const journalEntry = {
          date: now,
          entries: [
            { 
              account_id: "INVENTORY_WIP", 
              debit: orderData?.total || 0, 
              credit: 0, 
              description: `Work order started for web order ${orderId}` 
            },
            { 
              account_id: "COGS_PENDING", 
              debit: 0, 
              credit: orderData?.total || 0, 
              description: `Work order started for web order ${orderId}` 
            }
          ],
          linked_doc: workOrderRef.id,
          created_at: now
        }
        
        await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)
        
        console.log(`✅ Created work order ${workOrderRef.id} for web order ${orderId}`)
        
        return NextResponse.json({
          success: true,
          message: `Order ${orderId} processed successfully`,
          orderId,
          status,
          workOrderId: workOrderRef.id,
          timestamp: now.toISOString()
        })
      } else {
        console.log(`ℹ️ Work order already exists for order ${orderId}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} status updated to ${status}`,
      orderId,
      status,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error("Error processing order status webhook:", error)
    return NextResponse.json(
      { error: "Failed to process order status update" },
      { status: 500 }
    )
  }
}

// Helper function to map website order status to accounting status
function mapOrderStatus(websiteStatus: string): string {
  const statusMap: { [key: string]: string } = {
    "pending": "pending",
    "processing": "producing", 
    "producing": "producing",
    "completed": "completed",
    "shipped": "completed",
    "delivered": "completed",
    "cancelled": "cancelled",
    "refunded": "cancelled"
  }
  
  return statusMap[websiteStatus.toLowerCase()] || "pending"
}
