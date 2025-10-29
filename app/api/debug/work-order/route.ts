import { NextRequest, NextResponse } from "next/server";
import { db, COLLECTIONS } from "@/lib/firebase";

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('workOrderId');
    
    if (!workOrderId) {
      return NextResponse.json({ error: 'Work Order ID is required' }, { status: 400 });
    }

    console.log(`🔍 Debugging work order ${workOrderId}...`);

    // 1. Get the work order data
    const workOrderDoc = await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).get();
    if (!workOrderDoc.exists) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const workOrderData = workOrderDoc.data();
    console.log(`🔧 Work order data:`, workOrderData);

    const salesOrderId = workOrderData?.sales_order_id;
    if (!salesOrderId) {
      return NextResponse.json({
        success: true,
        workOrderId,
        workOrderData,
        error: 'No sales_order_id found in work order'
      });
    }

    console.log(`📦 Sales order ID: ${salesOrderId}`);

    // 2. Try to get from acc_sales_orders first
    const accSalesOrderDoc = await db.collection(COLLECTIONS.SALES_ORDERS).doc(salesOrderId).get();
    let accSalesOrderData = null;
    if (accSalesOrderDoc.exists) {
      accSalesOrderData = accSalesOrderDoc.data();
      console.log(`📋 Accounting sales order data:`, accSalesOrderData);
    } else {
      console.log(`❌ No accounting sales order found for ${salesOrderId}`);
    }

    // 3. Try to get from orders collection
    const orderDoc = await db.collection("orders").doc(salesOrderId).get();
    let orderData = null;
    if (orderDoc.exists) {
      orderData = orderDoc.data();
      console.log(`🌐 Web order data:`, orderData);
    } else {
      console.log(`❌ No web order found for ${salesOrderId}`);
    }

    // 4. Try to get from manual_orders collection
    const manualOrderDoc = await db.collection("manual_orders").doc(salesOrderId).get();
    let manualOrderData = null;
    if (manualOrderDoc.exists) {
      manualOrderData = manualOrderDoc.data();
      console.log(`📝 Manual order data:`, manualOrderData);
    } else {
      console.log(`❌ No manual order found for ${salesOrderId}`);
    }

    // 5. Extract customer data from each source
    let customerDataFromAcc = null;
    if (accSalesOrderData?.customer_id) {
      const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(accSalesOrderData.customer_id).get();
      if (customerDoc.exists) {
        customerDataFromAcc = customerDoc.data();
        console.log(`👤 Customer data from accounting:`, customerDataFromAcc);
      }
    }

    let customerDataFromOrder = null;
    if (orderData) {
      customerDataFromOrder = {
        name: orderData?.shippingAddress?.fullName || "Unknown Customer",
        email: orderData?.userId || "",
        phone: orderData?.shippingAddress?.phone || "",
        address: `${orderData?.shippingAddress?.street || ""} ${orderData?.shippingAddress?.city || ""}`.trim()
      };
      console.log(`👤 Customer data from web order:`, customerDataFromOrder);
    }

    let customerDataFromManual = null;
    if (manualOrderData) {
      customerDataFromManual = {
        name: manualOrderData?.shippingAddress?.fullName || "Unknown Customer",
        email: manualOrderData?.userId || "",
        phone: manualOrderData?.shippingAddress?.phone || "",
        address: `${manualOrderData?.shippingAddress?.street || ""} ${manualOrderData?.shippingAddress?.city || ""}`.trim()
      };
      console.log(`👤 Customer data from manual order:`, customerDataFromManual);
    }

    return NextResponse.json({
      success: true,
      workOrderId,
      salesOrderId,
      workOrderData,
      accSalesOrderData,
      orderData,
      manualOrderData,
      customerDataFromAcc,
      customerDataFromOrder,
      customerDataFromManual,
      summary: {
        hasAccSalesOrder: !!accSalesOrderData,
        hasWebOrder: !!orderData,
        hasManualOrder: !!manualOrderData,
        hasCustomerFromAcc: !!customerDataFromAcc,
        hasCustomerFromOrder: !!customerDataFromOrder,
        hasCustomerFromManual: !!customerDataFromManual
      }
    });

  } catch (error) {
    console.error("Error debugging work order:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
