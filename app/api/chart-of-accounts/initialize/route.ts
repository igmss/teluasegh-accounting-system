import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function POST() {
  try {
    console.log("Initializing chart of accounts...")

    // Check if accounts already exist
    const existingAccountsSnapshot = await db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).get()
    
    if (!existingAccountsSnapshot.empty) {
      console.log("Chart of accounts already exists, skipping initialization")
      return NextResponse.json({
        success: true,
        message: "Chart of accounts already exists",
        accountCount: existingAccountsSnapshot.size
      })
    }

    // Initialize chart of accounts
    const accounts = [
      { id: "CASH", name: "Cash", type: "asset", balance: 315000 }, // Starting with EGP 315,000
      { id: "AR", name: "Accounts Receivable", type: "asset", balance: 0 },
      { id: "INVENTORY_RAW", name: "Raw Materials Inventory", type: "asset", balance: 0 },
      { id: "INVENTORY_WIP", name: "Work in Progress", type: "asset", balance: 0 },
      { id: "INVENTORY_FG", name: "Finished Goods Inventory", type: "asset", balance: 0 },
      { id: "EQUIPMENT", name: "Equipment", type: "asset", balance: 0 },
      { id: "ACCUMULATED_DEPRECIATION", name: "Accumulated Depreciation", type: "asset", balance: 0 },
      { id: "BUILDING", name: "Building", type: "asset", balance: 0 },
      { id: "ACCOUNTS_PAYABLE", name: "Accounts Payable", type: "liability", balance: 0 },
      { id: "ACCRUED_EXPENSES", name: "Accrued Expenses", type: "liability", balance: 0 },
      { id: "SHORT_TERM_DEBT", name: "Short-term Debt", type: "liability", balance: 0 },
      { id: "LONG_TERM_DEBT", name: "Long-term Debt", type: "liability", balance: 0 },
      { id: "RETAINED_EARNINGS", name: "Retained Earnings", type: "equity", balance: 0 },
      { id: "REVENUE", name: "Sales Revenue", type: "revenue", balance: 0 },
      { id: "COGS", name: "Cost of Goods Sold", type: "expense", balance: 0 },
      { id: "RETURNS", name: "Returns and Allowances", type: "expense", balance: 0 },
      { id: "VAT_PAYABLE", name: "VAT Payable", type: "liability", balance: 0 },
      { id: "WAGES_PAYABLE", name: "Wages Payable", type: "liability", balance: 0 },
      { id: "INVENTORY_ADJUSTMENT", name: "Inventory Adjustment", type: "expense", balance: 0 },
    ]

    const batch = db.batch()
    accounts.forEach((account) => {
      const ref = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc(account.id)
      batch.set(ref, {
        ...account,
        created_at: new Date(),
        last_updated: new Date()
      })
    })

    await batch.commit()
    console.log(`✅ Chart of accounts initialized with ${accounts.length} accounts`)

    return NextResponse.json({
      success: true,
      message: "Chart of accounts initialized successfully",
      accountCount: accounts.length
    })

  } catch (error) {
    console.error("Error initializing chart of accounts:", error)
    return NextResponse.json(
      { error: "Failed to initialize chart of accounts" },
      { status: 500 }
    )
  }
}
