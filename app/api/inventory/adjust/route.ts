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

export async function POST(request: Request) {
  try {
    const { itemId, adjustmentQty, reason, adjustmentType } = await request.json()
    
    if (!itemId || adjustmentQty === undefined || !reason) {
      return NextResponse.json(
        { error: "Item ID, adjustment quantity, and reason are required" },
        { status: 400 }
      )
    }

    // Get current inventory item
    const inventoryRef = db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(itemId)
    const inventoryDoc = await inventoryRef.get()
    
    if (!inventoryDoc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      )
    }

    const currentData = inventoryDoc.data()
    const currentQty = currentData?.quantity_on_hand || 0
    const unitCost = currentData?.cost_per_unit || 0
    
    // Calculate new quantity based on adjustment type
    let newQty = currentQty
    let actualAdjustment = 0
    
    if (adjustmentType === 'set') {
      // Set to specific quantity
      newQty = adjustmentQty
      actualAdjustment = adjustmentQty - currentQty
    } else if (adjustmentType === 'add') {
      // Add to current quantity
      newQty = currentQty + adjustmentQty
      actualAdjustment = adjustmentQty
    } else if (adjustmentType === 'subtract') {
      // Subtract from current quantity
      newQty = Math.max(0, currentQty - adjustmentQty)
      actualAdjustment = -adjustmentQty
    }

    // Update inventory quantity
    await inventoryRef.update({
      quantity_on_hand: newQty,
      last_updated: new Date()
    })

    // Create inventory movement record
    const movement = {
      item_id: itemId,
      item_name: currentData?.name || 'Unknown Item',
      movement_type: 'adjustment',
      quantity: actualAdjustment,
      unit_cost: unitCost,
      total_cost: Math.abs(actualAdjustment) * unitCost,
      reason: reason,
      reference: `ADJ-${Date.now()}`,
      created_at: new Date(),
      created_by: 'manual'
    }
    
    await db.collection(COLLECTIONS.INVENTORY_MOVEMENTS).add(movement)

    // Create journal entry for inventory adjustment
    const adjustmentValue = Math.abs(actualAdjustment) * unitCost
    
    if (adjustmentValue > 0) {
      const journalEntry = {
        date: new Date(),
        entries: [
          {
            account_id: actualAdjustment > 0 ? "INVENTORY_RAW" : "INVENTORY_ADJUSTMENT",
            debit: actualAdjustment > 0 ? adjustmentValue : 0,
            credit: actualAdjustment < 0 ? adjustmentValue : 0,
            description: `Inventory adjustment: ${currentData?.name} - ${actualAdjustment > 0 ? '+' : ''}${actualAdjustment} units (${reason})`
          }
        ],
        linked_doc: movement.reference,
        created_at: new Date()
      }
      
      await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)
    }

    // Auto-sync Chart of Accounts with current inventory values
    await syncInventoryWithChartOfAccounts()

    return NextResponse.json({
      success: true,
      message: "Inventory adjustment completed successfully",
      adjustment: {
        itemId,
        itemName: currentData?.name,
        previousQty: currentQty,
        newQty: newQty,
        adjustment: actualAdjustment,
        reason: reason
      }
    })

  } catch (error) {
    console.error("Error adjusting inventory:", error)
    return NextResponse.json(
      { error: "Failed to adjust inventory" },
      { status: 500 }
    )
  }
}
