import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function GET() {
  try {
    const customersSnapshot = await db.collection(COLLECTIONS.CUSTOMERS).get()
    const customers = customersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(customers)
  } catch (error) {
    console.error("Error fetching customers:", error)
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const customerData = await request.json()
    
    // Add timestamps
    const now = new Date()
    const customer = {
      ...customerData,
      createdAt: now,
      updatedAt: now,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: null,
    }
    
    const docRef = await db.collection(COLLECTIONS.CUSTOMERS).add(customer)
    
    return NextResponse.json({ id: docRef.id, ...customer })
  } catch (error) {
    console.error("Error creating customer:", error)
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...customerData } = await request.json()
    
    const customer = {
      ...customerData,
      updatedAt: new Date(),
    }
    
    await db.collection(COLLECTIONS.CUSTOMERS).doc(id).update(customer)
    
    return NextResponse.json({ id, ...customer })
  } catch (error) {
    console.error("Error updating customer:", error)
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      )
    }
    
    await db.collection(COLLECTIONS.CUSTOMERS).doc(id).delete()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting customer:", error)
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    )
  }
}
