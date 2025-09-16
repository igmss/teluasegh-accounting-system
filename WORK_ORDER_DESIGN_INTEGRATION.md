# Work Order Integration with Design Management

## Overview

The work order system has been enhanced to integrate with the design management system, allowing for accurate cost calculation and material tracking based on configured designs.

## Key Features

### 1. Design-Based Cost Calculation
- **Automatic Cost Estimation**: Work orders automatically calculate costs based on design configuration
- **Material Requirements**: Pulls material requirements from design settings
- **Labor Cost Calculation**: Uses design manufacturing time and labor rates
- **Overhead Allocation**: Applies design overhead costs

### 2. Enhanced Work Order Structure
- **Design Reference**: Links work orders to specific designs
- **Cost Tracking**: Tracks estimated vs actual costs
- **Material Tracking**: Monitors materials issued vs required
- **Profitability Analysis**: Calculates profit margins

### 3. Real-Time Cost Updates
- **Material Issuance**: Updates costs when materials are issued
- **Labor Tracking**: Updates labor costs based on actual hours
- **Completion Tracking**: Final cost calculation on completion

## Technical Implementation

### Updated WorkOrder Interface

```typescript
interface WorkOrder {
  id: string
  sales_order_id: string
  design_id?: string // Reference to design configuration
  design_name?: string // Cached design name for display
  materials_issued?: {
    inventoryItemId: string
    inventoryItemName: string
    quantityIssued: number
    unitCost: number
    totalCost: number
  }[]
  labor_hours: number
  labor_cost: number // Cost per hour * hours
  overhead_cost: number
  total_cost: number // Calculated total cost
  estimated_cost: number // Estimated cost from design
  status: "pending" | "in_progress" | "completed"
  // ... other fields
}
```

### New WorkOrderService

#### **createWorkOrderWithDesign()**
- Creates work order with design-based cost calculation
- Checks material availability
- Calculates estimated costs from design configuration
- Links work order to design

#### **updateWorkOrderCosts()**
- Updates work order with actual material costs
- Calculates labor costs based on hours worked
- Updates total cost calculation

#### **getWorkOrderWithDesign()**
- Retrieves work order with design information
- Includes material requirements
- Provides complete cost breakdown

#### **calculateWorkOrderProfitability()**
- Calculates revenue vs costs
- Determines profit margin
- Provides profitability analysis

## API Endpoints

### 1. **GET /api/work-orders**
- Returns all work orders with design information
- Includes cost breakdowns and material requirements

### 2. **POST /api/work-orders**
- Creates work order with design integration
- Automatically calculates costs if design_id provided
- Falls back to simple creation if no design

### 3. **GET /api/work-orders/[id]**
- Returns work order with design details
- Includes material requirements
- Shows cost breakdown

### 4. **GET /api/work-orders/[id]/profitability**
- Calculates work order profitability
- Returns revenue, costs, profit, and margin

## Cost Calculation Flow

### 1. **Work Order Creation**
```
1. Design ID provided → Fetch design configuration
2. Calculate estimated costs:
   - Material Cost = design.materialCost × quantity
   - Labor Cost = design.laborCost × quantity
   - Overhead Cost = design.overheadCost × quantity
3. Check material availability
4. Create work order with estimated costs
```

### 2. **Material Issuance**
```
1. Issue materials from inventory
2. Update work order with actual material costs
3. Calculate total cost = materials + labor + overhead
4. Update work order status to "in_progress"
```

### 3. **Work Order Completion**
```
1. Record actual labor hours
2. Calculate final labor cost
3. Update total cost with actual values
4. Transfer from WIP to Finished Goods
5. Calculate final profitability
```

## Usage Examples

### 1. **Create Work Order with Design**

```typescript
// API Call
const response = await fetch('/api/work-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sales_order_id: 'SO-123',
    design_id: 'design-456',
    quantity: 5,
    customer_name: 'John Doe',
    total_amount: 2500
  })
});

const result = await response.json();
// Returns: { workOrderId, estimatedCost, message }
```

### 2. **Get Work Order with Design Details**

```typescript
// API Call
const response = await fetch('/api/work-orders/WO-123');
const result = await response.json();

// Returns:
{
  workOrder: { /* work order data */ },
  design: { /* design configuration */ },
  materialRequirements: [ /* material requirements */ ]
}
```

### 3. **Calculate Profitability**

```typescript
// API Call
const response = await fetch('/api/work-orders/WO-123/profitability');
const result = await response.json();

// Returns:
{
  revenue: 2500,
  totalCost: 1800,
  profit: 700,
  profitMargin: 28
}
```

## Integration with Sales Orders

### **Automatic Work Order Creation**
When a sales order status is updated to "processing":

1. **Check for Design**: Look for design_id in order data
2. **Create Work Order**: Use design-based cost calculation
3. **Set Estimated Costs**: Based on design configuration
4. **Link to Design**: Reference design for material requirements

### **Manual Work Order Creation**
For orders without design:

1. **Create Basic Work Order**: Without design integration
2. **Manual Cost Entry**: Allow manual cost configuration
3. **Material Tracking**: Track materials manually

## Benefits

### 1. **Accurate Costing**
- Real-time cost calculation based on design
- Automatic material requirement tracking
- Precise labor cost calculation

### 2. **Better Planning**
- Know exact material requirements before production
- Check material availability before starting
- Estimate completion time based on design

### 3. **Profitability Tracking**
- Real-time profit margin calculation
- Compare estimated vs actual costs
- Identify cost optimization opportunities

### 4. **Inventory Integration**
- Automatic material deduction
- Real-time inventory updates
- Material availability checking

## Future Enhancements

### 1. **Production Scheduling**
- Schedule work orders based on material availability
- Resource planning and allocation
- Production timeline optimization

### 2. **Quality Control**
- Material quality tracking
- Batch/lot number management
- Quality inspection integration

### 3. **Advanced Analytics**
- Cost trend analysis
- Profitability reporting
- Production efficiency metrics

### 4. **Supplier Integration**
- Automatic reorder points
- Supplier price comparison
- Purchase order generation

This integration provides a complete solution for work order management with accurate cost tracking and design-based planning, ensuring efficient production and accurate financial reporting.
