import { NextRequest, NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, balance, description } = body

    if (!accountId || balance === undefined) {
      return NextResponse.json(
        { error: "Account ID and balance are required" },
        { status: 400 }
      )
    }

    // Get the current account to check if it exists
    const accountRef = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc(accountId)
    const accountDoc = await accountRef.get()

    if (!accountDoc.exists) {
      return NextResponse.json(
        { error: `Account ${accountId} not found` },
        { status: 404 }
      )
    }

    const currentAccount = accountDoc.data()
    const oldBalance = currentAccount?.balance || 0
    const balanceDifference = balance - oldBalance

    // Update the account balance
    await accountRef.update({
      balance: balance,
      last_updated: new Date()
    })

    // Create a journal entry to record the balance adjustment
    const journalEntry = {
      date: new Date(),
      description: description || `Balance adjustment for ${accountId}`,
      entries: [
        {
          account_id: accountId,
          debit: balanceDifference > 0 ? balanceDifference : 0,
          credit: balanceDifference < 0 ? Math.abs(balanceDifference) : 0,
          description: `Balance adjustment: ${oldBalance} → ${balance}`
        }
      ],
      created_at: new Date(),
      updated_at: new Date()
    }

    // Add the journal entry
    await db.collection(COLLECTIONS.JOURNAL_ENTRIES).add(journalEntry)

    console.log(`Updated ${accountId} balance from ${oldBalance} to ${balance}`)

    return NextResponse.json({
      success: true,
      message: `Account ${accountId} balance updated successfully`,
      oldBalance,
      newBalance: balance,
      difference: balanceDifference
    })

  } catch (error) {
    console.error("Error updating account balance:", error)
    return NextResponse.json(
      { error: "Failed to update account balance" },
      { status: 500 }
    )
  }
}
