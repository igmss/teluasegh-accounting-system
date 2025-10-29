import { type NextRequest, NextResponse } from "next/server"
import { AccountingService } from "@/lib/accounting-service"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountingService = new AccountingService()

    // Update inventory valuations and check stock levels
    const result = await accountingService.updateInventoryValuations()

    return NextResponse.json({
      success: true,
      updated: result.updated,
      lowStockAlerts: result.lowStockAlerts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
