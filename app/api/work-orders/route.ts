import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function GET() {
  try {
    const workOrdersSnapshot = await db.collection("acc_work_orders").get()
    const workOrders = workOrdersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(workOrders)
  } catch (error) {
    console.error("Error fetching work orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch work orders" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const workOrderData = await request.json()
    
    // Add timestamps
    const now = new Date()
    const workOrder = {
      ...workOrderData,
      createdAt: now,
      updatedAt: now,
      status: workOrderData.status || "pending",
      completionPercentage: workOrderData.completionPercentage || 0,
    }
    
    const docRef = await db.collection("acc_work_orders").add(workOrder)
    
    return NextResponse.json({ id: docRef.id, ...workOrder })
  } catch (error) {
    console.error("Error creating work order:", error)
    return NextResponse.json(
      { error: "Failed to create work order" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...workOrderData } = await request.json()
    
    const workOrder = {
      ...workOrderData,
      updatedAt: new Date(),
    }
    
    await db.collection("acc_work_orders").doc(id).update(workOrder)
    
    return NextResponse.json({ id, ...workOrder })
  } catch (error) {
    console.error("Error updating work order:", error)
    return NextResponse.json(
      { error: "Failed to update work order" },
      { status: 500 }
    )
  }
}
