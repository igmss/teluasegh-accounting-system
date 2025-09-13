import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"

export async function GET(request: Request) {
  try {
    console.log("Balance sheet API called")
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    
    if (!from || !to) {
      return NextResponse.json(
        { error: "Date range is required" },
        { status: 400 }
      )
    }

    // Fetch chart of accounts data
    console.log("Fetching chart of accounts...")
    const accountsSnapshot = await db.collection("acc_chart_of_accounts").get()
    const accounts = accountsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{id: string, name: string, type: string, balance: number}>
    console.log(`Found ${accounts.length} accounts:`, accounts.map(acc => ({ id: acc.id, name: acc.name, balance: acc.balance })))

    // Fetch journal entries to calculate real balances
    console.log("Fetching journal entries for balance calculation...")
    const journalSnapshot = await db.collection("acc_journal_entries").get()
    const journalEntries = journalSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date()
    })) as Array<{id: string, date: Date, entries: Array<{account_id: string, debit: number, credit: number, description: string}>}>
    console.log(`Found ${journalEntries.length} journal entries`)

    // Calculate account balances from journal entries
    const calculateAccountBalance = (accountId: string) => {
      let balance = 0
      journalEntries.forEach(entry => {
        entry.entries.forEach((subEntry) => {
          if (subEntry.account_id === accountId) {
            // For asset accounts: debit increases, credit decreases
            // For liability/equity accounts: credit increases, debit decreases
            const account = accounts.find(acc => acc.id === accountId)
            if (account?.type === 'asset') {
              balance += (subEntry.debit || 0) - (subEntry.credit || 0)
            } else {
              // For liability and equity accounts, reverse the calculation
              balance += (subEntry.credit || 0) - (subEntry.debit || 0)
            }
          }
        })
      })
      return balance
    }

    // Get account balances - use Chart of Accounts balance if available, otherwise calculate from journal entries
    const getAccountBalance = (accountId: string) => {
      const account = accounts.find(acc => acc.id === accountId)
      if (account && account.balance !== undefined) {
        console.log(`Using Chart of Accounts balance for ${accountId}: ${account.balance}`)
        return account.balance
      }
      const calculatedBalance = calculateAccountBalance(accountId)
      console.log(`Calculated balance for ${accountId}: ${calculatedBalance}`)
      return calculatedBalance
    }

    // If no accounts, return zero values
    if (accounts.length === 0) {
      return NextResponse.json({
        assets: {
          current_assets: {
            cash: 0,
            accounts_receivable: 0,
            inventory_raw: 0,
            inventory_wip: 0,
            inventory_finished: 0,
            prepaid_expenses: 0,
            total_current_assets: 0,
          },
          fixed_assets: {
            equipment: 0,
            accumulated_depreciation: 0,
            building: 0,
            accumulated_depreciation_building: 0,
            total_fixed_assets: 0,
          },
          total_assets: 0,
        },
        liabilities: {
          current_liabilities: {
            accounts_payable: 0,
            accrued_expenses: 0,
            short_term_debt: 0,
            total_current_liabilities: 0,
          },
          long_term_liabilities: {
            long_term_debt: 0,
            total_long_term_liabilities: 0,
          },
          total_liabilities: 0,
        },
        equity: {
          retained_earnings: 0,
          current_earnings: 0,
          total_equity: 0,
        },
      })
    }

    // Map accounts to balance sheet structure
    const balanceSheetData = {
      assets: {
        current_assets: {
          cash: getAccountBalance('CASH'),
          accounts_receivable: getAccountBalance('AR'),
          inventory_raw: getAccountBalance('INVENTORY_RAW'),
          inventory_wip: getAccountBalance('INVENTORY_WIP'),
          inventory_finished: getAccountBalance('INVENTORY_FG'),
          prepaid_expenses: accounts.filter(acc => acc.type === 'asset' && acc.name.toLowerCase().includes('prepaid')).reduce((sum, acc) => sum + getAccountBalance(acc.id), 0),
          total_current_assets: 0, // Will be calculated
        },
        fixed_assets: {
          equipment: getAccountBalance('EQUIPMENT'),
          machinery: getAccountBalance('MACHINERY'),
          furniture: getAccountBalance('FURNITURE'),
          vehicles: getAccountBalance('VEHICLES'),
          computer_equipment: getAccountBalance('COMPUTER_EQUIPMENT'),
          office_equipment: getAccountBalance('OFFICE_EQUIPMENT'),
          building: getAccountBalance('BUILDING'),
          accumulated_depreciation: getAccountBalance('ACCUMULATED_DEPRECIATION'),
          total_fixed_assets: 0, // Will be calculated
        },
        digital_assets: {
          software: getAccountBalance('SOFTWARE'),
          domain_names: getAccountBalance('DOMAIN_NAMES'),
          digital_content: getAccountBalance('DIGITAL_CONTENT'),
          digital_assets: getAccountBalance('DIGITAL_ASSETS'),
          cryptocurrency: getAccountBalance('CRYPTOCURRENCY'),
          nft_assets: getAccountBalance('NFT_ASSETS'),
          total_digital_assets: 0, // Will be calculated
        },
        other_assets: {
          prepaid_expenses: getAccountBalance('PREPAID_EXPENSES'),
          intangible_assets: getAccountBalance('INTANGIBLE_ASSETS'),
          other_assets: getAccountBalance('OTHER_ASSETS'),
          total_other_assets: 0, // Will be calculated
        },
        total_assets: 0, // Will be calculated
      },
      liabilities: {
        current_liabilities: {
          accounts_payable: getAccountBalance('ACCOUNTS_PAYABLE'),
          accrued_expenses: getAccountBalance('ACCRUED_EXPENSES'),
          short_term_debt: getAccountBalance('SHORT_TERM_DEBT'),
          total_current_liabilities: 0, // Will be calculated
        },
        long_term_liabilities: {
          long_term_debt: getAccountBalance('LONG_TERM_DEBT'),
          total_long_term_liabilities: 0, // Will be calculated
        },
        total_liabilities: 0, // Will be calculated
      },
      equity: {
        retained_earnings: getAccountBalance('RETAINED_EARNINGS'),
        current_earnings: 0, // Would come from current period P&L
        total_equity: 0, // Will be calculated
      },
    }

    // Debug logging
    console.log("Calculated balances:", {
      cash: balanceSheetData.assets.current_assets.cash,
      ar: balanceSheetData.assets.current_assets.accounts_receivable,
      inventory_raw: balanceSheetData.assets.current_assets.inventory_raw,
      inventory_wip: balanceSheetData.assets.current_assets.inventory_wip,
      inventory_finished: balanceSheetData.assets.current_assets.inventory_finished,
    })

    // Calculate totals
    balanceSheetData.assets.current_assets.total_current_assets = 
      balanceSheetData.assets.current_assets.cash + 
      balanceSheetData.assets.current_assets.accounts_receivable + 
      balanceSheetData.assets.current_assets.inventory_raw + 
      balanceSheetData.assets.current_assets.inventory_wip + 
      balanceSheetData.assets.current_assets.inventory_finished + 
      balanceSheetData.assets.current_assets.prepaid_expenses

    balanceSheetData.assets.fixed_assets.total_fixed_assets = 
      balanceSheetData.assets.fixed_assets.equipment + 
      balanceSheetData.assets.fixed_assets.machinery +
      balanceSheetData.assets.fixed_assets.furniture +
      balanceSheetData.assets.fixed_assets.vehicles +
      balanceSheetData.assets.fixed_assets.computer_equipment +
      balanceSheetData.assets.fixed_assets.office_equipment +
      balanceSheetData.assets.fixed_assets.building - 
      balanceSheetData.assets.fixed_assets.accumulated_depreciation

    balanceSheetData.assets.digital_assets.total_digital_assets = 
      balanceSheetData.assets.digital_assets.software + 
      balanceSheetData.assets.digital_assets.domain_names +
      balanceSheetData.assets.digital_assets.digital_content +
      balanceSheetData.assets.digital_assets.digital_assets +
      balanceSheetData.assets.digital_assets.cryptocurrency +
      balanceSheetData.assets.digital_assets.nft_assets

    balanceSheetData.assets.other_assets.total_other_assets = 
      balanceSheetData.assets.other_assets.prepaid_expenses + 
      balanceSheetData.assets.other_assets.intangible_assets +
      balanceSheetData.assets.other_assets.other_assets

    balanceSheetData.liabilities.current_liabilities.total_current_liabilities = 
      balanceSheetData.liabilities.current_liabilities.accounts_payable + 
      balanceSheetData.liabilities.current_liabilities.accrued_expenses + 
      balanceSheetData.liabilities.current_liabilities.short_term_debt

    balanceSheetData.liabilities.long_term_liabilities.total_long_term_liabilities = 
      balanceSheetData.liabilities.long_term_liabilities.long_term_debt

    balanceSheetData.assets.total_assets = 
      balanceSheetData.assets.current_assets.total_current_assets + 
      balanceSheetData.assets.fixed_assets.total_fixed_assets +
      balanceSheetData.assets.digital_assets.total_digital_assets +
      balanceSheetData.assets.other_assets.total_other_assets

    balanceSheetData.liabilities.total_liabilities = 
      balanceSheetData.liabilities.current_liabilities.total_current_liabilities + 
      balanceSheetData.liabilities.long_term_liabilities.total_long_term_liabilities

    balanceSheetData.equity.total_equity = 
      balanceSheetData.equity.retained_earnings + 
      balanceSheetData.equity.current_earnings

    console.log("Balance sheet data calculated:", balanceSheetData)
    return NextResponse.json(balanceSheetData)
  } catch (error) {
    console.error("Error generating balance sheet report:", error)
    return NextResponse.json(
      { error: "Failed to generate balance sheet report" },
      { status: 500 }
    )
  }
}
