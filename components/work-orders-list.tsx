"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, CheckCircle, Clock, Wrench } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export function WorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filteredOrders, setFilteredOrders] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)

  // Fetch work orders from Firestore
  useEffect(() => {
    async function fetchWorkOrders() {
      try {
        const response = await fetch('/api/work-orders')
        if (!response.ok) {
          throw new Error('Failed to fetch work orders')
        }
        const workOrdersData = await response.json()
        setWorkOrders(workOrdersData)
      } catch (error) {
        console.error("Error loading work orders:", error)
        setWorkOrders([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchWorkOrders()
  }, [])
  
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any | null>(null)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [updateData, setUpdateData] = useState({
    materials: [{ item_id: "", qty: 1, cost: 0 }],
    laborHours: 0,
    laborCost: 0
  })

  const handleUpdateMaterials = async () => {
    if (!selectedWorkOrder) return

    try {
      const response = await fetch('/api/work-orders/update-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId: selectedWorkOrder.id,
          materials: updateData.materials,
          laborHours: updateData.laborHours,
          laborCost: updateData.laborCost
        })
      })

      if (response.ok) {
        // Refresh work orders
        const workOrdersResponse = await fetch('/api/work-orders')
        if (workOrdersResponse.ok) {
          const workOrdersData = await workOrdersResponse.json()
          setWorkOrders(workOrdersData)
        }
        setIsUpdateDialogOpen(false)
        alert('Materials and labor updated successfully!')
      } else {
        console.error('Failed to update materials')
        alert('Failed to update materials. Please try again.')
      }
    } catch (error) {
      console.error('Error updating materials:', error)
      alert('Error updating materials. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="destructive">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Wrench className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handleStartWorkOrder = async (workOrderId: string) => {
    try {
      // Update work order status in database
      const response = await fetch('/api/work-orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: workOrderId,
          status: "in_progress",
          started_at: new Date()
        })
      })

      if (response.ok) {
        // Update local state
        setWorkOrders((prev) =>
          prev.map((wo) =>
            wo.id === workOrderId ? { ...wo, status: "in_progress" as const, started_at: new Date() } : wo,
          ),
        )
      } else {
        console.error('Failed to update work order status')
      }
    } catch (error) {
      console.error('Error updating work order:', error)
    }
  }

  const handleCompleteWorkOrder = async (workOrderId: string) => {
    try {
      // Update work order status in database
      const response = await fetch('/api/work-orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: workOrderId,
          status: "completed",
          completionPercentage: 100,
          completed_at: new Date()
        })
      })

      if (response.ok) {
        // Get the work order to find the sales order ID
        const workOrder = workOrders.find(wo => wo.id === workOrderId)
        if (workOrder && workOrder.sales_order_id) {
          // Trigger complete order workflow
          const completeResponse = await fetch('/api/workflow/complete-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId: workOrder.sales_order_id
            })
          })

          if (completeResponse.ok) {
            const result = await completeResponse.json()
            console.log('Order completed:', result)
            alert(`Work order completed! Order ${workOrder.sales_order_id} completed and invoice ${result.invoiceId} generated.`)
          } else {
            console.error('Failed to complete order workflow')
            alert('Work order completed but failed to complete order workflow.')
          }
        }

        // Update local state
        setWorkOrders((prev) =>
          prev.map((wo) =>
            wo.id === workOrderId
              ? {
                  ...wo,
                  status: "completed" as const,
                  completionPercentage: 100,
                  completed_at: new Date(),
                }
              : wo,
          ),
        )

        // Refresh work orders to get updated data
        const workOrdersResponse = await fetch('/api/work-orders')
        if (workOrdersResponse.ok) {
          const workOrdersData = await workOrdersResponse.json()
          setWorkOrders(workOrdersData)
        }
      } else {
        console.error('Failed to update work order status')
        alert('Failed to complete work order. Please try again.')
      }
    } catch (error) {
      console.error('Error completing work order:', error)
      alert('Error completing work order. Please try again.')
    }
  }

  const totalMaterialCost = (materials: Array<{ item_id: string; qty: number; cost: number }>) => {
    return materials.reduce((sum, material) => sum + material.qty * material.cost, 0)
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{workOrders.filter((wo) => wo.status === "pending").length}</div>
            <div className="text-sm text-muted-foreground">Pending Work Orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{workOrders.filter((wo) => wo.status === "in_progress").length}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{workOrders.filter((wo) => wo.status === "completed").length}</div>
            <div className="text-sm text-muted-foreground">Completed Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Work Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work Order ID</TableHead>
                <TableHead>Sales Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Material Cost</TableHead>
                <TableHead>Labor Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((workOrder) => (
                <TableRow key={workOrder.id}>
                  <TableCell className="font-medium">{workOrder.id}</TableCell>
                  <TableCell>{workOrder.sales_order_id}</TableCell>
                  <TableCell>{workOrder.customer_name || "Unknown Customer"}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{workOrder.completionPercentage || workOrder.completion_percentage || 0}%</span>
                      </div>
                      <Progress value={workOrder.completionPercentage || workOrder.completion_percentage || 0} className="w-20" />
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(totalMaterialCost(workOrder.raw_materials_used || []))}</TableCell>
                  <TableCell>{workOrder.labor_hours || 0}h</TableCell>
                  <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedWorkOrder(workOrder)}>
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Work Order Details</DialogTitle>
                          </DialogHeader>
                          {selectedWorkOrder && <WorkOrderDetails workOrder={selectedWorkOrder} />}
                        </DialogContent>
                      </Dialog>

                      {workOrder.status === "pending" && (
                        <Button size="sm" onClick={() => handleStartWorkOrder(workOrder.id)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}

                      {workOrder.status === "in_progress" && (
                        <Button size="sm" onClick={() => handleCompleteWorkOrder(workOrder.id)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {workOrder.status === "pending" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedWorkOrder(workOrder)
                            setIsUpdateDialogOpen(true)
                          }}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Update Materials Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Materials & Labor</DialogTitle>
          </DialogHeader>
          
          {selectedWorkOrder && (
            <div className="space-y-4">
              <div>
                <Label>Work Order: {selectedWorkOrder.id}</Label>
                <p className="text-sm text-muted-foreground">
                  Sales Order: {selectedWorkOrder.sales_order_id}
                </p>
              </div>

              <div>
                <Label>Materials Used</Label>
                {updateData.materials.map((material: any, index: number) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Item ID"
                      value={material.item_id}
                      onChange={(e) => {
                        const newMaterials = [...updateData.materials]
                        newMaterials[index].item_id = e.target.value
                        setUpdateData({ ...updateData, materials: newMaterials })
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={material.qty}
                      onChange={(e) => {
                        const newMaterials = [...updateData.materials]
                        newMaterials[index].qty = Number(e.target.value)
                        setUpdateData({ ...updateData, materials: newMaterials })
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Cost per unit"
                      value={material.cost}
                      onChange={(e) => {
                        const newMaterials = [...updateData.materials]
                        newMaterials[index].cost = Number(e.target.value)
                        setUpdateData({ ...updateData, materials: newMaterials })
                      }}
                    />
                  </div>
                ))}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setUpdateData({
                      ...updateData,
                      materials: [...updateData.materials, { item_id: "", qty: 1, cost: 0 }]
                    })
                  }}
                >
                  Add Material
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Labor Hours</Label>
                  <Input
                    type="number"
                    value={updateData.laborHours}
                    onChange={(e) => setUpdateData({ ...updateData, laborHours: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Labor Cost (EGP)</Label>
                  <Input
                    type="number"
                    value={updateData.laborCost}
                    onChange={(e) => setUpdateData({ ...updateData, laborCost: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateMaterials}>
                  Update Materials & Labor
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WorkOrderDetails({ workOrder }: { workOrder: any }) {
  const [laborHours, setLaborHours] = useState(workOrder.labor_hours?.toString() || "0")
  const [overheadCost, setOverheadCost] = useState(workOrder.overhead_cost?.toString() || "0")

  const totalMaterialCost = (workOrder.raw_materials_used || []).reduce(
    (sum: number, material: any) => sum + material.qty * material.cost,
    0,
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Work Order Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Work Order ID:</span>
              <span className="font-medium">{workOrder.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sales Order:</span>
              <span className="font-medium">{workOrder.sales_order_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{workOrder.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={workOrder.status === "completed" ? "default" : "secondary"}>{workOrder.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="labor-hours">Labor Hours</Label>
              <Input
                id="labor-hours"
                type="number"
                step="0.5"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overhead-cost">Overhead Cost ($)</Label>
              <Input
                id="overhead-cost"
                type="number"
                step="0.01"
                value={overheadCost}
                onChange={(e) => setOverheadCost(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Materials Used</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrder.raw_materials_used.length > 0 ? (
            <div className="space-y-3">
              {workOrder.raw_materials_used.map((material: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{material.item_id}</div>
                    <div className="text-sm text-muted-foreground">
                      Qty: {material.qty} × ${material.cost.toFixed(2)}
                    </div>
                  </div>
                  <div className="font-medium">${(material.qty * material.cost).toFixed(2)}</div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total Material Cost:</span>
                <span>${totalMaterialCost.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No materials allocated yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
