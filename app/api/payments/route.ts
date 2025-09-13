import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function GET() {
  try {
    const paymentsSnapshot = await db.collection("acc_payments").get()
    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(payments)
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const paymentData = await request.json()
    
    // Generate payment ID
    const paymentId = `PAY-${Date.now()}`
    
    // Create payment record
    const payment = {
      id: paymentId,
      ...paymentData,
      created_at: new Date(),
      date: paymentData.date || new Date()
    }
    
    // Save to accounting payments collection
    await db.collection("acc_payments").doc(paymentId).set(payment)
    
    // Create journal entry for payment
    const journalEntry = {
      date: new Date(),
      entries: [
        { account_id: "CASH", debit: paymentData.amount, credit: 0, description: `Payment received ${paymentId}` },
        { account_id: "ACCOUNTS_RECEIVABLE", debit: 0, credit: paymentData.amount, description: `Payment received ${paymentId}` }
      ],
      linked_doc: paymentId,
      created_at: new Date()
    }
    
    await db.collection("acc_journal_entries").add(journalEntry)
    
    return NextResponse.json({ id: paymentId, ...payment })
  } catch (error) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...paymentData } = await request.json()
    
    const payment = {
      ...paymentData,
      updated_at: new Date(),
    }
    
    await db.collection("acc_payments").doc(id).update(payment)
    
    return NextResponse.json({ id, ...payment })
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    )
  }
}
