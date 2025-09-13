import { DashboardLayout } from "@/components/dashboard-layout"
import { PaymentManagement } from "@/components/payment-management"

export default function PaymentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Payments</h1>
          <p className="text-muted-foreground">Track customer payments and cash flow</p>
        </div>
        <PaymentManagement />
      </div>
    </DashboardLayout>
  )
}
