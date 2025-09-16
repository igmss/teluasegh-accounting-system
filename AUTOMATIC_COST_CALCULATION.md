# Automatic Cost Calculation System

## Overview

The work order system now automatically calculates costs from designs when orders are processed, eliminating the need for manual cost configuration. The system intelligently maps order items to designs and calculates accurate costs based on configured material, labor, and overhead costs.

## How It Works

### 1. **Order Processing Flow**
```
Order Status → "processing" → Work Order Creation → Automatic Cost Calculation
```

### 2. **Item-to-Design Mapping**
The system uses multiple methods to find the correct design for each order item:

#### **Method 1: Product ID Matching**
- Looks for designs with matching `productId` field
- Most accurate method when product IDs are consistent

#### **Method 2: Name Matching**
- Performs fuzzy matching on product names
- Handles variations in naming conventions
- Falls back to partial matching if exact match not found

#### **Method 3: Category Matching**
- Matches items by category
- Useful for generic products without specific designs

### 3. **Cost Calculation Process**
```
For Each Order Item:
1. Find Design → Calculate Costs:
   - Material Cost = design.materialCost × quantity
   - Labor Cost = design.laborCost × quantity
   - Overhead Cost = design.overheadCost × quantity
   - Total Cost = Material + Labor + Overhead

2. If No Design Found → Use Default Costs:
   - Default Cost = item.basePrice × 0.3 (30% of retail)
   - Material Cost = Default × 0.6
   - Labor Cost = Default × 0.3
   - Overhead Cost = Default × 0.1
```

## Technical Implementation

### **OrderItemDesignService**

#### **calculateOrderCostsFromDesigns()**
- Main method for calculating costs from designs
- Processes all order items and maps to designs
- Returns detailed cost breakdown

#### **createWorkOrderWithAutoCosts()**
- Creates work order with automatic cost calculation
- Handles fallback scenarios
- Stores item-level cost breakdown

#### **findDesignForItem()**
- Intelligent design matching for order items
- Uses multiple matching strategies
- Handles edge cases gracefully

### **Updated APIs**

#### **Sales Orders API**
- Automatically creates work orders with cost calculation
- Handles both manual and web orders
- Provides fallback for failed calculations

#### **Webhook API**
- Processes web orders with automatic cost calculation
- Fetches order items and calculates costs
- Creates work orders with accurate estimates

#### **Work Orders API**
- Supports automatic cost calculation
- Falls back to manual creation if needed
- Returns detailed cost information

## Cost Calculation Examples

### **Example 1: Design Found**
```
Order Item: "Navy Sweatshirt-dress" (qty: 2)
Design Found: "Navy Sweatshirt-dress" design
Design Costs:
- Material Cost: EGP 150 per unit
- Labor Cost: EGP 100 per unit  
- Overhead Cost: EGP 50 per unit

Calculation:
- Material: 150 × 2 = EGP 300
- Labor: 100 × 2 = EGP 200
- Overhead: 50 × 2 = EGP 100
- Total: EGP 600
```

### **Example 2: No Design Found**
```
Order Item: "Custom T-Shirt" (qty: 1, price: EGP 500)
No Design Found: Using default calculation
Default Cost: 500 × 0.3 = EGP 150

Calculation:
- Material: 150 × 0.6 = EGP 90
- Labor: 150 × 0.3 = EGP 45
- Overhead: 150 × 0.1 = EGP 15
- Total: EGP 150
```

## Work Order Structure

### **Enhanced Work Order Fields**
```typescript
interface WorkOrder {
  // Basic fields
  sales_order_id: string
  status: "pending" | "in_progress" | "completed"
  
  // Cost fields (auto-calculated)
  estimated_cost: number // Total estimated cost from designs
  total_cost: number // Actual cost (updated when materials issued)
  labor_cost: number // Calculated labor cost
  overhead_cost: number // Calculated overhead cost
  
  // Material tracking
  materials_issued: MaterialIssued[]
  
  // Item-level cost breakdown
  item_costs: Array<{
    item: any
    designId?: string
    designName?: string
    estimatedCost: number
    materialCost: number
    laborCost: number
    overheadCost: number
    quantity: number
  }>
  
  // Additional fields
  notes: string // Includes cost calculation info
  created_at: Date
  updated_at: Date
}
```

## Benefits

### 1. **Eliminates Manual Work**
- No more manual cost entry
- Automatic cost calculation from designs
- Consistent cost application

### 2. **Accurate Costing**
- Uses actual design configurations
- Real-time material costs from inventory
- Precise labor and overhead calculations

### 3. **Better Planning**
- Know exact costs before production
- Material requirement planning
- Profitability analysis

### 4. **Error Reduction**
- Eliminates human error in cost entry
- Consistent cost application
- Automatic fallback handling

## Fallback Mechanisms

### **1. Design Not Found**
- Uses default cost calculation (30% of retail price)
- Logs warning for manual review
- Still creates work order with estimated costs

### **2. Cost Calculation Failure**
- Creates basic work order without costs
- Logs error for debugging
- Allows manual cost entry later

### **3. Missing Order Data**
- Uses default values for missing fields
- Creates work order with available data
- Flags for manual review

## Usage Examples

### **1. Web Order Processing**
```typescript
// When order status changes to "processing"
POST /api/webhooks/order-status
{
  "orderId": "order-123",
  "status": "processing"
}

// System automatically:
// 1. Fetches order items
// 2. Maps items to designs
// 3. Calculates costs
// 4. Creates work order with costs
```

### **2. Manual Order Creation**
```typescript
// Create work order with automatic cost calculation
POST /api/work-orders
{
  "sales_order_id": "SO-123",
  "items": [
    {
      "name": "Navy Sweatshirt-dress",
      "productId": "prod-456",
      "quantity": 2,
      "basePrice": 300
    }
  ]
}

// Returns:
{
  "success": true,
  "workOrderId": "WO-123",
  "totalEstimatedCost": 600,
  "itemCosts": [...],
  "message": "Work order created with automatic cost calculation"
}
```

### **3. Get Work Order with Costs**
```typescript
// Get work order with cost breakdown
GET /api/work-orders/WO-123

// Returns detailed cost information including:
// - Estimated vs actual costs
// - Item-level cost breakdown
// - Design information
// - Material requirements
```

## Monitoring and Debugging

### **Log Messages**
- `✅ Created work order with auto-calculated cost EGP X`
- `❌ Failed to create work order: [error]`
- `⚠️ No design found for item: [item name]`
- `ℹ️ Using default cost calculation for item: [item name]`

### **Error Handling**
- All errors are logged with context
- Fallback mechanisms prevent system failure
- Detailed error messages for debugging

### **Cost Verification**
- Compare estimated vs actual costs
- Monitor cost calculation accuracy
- Track design mapping success rate

## Future Enhancements

### 1. **Machine Learning**
- Improve item-to-design matching accuracy
- Learn from manual corrections
- Predict costs for new items

### 2. **Advanced Matching**
- Image-based product matching
- Barcode/QR code integration
- Supplier catalog integration

### 3. **Cost Optimization**
- Identify cost reduction opportunities
- Suggest design improvements
- Optimize material usage

This automatic cost calculation system ensures accurate, consistent, and efficient work order creation without manual intervention, significantly improving the production planning and cost management process.
