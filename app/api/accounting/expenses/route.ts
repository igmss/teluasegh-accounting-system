import { NextResponse } from "next/server"
import { CentralizedAccountingService } from "../sync-balances/route"

// API endpoint for recording expenses with automatic balance synchronization
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { amount, description, expenseAccount, paymentMethod } = body
    
    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid expense amount is required" },
        { status: 400 }
      )
    }
    
    if (!expenseAccount) {
      return NextResponse.json(
        { error: "Expense account is required" },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const expenseDescription = description || `Business expense - $${amount.toLocaleString()}`
    const paymentAccount = paymentMethod === 'cash' ? 'CASH' : 'ACCOUNTS_PAYABLE'
    
    // Create journal entry for the expense
    const entries = [
      {
        account_id: expenseAccount,
        debit: amount,
        credit: 0,
        description: expenseDescription
      },
      {
        account_id: paymentAccount,
        debit: 0,
        credit: amount,
        description: `Payment for ${expenseDescription}`
      }
    ]
    
    // Create journal entry and auto-sync balances
    const journalEntryId = await CentralizedAccountingService.createJournalEntryAndSync(
      entries,
      `EXPENSE_${Date.now()}`
    )
    
    return NextResponse.json({
      success: true,
      message: `Expense of $${amount.toLocaleString()} recorded successfully`,
      journalEntryId: journalEntryId,
      expense: {
        amount: amount,
        description: expenseDescription,
        expenseAccount: expenseAccount,
        paymentAccount: paymentAccount,
        date: now
      }
    })
    
  } catch (error) {
    console.error("Error recording expense:", error)
    return NextResponse.json(
      { error: "Failed to record expense" },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch expenses
export async function GET() {
  try {
    const { db, COLLECTIONS } = await import("@/lib/firebase")
    
    // Get all journal entries that represent expenses
    const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
    
    const expenses = []
    journalSnapshot.docs.forEach(doc => {
      const entry = doc.data()
      if (entry.entries) {
        const hasExpenseDebit = entry.entries.some((subEntry: any) => 
          (subEntry.account_id === 'GENERAL_EXPENSES' || 
           subEntry.account_id === 'COGS' || 
           subEntry.account_id === 'OPERATING_EXPENSES') && 
          subEntry.debit > 0
        )
        const hasPaymentCredit = entry.entries.some((subEntry: any) => 
          (subEntry.account_id === 'CASH' || subEntry.account_id === 'ACCOUNTS_PAYABLE') && 
          subEntry.credit > 0
        )
        
        if (hasExpenseDebit && hasPaymentCredit) {
          const expenseEntry = entry.entries.find((subEntry: any) => 
            (subEntry.account_id === 'GENERAL_EXPENSES' || 
             subEntry.account_id === 'COGS' || 
             subEntry.account_id === 'OPERATING_EXPENSES') && 
            subEntry.debit > 0
          )
          const paymentEntry = entry.entries.find((subEntry: any) => 
            (subEntry.account_id === 'CASH' || subEntry.account_id === 'ACCOUNTS_PAYABLE') && 
            subEntry.credit > 0
          )
          
          expenses.push({
            id: doc.id,
            amount: expenseEntry?.debit || 0,
            description: expenseEntry?.description || '',
            expenseAccount: expenseEntry?.account_id || '',
            paymentAccount: paymentEntry?.account_id || '',
            date: entry.date?.toDate() || new Date(),
            created_at: entry.created_at?.toDate() || new Date()
          })
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      expenses: expenses,
      count: expenses.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}
