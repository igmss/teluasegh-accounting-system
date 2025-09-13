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

// Function to automatically sync inventory values with Chart of Accounts
async function syncInventoryWithChartOfAccounts() {
  try {
    console.log("🔄 Auto-syncing inventory with Chart of Accounts...")
    
    const now = new Date()
    
    // Calculate total inventory value from acc_inventory_items
    const inventorySnapshot = await db.collection(COLLECTIONS.INVENTORY_ITEMS).get()
    
    let totalInventoryValue = 0
    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data()
      const itemValue = (data.quantity_on_hand || 0) * (data.cost_per_unit || 0)
      totalInventoryValue += itemValue
    })
    
    // Update INVENTORY_RAW account balance
    const inventoryRawRef = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc('INVENTORY_RAW')
    await inventoryRawRef.update({
      balance: totalInventoryValue,
      last_updated: now
    })
    
    // Also update CASH account balance based on journal entries
    await syncCashBalance()
    
    console.log(`✅ Auto-synced INVENTORY_RAW balance to EGP ${totalInventoryValue.toLocaleString()}`)
  } catch (error) {
    console.error("Error auto-syncing inventory with Chart of Accounts:", error)
  }
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

export async function GET() {
  try {
    const inventorySnapshot = await db.collection(COLLECTIONS.INVENTORY_ITEMS).get()
    const inventoryItems = inventorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return NextResponse.json(inventoryItems)
  } catch (error) {
    console.error("Error fetching inventory items:", error)
    return NextResponse.json(
      { error: "Failed to fetch inventory items" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const itemData = await request.json()
    
    // Add timestamps
    const now = new Date()
    const item = {
      ...itemData,
      createdAt: now,
      updatedAt: now,
      lastUpdated: now,
    }
    
    // Calculate total cost
    const totalCost = (item.quantity_on_hand || 0) * (item.cost_per_unit || 0)
    
    // Add inventory item
    const docRef = await db.collection(COLLECTIONS.INVENTORY_ITEMS).add(item)
    
    // Create journal entry for inventory purchase (Cash → Raw Materials)
    if (totalCost > 0) {
      const journalEntry = {
        date: now,
        entries: [
          {
            account_id: "INVENTORY_RAW",
            debit: totalCost,
            credit: 0,
            description: `Inventory purchase: ${item.name} - ${item.quantity_on_hand} ${item.unit}`
          },
          {
            account_id: "CASH",
            debit: 0,
            credit: totalCost,
            description: `Cash payment for inventory: ${item.name}`
          }
        ],
        linked_doc: docRef.id,
        created_at: now
      }
      
      await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)
      console.log(`Created journal entry for inventory purchase: EGP ${totalCost}`)
    }
    
    // Auto-sync Chart of Accounts with current inventory values
    await syncInventoryWithChartOfAccounts()
    
    return NextResponse.json({ id: docRef.id, ...item })
  } catch (error) {
    console.error("Error creating inventory item:", error)
    return NextResponse.json(
      { error: "Failed to create inventory item" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...itemData } = await request.json()
    
    const item = {
      ...itemData,
      updatedAt: new Date(),
      lastUpdated: new Date(),
    }
    
    await db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(id).update(item)
    
    // Auto-sync Chart of Accounts with current inventory values
    await syncInventoryWithChartOfAccounts()
    
    return NextResponse.json({ id, ...item })
  } catch (error) {
    console.error("Error updating inventory item:", error)
    return NextResponse.json(
      { error: "Failed to update inventory item" },
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
        { error: "Item ID is required" },
        { status: 400 }
      )
    }
    
    await db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(id).delete()
    
    // Auto-sync Chart of Accounts with current inventory values
    await syncInventoryWithChartOfAccounts()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting inventory item:", error)
    return NextResponse.json(
      { error: "Failed to delete inventory item" },
      { status: 500 }
    )
  }
}
