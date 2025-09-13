import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

// TypeScript interfaces for journal entries
interface JournalEntry {
  account_id: string
  debit: number
  credit: number
  description: string
}

interface JournalDocument {
  entries: JournalEntry[]
  date: any
  linked_doc?: string
  created_at: any
}

// Function to sync CASH balance from journal entries
async function syncCashBalance() {
  try {
    console.log("🔄 Auto-syncing CASH balance...")
    
    const now = new Date()
    
    // Calculate CASH balance from journal entries
    const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
    
    let cashBalance = 0
    journalSnapshot.docs.forEach(doc => {
      const entry = doc.data() as JournalDocument
      if (entry.entries) {
        entry.entries.forEach((subEntry: JournalEntry) => {
          if (subEntry.account_id === 'CASH') {
            cashBalance += (subEntry.debit || 0) - (subEntry.credit || 0)
          }
        })
      }
    })
    
    // Update CASH account balance
    const cashRef = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc('CASH')
    await cashRef.update({
      balance: cashBalance,
      last_updated: now
    })
    
    console.log(`✅ Auto-synced CASH balance to EGP ${cashBalance.toLocaleString()}`)
  } catch (error) {
    console.error("Error auto-syncing CASH balance:", error)
  }
}

// Function to sync liability account balance
async function syncLiabilityBalance(accountId: string) {
  try {
    console.log(`🔄 Auto-syncing ${accountId} balance...`)
    
    const now = new Date()
    
    // Calculate balance from journal entries
    const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
    
    let balance = 0
    journalSnapshot.docs.forEach(doc => {
      const entry = doc.data() as JournalDocument
      if (entry.entries) {
        entry.entries.forEach((subEntry: JournalEntry) => {
          if (subEntry.account_id === accountId) {
            // For liability accounts: credit increases, debit decreases
            balance += (subEntry.credit || 0) - (subEntry.debit || 0)
          }
        })
      }
    })
    
    // Update account balance
    const accountRef = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc(accountId)
    await accountRef.update({
      balance: balance,
      last_updated: now
    })
    
    console.log(`✅ Auto-synced ${accountId} balance to EGP ${balance.toLocaleString()}`)
  } catch (error) {
    console.error(`Error auto-syncing ${accountId} balance:`, error)
  }
}

export async function POST(request: Request) {
  try {
    const { amount, description, accountId } = await request.json()
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid loan amount is required" },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const loanDescription = description || `Loan received - EGP ${amount.toLocaleString()}`
    const liabilityAccount = accountId || "SHORT_TERM_DEBT"
    
    // Create journal entry for the loan
    const journalEntry = {
      date: now,
      entries: [
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
          description: `Loan payable - EGP ${amount.toLocaleString()}`
        }
      ],
      linked_doc: `LOAN_${Date.now()}`,
      created_at: now
    }
    
    await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)
    console.log(`✅ Created journal entry for loan: EGP ${amount.toLocaleString()}`)
    
    // Auto-sync Chart of Accounts balances
    await syncCashBalance()
    await syncLiabilityBalance(liabilityAccount)
    
    return NextResponse.json({
      success: true,
      message: `Loan of EGP ${amount.toLocaleString()} recorded successfully`,
      loan: {
        amount: amount,
        description: loanDescription,
        liabilityAccount: liabilityAccount,
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

export async function GET() {
  try {
    // Get all loan transactions
    const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
    
    const loans = []
    journalSnapshot.docs.forEach(doc => {
      const entry = doc.data()
      if (entry.entries) {
        const hasCashDebit = entry.entries.some((subEntry: JournalEntry) => 
          subEntry.account_id === 'CASH' && subEntry.debit > 0
        )
        const hasLiabilityCredit = entry.entries.some((subEntry: JournalEntry) => 
          (subEntry.account_id === 'SHORT_TERM_DEBT' || subEntry.account_id === 'LONG_TERM_DEBT') && subEntry.credit > 0
        )
        
        if (hasCashDebit && hasLiabilityCredit) {
          const cashEntry = entry.entries.find((subEntry: JournalEntry) => 
            subEntry.account_id === 'CASH' && subEntry.debit > 0
          )
          const liabilityEntry = entry.entries.find((subEntry: JournalEntry) => 
            (subEntry.account_id === 'SHORT_TERM_DEBT' || subEntry.account_id === 'LONG_TERM_DEBT') && subEntry.credit > 0
          )
          
          loans.push({
            id: doc.id,
            amount: cashEntry?.debit || 0,
            description: cashEntry?.description || '',
            liabilityAccount: liabilityEntry?.account_id || '',
            date: entry.date?.toDate() || new Date(),
            created_at: entry.created_at?.toDate() || new Date()
          })
        }
      }
    })
    
    return NextResponse.json(loans)
    
  } catch (error) {
    console.error("Error fetching loans:", error)
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    )
  }
}
