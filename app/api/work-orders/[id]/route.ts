import { NextRequest, NextResponse } from "next/server";
import { WorkOrderService } from "@/lib/services/work-order-service";

// GET /api/work-orders/[id] - Get work order with design information
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Getting work order ${params.id} with design information...`);
    
    const result = await WorkOrderService.getWorkOrderWithDesign(params.id);
    
    if (!result.workOrder) {
      return NextResponse.json(
        { success: false, error: "Work order not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        workOrder: result.workOrder,
        design: result.design,
        materialRequirements: result.materialRequirements
      }
    });

  } catch (error) {
    console.error("Error getting work order with design:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT /api/work-orders/[id] - Update work order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    
    console.log(`Updating work order ${params.id} with:`, updates);
    
    // Update work order
    const { db, COLLECTIONS } = await import("@/lib/firebase");
    await db.collection(COLLECTIONS.WORK_ORDERS).doc(params.id).update({
      ...updates,
      updated_at: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: "Work order updated successfully"
    });

  } catch (error) {
    console.error("Error updating work order:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
