import { DashboardLayout } from "@/components/dashboard-layout"
import { SalesOrdersList } from "@/components/sales-orders-list"

export default function SalesOrdersPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Sales Orders</h1>
          <p className="text-muted-foreground">Manage customer orders and track production status</p>
        </div>
        <SalesOrdersList />
      </div>
    </DashboardLayout>
  )
}
