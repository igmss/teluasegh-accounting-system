import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function GET() {
  try {
    console.log("Fetching sales orders from real orders...")
    
    // Fetch from your real orders collection (web orders)
    const ordersSnapshot = await db.collection("orders").get()
    const webOrders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Fetch manual orders
    const manualOrdersSnapshot = await db.collection("manual_orders").get()
    const manualOrders = manualOrdersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Map web orders to sales orders format
    const webSalesOrders = webOrders.map(order => ({
      id: order.id,
      customer_name: order.shippingAddress?.fullName || "Unknown Customer",
      customer_email: order.userId,
      website_order_id: order.id,
      created_at: order.createdAt?.toDate?.() || new Date(),
      status: mapOrderStatus(order.status),
      items: order.items?.map(item => ({
        product_id: item.productId,
        product_name: item.name,
        sku: item.productId,
        qty: item.quantity,
        quantity: item.quantity,
        unit_price: item.basePrice,
        total_price: item.adjustedPrice || item.basePrice
      })) || [],
      subtotal: order.total || 0,
      tax_amount: 0,
      shipping_cost: 0,
      total: order.total || 0,
      total_amount: order.total || 0,
      payment_method: order.paymentMethod || "unknown",
      shipping_address: order.shippingAddress || {},
      notes: `Original order status: ${order.status}`,
      order_source: "web", // Mark as web order
      updated_at: order.updatedAt?.toDate?.() || new Date()
    }))

    // Map manual orders to sales orders format (same structure as web orders)
    const manualSalesOrders = manualOrders.map(order => ({
      id: order.id,
      customer_name: order.shippingAddress?.fullName || "Manual Customer",
      customer_email: order.userId,
      website_order_id: order.id,
      created_at: order.createdAt?.toDate?.() || new Date(),
      status: order.status || "pending",
      items: order.items?.map(item => ({
        product_id: item.productId,
        product_name: item.name,
        sku: item.productId,
        qty: item.quantity,
        quantity: item.quantity,
        unit_price: item.basePrice,
        total_price: item.adjustedPrice || item.basePrice,
        category: item.category,
        color: item.color,
        size: item.size,
        image: item.image
      })) || [],
      subtotal: order.total || 0,
      tax_amount: 0,
      shipping_cost: 0,
      total: order.total || 0,
      total_amount: order.total || 0,
      payment_method: order.paymentMethod || "manual",
      shipping_address: order.shippingAddress || {},
      notes: "Manual order",
      order_source: "manual", // Mark as manual order
      updated_at: order.updatedAt?.toDate?.() || new Date()
    }))

    // Combine both types of orders
    const allSalesOrders = [...webSalesOrders, ...manualSalesOrders]

    console.log(`Mapped ${allSalesOrders.length} sales orders (${webOrders.length} web, ${manualOrders.length} manual)`)
    return NextResponse.json(allSalesOrders)
  } catch (error) {
    console.error("Error fetching sales orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch sales orders" },
      { status: 500 }
    )
  }
}

function mapOrderStatus(status: string): string {
  switch (status) {
    case "delivered":
      return "completed"
    case "shipped":
      return "shipped"
    case "processing":
      return "processing"
    case "cancelled":
      return "cancelled"
    case "refunded":
      return "refunded"
    default:
      return "pending"
  }
}

export async function POST(request: Request) {
  try {
    const orderData = await request.json()
    
    // Create manual order with same structure as web orders
    const now = new Date()
    const manualOrder = {
      // Basic order info
      carrier: null,
      createdAt: now,
      fragranceCodes: [],
      
      // Items array (same structure as web orders)
      items: orderData.items?.map(item => ({
        adjustedPrice: item.total_price || item.unit_price,
        basePrice: item.unit_price,
        category: item.category || "Manual",
        color: item.color || "",
        customization: null,
        image: item.image || "",
        name: item.product_name,
        productId: item.product_id,
        quantity: item.qty || item.quantity,
        size: item.size || "",
        taleId: null,
        type: "product"
      })) || [],
      
      // Payment and shipping
      paymentMethod: orderData.payment_method || "manual",
      shippingAddress: {
        city: orderData.shipping_address?.city || "",
        fullName: orderData.customer_name || "Manual Customer",
        phone: orderData.shipping_address?.phone || "",
        state: orderData.shipping_address?.state || "",
        street: orderData.shipping_address?.street || "",
        zipCode: orderData.shipping_address?.zipCode || ""
      },
      shippingMethod: null,
      
      // Status and tracking
      status: orderData.status || "pending",
      total: orderData.total || 0,
      trackingNumber: null,
      updatedAt: now,
      userId: orderData.customer_email || "manual_user",
      
      // Mark as manual order
      orderSource: "manual"
    }

    // Create in manual_orders collection
    const docRef = await db.collection("manual_orders").add(manualOrder)

    // Create accounting records for the manual order
    try {
      // Create sales order record in accounting system
      const salesOrderId = docRef.id
      const accountingSalesOrder = {
        id: salesOrderId,
        website_order_id: salesOrderId,
        customer_id: orderData.customer_email || "manual_user",
        customer_name: orderData.customer_name || "Manual Customer",
        items: orderData.items?.map(item => ({
          sku: item.product_id,
          qty: item.qty || item.quantity,
          unit_price: item.unit_price
        })) || [],
        status: "pending",
        created_at: now,
        total_amount: orderData.total || 0,
        order_source: "manual"
      }

      // Save to accounting sales orders collection
      await db.collection("acc_sales_orders").doc(salesOrderId).set(accountingSalesOrder)

      console.log(`Created accounting sales order ${salesOrderId}`)
    } catch (accountingError) {
      console.error("Error creating accounting records:", accountingError)
      // Don't fail the main request if accounting fails
    }

    return NextResponse.json({ id: docRef.id, ...manualOrder })
  } catch (error) {
    console.error("Error creating manual order:", error)
    return NextResponse.json(
      { error: "Failed to create manual order" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { orderId, status } = await request.json()
    
    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required" },
        { status: 400 }
      )
    }

    // Update manual order status in Firestore
    await db.collection("manual_orders").doc(orderId).update({
      status: status,
      updatedAt: new Date()
    })

    // If starting production, create a work order
    if (status === "producing") {
      try {
        // Get the order details - check both manual and web orders
        let orderData = null
        let orderSource = "manual"
        
        // First try manual orders
        const manualOrderDoc = await db.collection("manual_orders").doc(orderId).get()
        if (manualOrderDoc.exists) {
          orderData = manualOrderDoc.data()
          orderSource = "manual"
        } else {
          // Try web orders
          const webOrderDoc = await db.collection("orders").doc(orderId).get()
          if (webOrderDoc.exists) {
            orderData = webOrderDoc.data()
            orderSource = "web"
          }
        }
        
        if (orderData) {
          // Create work order
          const workOrder = {
            sales_order_id: orderId,
            bom_id: null, // No BOM for manual orders yet
            raw_materials_used: [], // Will be populated when materials are issued
            labor_hours: 0,
            overhead_cost: 0,
            status: "pending",
            created_at: new Date(),
            completionPercentage: 0,
            // Additional fields for tracking
            assigned_worker: null,
            start_time: new Date(),
            estimated_completion: null,
            notes: `Work order for ${orderSource} order ${orderId}`,
            items: orderData.items || [],
            // Customer information
            customer_name: orderData.shippingAddress?.fullName || orderData.customer_name || "Unknown Customer",
            customer_email: orderData.userId || orderData.customer_email || "unknown_user",
            total_amount: orderData.total || orderData.total_amount || 0,
            order_source: orderSource // Track if this is from web or manual order
          }

          // Create work order in Firestore
          const workOrderRef = await db.collection("acc_work_orders").add(workOrder)
          
          // Update accounting sales order status to "producing" (only for manual orders)
          if (orderSource === "manual") {
            await db.collection("acc_sales_orders").doc(orderId).update({
              status: "producing",
              updated_at: new Date()
            })

            // Create journal entry for work order start
            const journalEntry = {
              date: new Date(),
              entries: [
                { account_id: "INVENTORY_WIP", debit: orderData.total || 0, credit: 0, description: `Work order started for order ${orderId}` },
                { account_id: "COGS_PENDING", debit: 0, credit: orderData.total || 0, description: `Work order started for order ${orderId}` }
              ],
              linked_doc: workOrderRef.id,
              created_at: new Date()
            }
            
            await db.collection("acc_journal_entries").add(journalEntry)
          }
          
          console.log(`Created work order ${workOrderRef.id} for ${orderSource} order ${orderId}`)
        }
      } catch (workOrderError) {
        console.error("Error creating work order:", workOrderError)
        // Don't fail the main request if work order creation fails
      }
    }

    return NextResponse.json({ success: true, orderId, status })
  } catch (error) {
    console.error("Error updating manual order status:", error)
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    )
  }
}

