import { DashboardLayout } from "@/components/dashboard-layout"
import { InvoiceManagement } from "@/components/invoice-management"

export default function InvoicesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and track payments</p>
        </div>
        <InvoiceManagement />
      </div>
    </DashboardLayout>
  )
}
