import { DashboardLayout } from "@/components/dashboard-layout"
import { InventoryManagement } from "@/components/inventory-management"

export default function InventoryPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Inventory Management</h1>
          <p className="text-muted-foreground">Track raw materials and finished goods inventory</p>
        </div>
        <InventoryManagement />
      </div>
    </DashboardLayout>
  )
}
