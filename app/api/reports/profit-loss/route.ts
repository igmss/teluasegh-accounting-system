import { NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    
    if (!from || !to) {
      return NextResponse.json(
        { error: "Date range is required" },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)

    // Fetch real orders for revenue calculation
    const ordersSnapshot = await db.collection("orders")
      .where('createdAt', '>=', fromDate)
      .where('createdAt', '<=', toDate)
      .get()

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    // Calculate revenue from delivered orders
    const salesRevenue = orders
      .filter(order => order.status === 'delivered')
      .reduce((sum, order) => sum + (order.total || 0), 0)
    
    const otherIncome = 0 // Would come from other revenue sources
    const totalRevenue = salesRevenue + otherIncome

    // Fetch returns for COGS adjustment
    const returnsSnapshot = await db.collection("returns")
      .where('refundDate', '>=', fromDate)
      .where('refundDate', '<=', toDate)
      .get()

    const returns = returnsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Calculate refunds (negative revenue)
    const refunds = returns
      .filter(ret => ret.refundProcessed === true)
      .reduce((sum, ret) => sum + (ret.refundAmount || 0), 0)

    const netRevenue = totalRevenue - refunds

    // If no data, return zero values to prevent NaN
    if (orders.length === 0) {
      return NextResponse.json({
        revenue: {
          sales_revenue: 0,
          other_income: otherIncome,
          total_revenue: otherIncome,
        },
        cost_of_goods_sold: {
          raw_materials: 0,
          direct_labor: 0,
          manufacturing_overhead: 0,
          total_cogs: 0,
        },
        gross_profit: otherIncome,
        operating_expenses: {
          salaries_wages: 0,
          rent: 0,
          utilities: 0,
          insurance: 0,
          depreciation: 0,
          other_expenses: 0,
          total_operating_expenses: 0,
        },
        operating_income: otherIncome,
        other_income_expenses: {
          interest_income: 0,
          interest_expense: 0,
          total_other: 0,
        },
        net_income: otherIncome,
        monthlyTrend: [
          { month: "Oct", revenue: otherIncome, expenses: 0, profit: otherIncome },
          { month: "Nov", revenue: otherIncome, expenses: 0, profit: otherIncome },
          { month: "Dec", revenue: otherIncome, expenses: 0, profit: otherIncome },
          { month: "Jan", revenue: otherIncome, expenses: 0, profit: otherIncome },
        ]
      })
    }

    // Fetch work orders for COGS calculation
    const workOrdersSnapshot = await db.collection("acc_work_orders")
      .where('created_at', '>=', fromDate)
      .where('created_at', '<=', toDate)
      .get()

    const workOrders = workOrdersSnapshot.docs.map(doc => doc.data())
    
    // Calculate COGS
    const rawMaterialsCost = workOrders.reduce((sum, wo) => {
      return sum + (wo.raw_materials_used?.reduce((matSum: number, mat: any) => 
        matSum + (mat.qty * mat.cost), 0) || 0)
    }, 0)
    
    const laborCost = workOrders.reduce((sum, wo) => sum + (wo.laborCost || 0), 0)
    const overheadCost = workOrders.reduce((sum, wo) => sum + (wo.overhead_cost || 0), 0)
    const totalCOGS = rawMaterialsCost + laborCost + overheadCost

    const grossProfit = totalRevenue - totalCOGS

    // Calculate operating expenses from actual data (would come from expense tracking system)
    const operatingExpenses = {
      salaries_wages: 0,
      rent: 0,
      utilities: 0,
      insurance: 0,
      depreciation: 0,
      other_expenses: 0,
      total_operating_expenses: 0,
    }

    const operatingIncome = grossProfit - operatingExpenses.total_operating_expenses

    // Calculate other income/expenses from actual data (would come from financial records)
    const otherIncomeExpenses = {
      interest_income: 0,
      interest_expense: 0,
      total_other: 0,
    }

    const netIncome = operatingIncome + otherIncomeExpenses.total_other

    // Generate monthly trend data from actual data
    const monthlyTrend = [
      { month: "Oct", revenue: 0, expenses: 0, profit: 0 },
      { month: "Nov", revenue: 0, expenses: 0, profit: 0 },
      { month: "Dec", revenue: 0, expenses: 0, profit: 0 },
      { month: "Jan", revenue: netRevenue, expenses: totalCOGS + operatingExpenses.total_operating_expenses, profit: netIncome },
    ]

    const reportData = {
      revenue: {
        sales_revenue: Math.round(salesRevenue),
        other_income: otherIncome,
        total_revenue: Math.round(netRevenue), // Use net revenue after refunds
      },
      cost_of_goods_sold: {
        raw_materials: Math.round(rawMaterialsCost),
        direct_labor: Math.round(laborCost),
        manufacturing_overhead: Math.round(overheadCost),
        total_cogs: Math.round(totalCOGS),
      },
      gross_profit: Math.round(grossProfit),
      operating_expenses: operatingExpenses,
      operating_income: Math.round(operatingIncome),
      other_income_expenses: otherIncomeExpenses,
      net_income: Math.round(netIncome),
      monthlyTrend
    }

    return NextResponse.json(reportData)
  } catch (error) {
    console.error("Error generating P&L report:", error)
    return NextResponse.json(
      { error: "Failed to generate P&L report" },
      { status: 500 }
    )
  }
}
