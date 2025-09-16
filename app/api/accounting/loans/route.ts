import { NextResponse } from "next/server"
import { CentralizedAccountingService } from "../sync-balances/route"

// API endpoint for recording loans with automatic balance synchronization
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { amount, description, lenderName, loanType } = body
    
    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid loan amount is required" },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const loanDescription = description || `Loan received from ${lenderName || 'Lender'} - $${amount.toLocaleString()}`
    const liabilityAccount = loanType === 'long-term' ? 'LONG_TERM_DEBT' : 'SHORT_TERM_DEBT'
    
    // Create journal entry for the loan
    const entries = [
      {
        account_id: "CASH",
        debit: amount,
        credit: 0,
        description: loanDescription
      },
      {
        account_id: liabilityAccount,
        debit: 0,
        credit: amount,
        description: `Loan payable - $${amount.toLocaleString()}`
      }
    ]
    
    // Create journal entry and auto-sync balances
    const journalEntryId = await CentralizedAccountingService.createJournalEntryAndSync(
      entries,
      `LOAN_${Date.now()}_${lenderName?.replace(/\s+/g, '_') || 'LENDER'}`
    )
    
    return NextResponse.json({
      success: true,
      message: `Loan of $${amount.toLocaleString()} recorded successfully`,
      journalEntryId: journalEntryId,
      loan: {
        amount: amount,
        description: loanDescription,
        lenderName: lenderName,
        liabilityAccount: liabilityAccount,
        loanType: loanType || 'short-term',
        date: now
      }
    })
    
  } catch (error) {
    console.error("Error recording loan:", error)
    return NextResponse.json(
      { error: "Failed to record loan" },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch loans
export async function GET() {
  try {
    const { db, COLLECTIONS } = await import("@/lib/firebase")
    
    // Get all journal entries that represent loans
    const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
    
    const loans = []
    journalSnapshot.docs.forEach(doc => {
      const entry = doc.data()
      if (entry.entries) {
        const hasCashDebit = entry.entries.some((subEntry: any) => 
          subEntry.account_id === 'CASH' && subEntry.debit > 0
        )
        const hasLiabilityCredit = entry.entries.some((subEntry: any) => 
          (subEntry.account_id === 'SHORT_TERM_DEBT' || subEntry.account_id === 'LONG_TERM_DEBT') && 
          subEntry.credit > 0
        )
        
        if (hasCashDebit && hasLiabilityCredit) {
          const cashEntry = entry.entries.find((subEntry: any) => 
            subEntry.account_id === 'CASH' && subEntry.debit > 0
          )
          const liabilityEntry = entry.entries.find((subEntry: any) => 
            (subEntry.account_id === 'SHORT_TERM_DEBT' || subEntry.account_id === 'LONG_TERM_DEBT') && 
            subEntry.credit > 0
          )
          
          loans.push({
            id: doc.id,
            amount: cashEntry?.debit || 0,
            description: cashEntry?.description || '',
            liabilityAccount: liabilityEntry?.account_id || '',
            loanType: liabilityEntry?.account_id === 'LONG_TERM_DEBT' ? 'long-term' : 'short-term',
            date: entry.date?.toDate() || new Date(),
            created_at: entry.created_at?.toDate() || new Date()
          })
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      loans: loans,
      count: loans.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Error fetching loans:", error)
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    )
  }
}
