import { NextResponse } from "next/server"
import { AccountingService } from "@/lib/accounting-service"

export async function GET() {
  try {
    const accountingService = new AccountingService()
    
    // Get dashboard data
    const kpiData = await accountingService.getKPIData()
    const monthlyRevenue = await accountingService.getMonthlyRevenue()
    const topCustomers = await accountingService.getTopCustomers()
    const recentOrders = await accountingService.getRecentOrders()
    const inventoryAlerts = await accountingService.getInventoryAlerts()
    const workOrderStatus = await accountingService.getWorkOrderStatus()
    
    return NextResponse.json({
      kpiData,
      monthlyRevenue,
      topCustomers,
      recentOrders,
      inventoryAlerts,
      workOrderStatus
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}
