# Multi-Size Design Cost Management System

## Overview
This system handles designs with multiple sizes (2Y to 16Y) where each size has different material costs, labor costs, and manufacturing complexity.

## Key Features

### 1. **Size-Specific Cost Configuration**
Each design can have:
- **Individual size configurations**: Specific cost multipliers for each size
- **Size range configurations**: Cost multipliers for ranges (e.g., 2Y-6Y, 7Y-10Y, etc.)
- **Default multipliers**: Fallback multipliers when no specific configuration exists

### 2. **Automatic Cost Calculation**
The system automatically calculates:
- Material cost based on size multipliers
- Labor cost based on size complexity
- Overhead cost allocation
- Manufacturing time estimates
- Total cost per size and quantity

### 3. **Integration with Orders and Work Orders**
- Order items automatically use size-specific costs
- Work orders calculate accurate material requirements
- Multi-size orders are handled efficiently

## Usage Examples

### 1. **Creating a Design with Size Configurations**

```typescript
const design: Design = {
  id: "design-001",
  name: "Kids T-Shirt",
  category: "T-Shirts",
  
  // Base costs (for reference size, typically M/8Y)
  materialCost: 50,    // EGP per unit
  laborCost: 30,       // EGP per unit
  overheadCost: 20,    // EGP per unit
  totalCost: 100,      // Calculated
  
  // Size-specific configurations
  sizeRanges: [
    {
      start: "2Y",
      end: "6Y",
      materialCostMultiplier: 0.8,  // 20% less material
      laborCostMultiplier: 0.9,     // 10% less labor
      overheadCostMultiplier: 1.0,  // Same overhead
      manufacturingTimeMultiplier: 0.9, // 10% faster
      complexityAdjustment: "low"
    },
    {
      start: "7Y",
      end: "10Y",
      materialCostMultiplier: 1.0,  // Base size
      laborCostMultiplier: 1.0,      // Base labor
      overheadCostMultiplier: 1.0,   // Base overhead
      manufacturingTimeMultiplier: 1.0, // Base time
      complexityAdjustment: "medium"
    },
    {
      start: "11Y",
      end: "16Y",
      materialCostMultiplier: 1.3,  // 30% more material
      laborCostMultiplier: 1.2,      // 20% more labor
      overheadCostMultiplier: 1.1,   // 10% more overhead
      manufacturingTimeMultiplier: 1.2, // 20% more time
      complexityAdjustment: "high"
    }
  ],
  
  manufacturingTime: 2, // Base hours
  complexity: "medium",
  status: "active"
};
```

### 2. **Calculating Size-Specific Costs**

```typescript
import { SizeCostService } from "@/lib/services/size-cost-service";

// Calculate costs for a specific size
const costs = SizeCostService.calculateSizeSpecificCosts(design, "4Y", 5);

console.log(costs);
// Output:
// {
//   materialCost: 200,    // 50 * 0.8 * 5
//   laborCost: 135,        // 30 * 0.9 * 5
//   overheadCost: 100,     // 20 * 1.0 * 5
//   totalCost: 435,        // Total for 5 units of 4Y
//   manufacturingTime: 9,  // 2 * 0.9 * 5
//   complexity: "low"
// }
```

### 3. **Multi-Size Order Cost Calculation**

```typescript
// Calculate costs for an order with multiple sizes
const sizeQuantities = [
  { size: "4Y", quantity: 3 },
  { size: "8Y", quantity: 5 },
  { size: "12Y", quantity: 2 }
];

const multiSizeCosts = SizeCostService.calculateMultiSizeOrderCosts(design, sizeQuantities);

console.log(multiSizeCosts);
// Output:
// {
//   totalCost: 1200,
//   totalMaterialCost: 600,
//   totalLaborCost: 360,
//   totalOverheadCost: 240,
//   totalManufacturingTime: 24,
//   itemBreakdown: [
//     { size: "4Y", quantity: 3, materialCost: 120, laborCost: 81, overheadCost: 60, totalCost: 261, manufacturingTime: 5.4 },
//     { size: "8Y", quantity: 5, materialCost: 250, laborCost: 150, overheadCost: 100, totalCost: 500, manufacturingTime: 10 },
//     { size: "12Y", quantity: 2, materialCost: 130, laborCost: 72, overheadCost: 44, totalCost: 246, manufacturingTime: 4.8 }
//   ]
// }
```

### 4. **API Usage**

```typescript
// POST /api/designs/multi-size-costs
const response = await fetch('/api/designs/multi-size-costs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    designId: "design-001",
    sizeQuantities: [
      { size: "4Y", quantity: 3 },
      { size: "8Y", quantity: 5 },
      { size: "12Y", quantity: 2 }
    ]
  })
});

const result = await response.json();
console.log(result.data);
```

### 5. **Order Integration**

When creating orders, the system automatically:
1. Extracts size information from order items
2. Finds the corresponding design
3. Calculates size-specific costs
4. Updates work orders with accurate cost estimates

```typescript
// Order item with size information
const orderItem = {
  productId: "product-123",
  name: "Kids T-Shirt",
  size: "6Y",
  quantity: 2,
  basePrice: 150,
  adjustedPrice: 150
};

// The system automatically calculates:
// - Material cost: 50 * 0.8 * 2 = 80 EGP
// - Labor cost: 30 * 0.9 * 2 = 54 EGP  
// - Overhead cost: 20 * 1.0 * 2 = 40 EGP
// - Total cost: 174 EGP
```

## Size Range Guidelines

### **Small Sizes (2Y-6Y)**
- **Material**: 0.8x multiplier (less fabric needed)
- **Labor**: 0.9x multiplier (easier to work with)
- **Complexity**: Low
- **Time**: 0.9x multiplier (faster production)

### **Medium Sizes (7Y-10Y)**
- **Material**: 1.0x multiplier (base size)
- **Labor**: 1.0x multiplier (standard complexity)
- **Complexity**: Medium
- **Time**: 1.0x multiplier (standard time)

### **Large Sizes (11Y-16Y)**
- **Material**: 1.3x multiplier (more fabric needed)
- **Labor**: 1.2x multiplier (more complex)
- **Complexity**: High
- **Time**: 1.2x multiplier (longer production)

## Benefits

1. **Accurate Costing**: Each size has realistic cost calculations
2. **Better Planning**: Accurate material and time estimates
3. **Profitability Analysis**: Size-specific profit margins
4. **Inventory Management**: Precise material requirements
5. **Work Order Optimization**: Accurate production planning

## Migration from Existing System

Existing designs without size configurations will:
1. Use default size ranges (2Y-6Y, 7Y-10Y, 11Y-16Y)
2. Apply standard multipliers
3. Maintain backward compatibility
4. Allow gradual migration to custom configurations

This system ensures accurate cost management for multi-size designs while maintaining simplicity and flexibility.
