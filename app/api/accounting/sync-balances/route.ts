import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

// Centralized Accounting Service for systematic balance management
export class CentralizedAccountingService {
  
  // Universal function to sync any account balance from journal entries
  static async syncAccountBalance(accountId: string): Promise<number> {
    try {
      console.log(`🔄 Auto-syncing ${accountId} balance...`)
      
      const now = new Date()
      
      // First, get the account type
      const accountRef = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc(accountId)
      const accountDoc = await accountRef.get()
      const account = accountDoc.data()
      
      if (!account) {
        console.log(`Account ${accountId} not found, skipping...`)
        return 0
      }
      
      // Calculate balance from journal entries
      const journalSnapshot = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).get()
      
      let balance = 0
      journalSnapshot.docs.forEach(doc => {
        const entry = doc.data()
        if (entry.entries) {
          entry.entries.forEach((subEntry: any) => {
            if (subEntry.account_id === accountId) {
              if (account.type === 'asset') {
                // For asset accounts: debit increases, credit decreases
                balance += (subEntry.debit || 0) - (subEntry.credit || 0)
              } else if (account.type === 'liability' || account.type === 'equity') {
                // For liability and equity accounts: credit increases, debit decreases
                balance += (subEntry.credit || 0) - (subEntry.debit || 0)
              } else if (account.type === 'revenue') {
                // For revenue accounts: credit increases, debit decreases
                balance += (subEntry.credit || 0) - (subEntry.debit || 0)
              } else if (account.type === 'expense') {
                // For expense accounts: debit increases, credit decreases (same as assets)
                balance += (subEntry.debit || 0) - (subEntry.credit || 0)
              }
            }
          })
        }
      })
      
      // Update account balance
      await accountRef.update({
        balance: balance,
        last_updated: now
      })
      
      console.log(`✅ Auto-synced ${accountId} balance to $${balance.toLocaleString()}`)
      return balance
      
    } catch (error) {
      console.error(`Error auto-syncing ${accountId} balance:`, error)
      throw error
    }
  }
  
  // Sync multiple accounts at once
  static async syncMultipleAccountBalances(accountIds: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {}
    
    for (const accountId of accountIds) {
      try {
        results[accountId] = await this.syncAccountBalance(accountId)
      } catch (error) {
        console.error(`Failed to sync ${accountId}:`, error)
        results[accountId] = 0
      }
    }
    
    return results
  }
  
  // Sync all accounts in chart of accounts
  static async syncAllAccountBalances(): Promise<Record<string, number>> {
    try {
      console.log("🔄 Auto-syncing ALL account balances...")
      
      // Get all accounts from chart of accounts
      const accountsSnapshot = await db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).get()
      const accountIds = accountsSnapshot.docs.map(doc => doc.id)
      
      console.log(`Found ${accountIds.length} accounts to sync`)
      
      return await this.syncMultipleAccountBalances(accountIds)
      
    } catch (error) {
      console.error("Error syncing all account balances:", error)
      throw error
    }
  }
  
  // Create journal entry and auto-sync affected accounts
  static async createJournalEntryAndSync(entries: any[], linkedDoc?: string): Promise<string> {
    try {
      const now = new Date()
      
      // Create journal entry
      const journalEntry = {
        date: now,
        entries: entries,
        linked_doc: linkedDoc || `ENTRY_${Date.now()}`,
        created_at: now
      }
      
      const docRef = await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)
      console.log(`✅ Created journal entry: ${docRef.id}`)
      
      // Get unique account IDs from entries
      const affectedAccountIds = [...new Set(entries.map(entry => entry.account_id))]
      
      // Auto-sync all affected accounts
      await this.syncMultipleAccountBalances(affectedAccountIds)
      
      return docRef.id
      
    } catch (error) {
      console.error("Error creating journal entry and syncing:", error)
      throw error
    }
  }
  
  // Validate double-entry bookkeeping
  static validateJournalEntry(entries: any[]): { isValid: boolean; error?: string } {
    let totalDebits = 0
    let totalCredits = 0
    
    entries.forEach(entry => {
      totalDebits += entry.debit || 0
      totalCredits += entry.credit || 0
    })
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return {
        isValid: false,
        error: `Debits (${totalDebits}) do not equal Credits (${totalCredits})`
      }
    }
    
    return { isValid: true }
  }
}

// API endpoint for systematic balance synchronization
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { accountIds, syncAll } = body
    
    let results: Record<string, number> = {}
    
    if (syncAll) {
      console.log("🔄 Syncing ALL account balances...")
      results = await CentralizedAccountingService.syncAllAccountBalances()
    } else if (accountIds && Array.isArray(accountIds)) {
      console.log(`🔄 Syncing specific accounts: ${accountIds.join(', ')}`)
      results = await CentralizedAccountingService.syncMultipleAccountBalances(accountIds)
    } else {
      return NextResponse.json(
        { error: "Either 'syncAll: true' or 'accountIds' array is required" },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: "Account balances synchronized successfully",
      results: results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Error in balance sync API:", error)
    return NextResponse.json(
      { error: "Failed to synchronize account balances" },
      { status: 500 }
    )
  }
}

// GET endpoint to check current balances
export async function GET() {
  try {
    console.log("📊 Fetching current account balances...")
    
    const accountsSnapshot = await db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).get()
    const accounts = accountsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json({
      success: true,
      accounts: accounts,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Error fetching account balances:", error)
    return NextResponse.json(
      { error: "Failed to fetch account balances" },
      { status: 500 }
    )
  }
}
