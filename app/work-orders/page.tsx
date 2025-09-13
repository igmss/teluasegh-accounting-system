import { DashboardLayout } from "@/components/dashboard-layout"
import { WorkOrdersList } from "@/components/work-orders-list"

export default function WorkOrdersPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Work Orders</h1>
          <p className="text-muted-foreground">Track production jobs and material usage</p>
        </div>
        <WorkOrdersList />
      </div>
    </DashboardLayout>
  )
}
