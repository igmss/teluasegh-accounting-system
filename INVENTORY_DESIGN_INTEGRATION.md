# Inventory-Design Integration System

## Overview

This system integrates the design management with inventory management, allowing you to:

1. **Configure materials** for each design by selecting from inventory
2. **Specify quantities** of each material required
3. **Automatically deduct materials** from inventory when work orders are created
4. **Track material costs** and availability in real-time

## Key Features

### 1. Material Configuration in Designs
- Select materials from existing inventory items
- Specify quantities required per design unit
- Auto-calculate material costs based on inventory prices
- Real-time availability checking

### 2. Work Order Integration
- Automatic material deduction when work orders are created
- Journal entries for inventory movements
- Cost tracking through the production process
- Completion tracking with WIP → Finished Goods transfer

### 3. Real-time Inventory Updates
- Materials are deducted immediately when issued
- Inventory movements are tracked
- Availability warnings for insufficient materials
- Cost updates based on current inventory prices

## System Architecture

### Components

#### 1. **MaterialSelector Component**
- **Location**: `components/material-selector.tsx`
- **Purpose**: UI for selecting and configuring materials for designs
- **Features**:
  - Search and filter inventory items
  - Add/remove materials from design
  - Quantity configuration
  - Real-time cost calculation
  - Availability checking

#### 2. **Design Service Updates**
- **Location**: `lib/services/design-service.ts`
- **New Methods**:
  - `getMaterialRequirements(designId, quantity)` - Get material requirements for work orders
  - `checkMaterialAvailability(designId, quantity)` - Check if materials are available

#### 3. **Work Order Material Service**
- **Location**: `lib/services/work-order-material-service.ts`
- **Purpose**: Handle material deduction and work order completion
- **Methods**:
  - `issueMaterialsForWorkOrder()` - Deduct materials from inventory
  - `completeWorkOrder()` - Transfer from WIP to Finished Goods
  - `getWorkOrderMaterialRequirements()` - Get requirements for existing work orders

### API Endpoints

#### 1. **Inventory Items API**
- **Endpoint**: `GET /api/inventory/items`
- **Purpose**: Fetch inventory items for material selection
- **Parameters**:
  - `type`: Filter by type (raw, finished, wip)
  - `search`: Search by name, SKU, or description

#### 2. **Material Requirements API**
- **Endpoint**: `GET /api/designs/[id]/material-requirements`
- **Purpose**: Get material requirements for a design
- **Parameters**:
  - `quantity`: Number of units to produce

#### 3. **Issue Materials API**
- **Endpoint**: `POST /api/work-orders/[id]/issue-materials`
- **Purpose**: Issue materials for a work order
- **Body**: `{ designId, quantity }`

#### 4. **Complete Work Order API**
- **Endpoint**: `POST /api/work-orders/[id]/complete`
- **Purpose**: Complete a work order and transfer to finished goods
- **Body**: `{ designId, quantity }`

## Data Flow

### 1. Design Configuration
```
1. User opens design dialog
2. MaterialSelector component loads inventory items
3. User selects materials and specifies quantities
4. System calculates total material cost
5. Design is saved with material requirements
```

### 2. Work Order Creation
```
1. Work order is created for a design
2. System checks material availability
3. If available, materials are issued from inventory
4. Journal entries are created:
   - DR: Work in Progress (WIP)
   - CR: Raw Materials Inventory
5. Work order status updated to "in_progress"
```

### 3. Work Order Completion
```
1. Production is completed
2. Work order completion is triggered
3. Journal entries are created:
   - DR: Finished Goods Inventory
   - CR: Work in Progress (WIP)
4. Work order status updated to "completed"
```

## Database Schema Updates

### Design Materials
```typescript
interface Material {
  id: string;
  name: string;
  type: 'fabric' | 'hardware' | 'trim' | 'packaging' | 'other';
  unit: 'meter' | 'piece' | 'kg' | 'liter' | 'other';
  quantityPerUnit: number;
  costPerUnit: number; // Cost per unit in EGP
  
  // NEW: Inventory integration
  inventoryItemId?: string; // Reference to inventory item
  inventoryItemName?: string; // Cached name for display
  inventoryItemSku?: string; // Cached SKU for display
  availableQuantity?: number; // Current available quantity
}
```

### Material Requirements
```typescript
interface MaterialRequirement {
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string;
  requiredQuantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  availableQuantity: number;
  isAvailable: boolean;
}
```

## Usage Examples

### 1. Configure Materials for a Design

```typescript
// In the design dialog
<MaterialSelector
  materials={formData.materials || []}
  onMaterialsChange={(materials) => {
    setFormData({ ...formData, materials });
    // Auto-calculate material cost
    const totalMaterialCost = materials.reduce((total, material) => 
      total + (material.quantityPerUnit * material.costPerUnit), 0
    );
    setFormData(prev => ({ ...prev, materialCost: totalMaterialCost }));
  }}
/>
```

### 2. Issue Materials for Work Order

```typescript
// When creating a work order
const response = await fetch(`/api/work-orders/${workOrderId}/issue-materials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    designId: 'design-123',
    quantity: 5
  })
});

const result = await response.json();
if (result.success) {
  console.log(`Materials issued: EGP ${result.data.totalCost}`);
}
```

### 3. Complete Work Order

```typescript
// When production is complete
const response = await fetch(`/api/work-orders/${workOrderId}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    designId: 'design-123',
    quantity: 5
  })
});
```

## Benefits

### 1. **Accurate Cost Tracking**
- Real-time material costs from inventory
- Automatic cost calculation based on current prices
- Proper accounting through journal entries

### 2. **Inventory Management**
- Automatic deduction when materials are used
- Real-time availability checking
- Movement tracking for audit trails

### 3. **Production Planning**
- Know exactly what materials are needed
- Check availability before starting production
- Plan purchases based on production requirements

### 4. **Accounting Integration**
- Proper WIP accounting
- Finished goods valuation
- Cost of goods sold tracking

## Error Handling

### 1. **Insufficient Materials**
- System checks availability before issuing materials
- Clear error messages for unavailable materials
- Suggests alternative materials or quantities

### 2. **Inventory Updates**
- Batch operations ensure data consistency
- Rollback on errors
- Detailed error logging

### 3. **Work Order Status**
- Prevents duplicate material issuance
- Ensures proper status transitions
- Validates work order completion

## Future Enhancements

### 1. **BOM (Bill of Materials) Management**
- Hierarchical material structures
- Sub-assembly tracking
- Multi-level cost rollup

### 2. **Supplier Integration**
- Automatic reorder points
- Supplier price comparison
- Purchase order generation

### 3. **Production Scheduling**
- Material availability in scheduling
- Lead time calculations
- Resource planning

### 4. **Quality Control**
- Material quality tracking
- Batch/lot number management
- Traceability features

## Testing

### 1. **Unit Tests**
- Material calculation accuracy
- Inventory deduction logic
- Journal entry creation

### 2. **Integration Tests**
- End-to-end work order flow
- Database consistency
- API endpoint functionality

### 3. **User Acceptance Tests**
- Material selection workflow
- Work order creation process
- Error handling scenarios

This integration provides a complete solution for managing materials in the design and production process, ensuring accurate cost tracking and proper inventory management.
