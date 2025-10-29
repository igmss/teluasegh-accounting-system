import { NextRequest, NextResponse } from "next/server";
import { db, COLLECTIONS } from "@/lib/firebase";
import { OrderItemDesignService } from "@/lib/services/order-item-design-service";

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log(`🔍 Debugging order ${orderId}...`);

    // 1. Get the order data
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data();
    console.log(`📦 Order data:`, orderData);

    // 2. Check order items
    const orderItems = orderData?.items || [];
    console.log(`📋 Order items (${orderItems.length}):`, orderItems);

    // 3. Try to find designs for each item
    const itemDesignMappings = [];
    for (const item of orderItems) {
      console.log(`🔍 Processing item: ${item.name} (${item.productId})`);
      
      // Try different methods to find design
      let design = null;
      let method = '';

      // Method 1: By productId
      if (item.productId) {
        const designByProductId = await db.collection(COLLECTIONS.DESIGNS)
          .where("productId", "==", item.productId)
          .limit(1)
          .get();
        
        if (!designByProductId.empty) {
          design = { id: designByProductId.docs[0].id, ...designByProductId.docs[0].data() };
          method = 'productId';
        }
      }

      // Method 2: By name (if not found by productId)
      if (!design && item.name) {
        const designsSnapshot = await db.collection(COLLECTIONS.DESIGNS).get();
        
        for (const doc of designsSnapshot.docs) {
          const designData = doc.data();
          const designName = designData.name?.toLowerCase() || '';
          const itemNameLower = item.name.toLowerCase();
          
          if (designName === itemNameLower || 
              designName.includes(itemNameLower) || 
              itemNameLower.includes(designName)) {
            design = { id: doc.id, ...designData };
            method = 'name';
            break;
          }
        }
      }

      // Method 3: By category (if not found by name)
      if (!design && item.category) {
        const designByCategory = await db.collection(COLLECTIONS.DESIGNS)
          .where("category", "==", item.category)
          .limit(1)
          .get();

        if (!designByCategory.empty) {
          design = { id: designByCategory.docs[0].id, ...designByCategory.docs[0].data() };
          method = 'category';
        }
      }

      itemDesignMappings.push({
        item,
        design,
        method,
        found: !!design
      });

      console.log(`✅ Item ${item.name}: ${design ? `Found design "${design.name}" by ${method}` : 'No design found'}`);
    }

    // 4. Test cost calculation
    console.log(`💰 Testing cost calculation...`);
    const costCalculation = await OrderItemDesignService.calculateOrderCostsFromDesigns(orderItems);
    console.log(`💰 Cost calculation result:`, costCalculation);

    // 5. Check if work order exists
    const workOrderSnapshot = await db.collection(COLLECTIONS.WORK_ORDERS)
      .where("sales_order_id", "==", orderId)
      .get();

    const workOrders = workOrderSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`🔧 Work orders found: ${workOrders.length}`);

    // 6. Check all designs in database
    const allDesignsSnapshot = await db.collection(COLLECTIONS.DESIGNS).get();
    const allDesigns = allDesignsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      productId: doc.data().productId,
      category: doc.data().category,
      materialCost: doc.data().materialCost,
      laborCost: doc.data().laborCost,
      overheadCost: doc.data().overheadCost
    }));

    console.log(`🎨 All designs in database (${allDesigns.length}):`, allDesigns);

    return NextResponse.json({
      success: true,
      orderId,
      orderData: {
        id: orderDoc.id,
        ...orderData
      },
      orderItems,
      itemDesignMappings,
      costCalculation,
      workOrders,
      allDesigns,
      summary: {
        totalItems: orderItems.length,
        itemsWithDesigns: itemDesignMappings.filter(m => m.found).length,
        totalEstimatedCost: costCalculation.totalEstimatedCost,
        workOrdersCount: workOrders.length,
        totalDesignsInDB: allDesigns.length
      }
    });

  } catch (error) {
    console.error("Error debugging order:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
