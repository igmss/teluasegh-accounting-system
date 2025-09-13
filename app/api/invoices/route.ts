import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function GET() {
  try {
    const invoicesSnapshot = await db.collection("acc_invoices").get()
    const invoices = invoicesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(invoices)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const invoiceData = await request.json()
    
    // Generate invoice ID
    const invoiceId = `INV-${Date.now()}`
    
    // Create invoice
    const invoice = {
      id: invoiceId,
      ...invoiceData,
      created_at: new Date(),
      status: "unpaid"
    }
    
    // Save to accounting invoices collection
    await db.collection("acc_invoices").doc(invoiceId).set(invoice)
    
    // Create journal entry for invoice
    const journalEntry = {
      date: new Date(),
      entries: [
        { account_id: "ACCOUNTS_RECEIVABLE", debit: invoiceData.total_amount || 0, credit: 0, description: `Invoice ${invoiceId}` },
        { account_id: "SALES_REVENUE", debit: 0, credit: invoiceData.total_amount || 0, description: `Sales revenue ${invoiceId}` }
      ],
      linked_doc: invoiceId,
      created_at: new Date()
    }
    
    await db.collection("acc_journal_entries").add(journalEntry)
    
    return NextResponse.json({ id: invoiceId, ...invoice })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...invoiceData } = await request.json()
    
    const invoice = {
      ...invoiceData,
      updated_at: new Date(),
    }
    
    await db.collection("acc_invoices").doc(id).update(invoice)
    
    return NextResponse.json({ id, ...invoice })
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    )
  }
}
