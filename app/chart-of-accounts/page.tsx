import { DashboardLayout } from "@/components/dashboard-layout"
import { ChartOfAccountsManagement } from "@/components/chart-of-accounts-management"

export default function ChartOfAccountsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your accounting structure and journal entries</p>
        </div>
        <ChartOfAccountsManagement />
      </div>
    </DashboardLayout>
  )
}
