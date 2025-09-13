import { DashboardLayout } from "@/components/dashboard-layout"
import { FinancialReports } from "@/components/financial-reports"

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Financial Reports</h1>
          <p className="text-muted-foreground">Comprehensive financial analysis and reporting</p>
        </div>
        <FinancialReports />
      </div>
    </DashboardLayout>
  )
}
