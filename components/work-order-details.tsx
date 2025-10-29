"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"

interface WorkOrderDetailsProps {
  workOrder: any
}

export function WorkOrderDetails({ workOrder }: WorkOrderDetailsProps) {
  const [laborHours, setLaborHours] = useState(workOrder.labor_hours?.toString() || "0")
  const [overheadCost, setOverheadCost] = useState(workOrder.overhead_cost?.toString() || "0")

  const totalMaterialCost = (workOrder.raw_materials_used || []).reduce(
    (sum: number, material: any) => sum + material.qty * material.cost,
    0,
  )

  const totalOrderValue = workOrder.total_amount || 0
  const totalCost = totalMaterialCost + (workOrder.labor_cost || 0) + (workOrder.overhead_cost || 0)
  const profit = totalOrderValue - totalCost
  const profitMargin = totalOrderValue > 0 ? (profit / totalOrderValue) * 100 : 0

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
              <span className="text-muted-foreground">Order Status:</span>
              <Badge variant={workOrder.order_status === "completed" ? "default" : "secondary"}>
                {workOrder.order_status || "Unknown"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Work Order Status:</span>
              <Badge variant={workOrder.status === "completed" ? "default" : "secondary"}>{workOrder.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{workOrder.customer_name || "Unknown Customer"}</span>
            </div>
            {workOrder.customer_email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-sm">{workOrder.customer_email}</span>
              </div>
            )}
            {workOrder.customer_phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{workOrder.customer_phone}</span>
              </div>
            )}
            {workOrder.customer_address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium text-sm max-w-[200px] truncate">{workOrder.customer_address}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      {workOrder.items && workOrder.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workOrder.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.sku || item.name || "Unknown Product"}</div>
                    <div className="text-sm text-muted-foreground">
                      Quantity: {item.qty} × {formatCurrency(item.unit_price)}
                    </div>
                  </div>
                  <div className="font-medium">{formatCurrency(item.qty * item.unit_price)}</div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Order Total:</span>
                <span>{formatCurrency(totalOrderValue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="overhead-cost">Overhead Cost</Label>
              <Input
                id="overhead-cost"
                type="number"
                step="0.01"
                value={overheadCost}
                onChange={(e) => setOverheadCost(e.target.value)}
              />
            </div>
            <div className="pt-3 border-t space-y-2">
              <div className="flex justify-between">
                <span>Material Cost:</span>
                <span>{formatCurrency(totalMaterialCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Labor Cost:</span>
                <span>{formatCurrency(workOrder.labor_cost || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Overhead Cost:</span>
                <span>{formatCurrency(workOrder.overhead_cost || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total Cost:</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profitability Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Order Value:</span>
              <span>{formatCurrency(totalOrderValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Cost:</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Profit/Loss:</span>
              <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                {formatCurrency(profit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Profit Margin:</span>
              <span className={profitMargin >= 0 ? "text-green-600" : "text-red-600"}>
                {profitMargin.toFixed(1)}%
              </span>
            </div>
            {workOrder.estimated_cost && (
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span>Estimated Cost:</span>
                  <span>{formatCurrency(workOrder.estimated_cost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cost Variance:</span>
                  <span className={totalCost <= workOrder.estimated_cost ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(totalCost - workOrder.estimated_cost)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Materials Used</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrder.raw_materials_used && workOrder.raw_materials_used.length > 0 ? (
            <div className="space-y-3">
              {workOrder.raw_materials_used.map((material: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{material.item_id}</div>
                    <div className="text-sm text-muted-foreground">
                      Qty: {material.qty} × {formatCurrency(material.cost)}
                    </div>
                  </div>
                  <div className="font-medium">{formatCurrency(material.qty * material.cost)}</div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total Material Cost:</span>
                <span>{formatCurrency(totalMaterialCost)}</span>
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