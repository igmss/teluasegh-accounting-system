// Design management types for accounting system
export interface Design {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  image?: string;
  images?: string[];
  
  // Cost configuration (in EGP)
  materialCost: number; // Material cost per unit in EGP
  laborCost: number; // Labor cost per unit in EGP
  overheadCost: number; // Overhead cost per unit in EGP
  totalCost: number; // Calculated total cost in EGP
  
  // Pricing (in EGP)
  suggestedRetailPrice: number;
  wholesalePrice: number;
  margin: number; // Profit margin percentage
  
  // Manufacturing details
  manufacturingTime: number; // Hours required
  complexity: 'low' | 'medium' | 'high';
  materials: Material[];
  processes: Process[];
  
  // Status and metadata
  status: 'active' | 'inactive' | 'discontinued';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Accounting integration
  inventoryAccount?: string;
  cogsAccount?: string;
  revenueAccount?: string;
  
  // Additional fields
  tags?: string[];
  notes?: string;
  variants?: DesignVariant[];
}

export interface Material {
  id: string;
  name: string;
  type: 'fabric' | 'hardware' | 'trim' | 'packaging' | 'other';
  unit: 'meter' | 'piece' | 'kg' | 'liter' | 'other';
  quantityPerUnit: number;
  costPerUnit: number; // Cost per unit in EGP
  supplier?: string;
  specifications?: string;
  
  // Inventory integration
  inventoryItemId?: string; // Reference to inventory item
  inventoryItemName?: string; // Cached name for display
  inventoryItemSku?: string; // Cached SKU for display
  availableQuantity?: number; // Current available quantity in inventory
}

export interface Process {
  id: string;
  name: string;
  type: 'cutting' | 'sewing' | 'finishing' | 'packaging' | 'other';
  timeRequired: number; // Hours
  costPerHour: number; // Cost per hour in EGP
  equipment?: string;
  skills?: string[];
}

export interface DesignVariant {
  id: string;
  name: string;
  color?: string;
  size?: string;
  material?: string;
  costAdjustment: number; // Additional cost for this variant in EGP
  priceAdjustment: number; // Additional price for this variant in EGP
}

export interface DesignFilter {
  category?: string;
  subcategory?: string;
  status?: 'active' | 'inactive' | 'discontinued';
  complexity?: 'low' | 'medium' | 'high';
  minCost?: number;
  maxCost?: number;
  minMargin?: number;
  maxMargin?: number;
}

export interface DesignStats {
  totalDesigns: number;
  activeDesigns: number;
  inactiveDesigns: number;
  discontinuedDesigns: number;
  averageCost: number;
  averageMargin: number;
  totalValue: number;
  categoryBreakdown: {
    [category: string]: number;
  };
}

// Material requirement for work orders
export interface MaterialRequirement {
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
