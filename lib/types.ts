export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  created_at: Date
}

export interface ChartOfAccount {
  id: string
  name: string
  type: "asset" | "liability" | "equity" | "revenue" | "expense"
  parent_id?: string
}

export interface JournalEntry {
  id: string
  date: Date
  entries: {
    account_id: string
    debit: number
    credit: number
    description: string
  }[]
  linked_doc?: string
  created_at: Date
}

export interface SalesOrder {
  id: string
  website_order_id: string
  customer_id: string
  items: {
    sku: string
    qty: number
    unit_price: number
    bom_id?: string
  }[]
  status: "pending" | "producing" | "completed" | "invoiced"
  created_at: Date
}

export interface WorkOrder {
  id: string
  sales_order_id: string
  design_id?: string // Reference to design configuration
  design_name?: string // Cached design name for display
  bom_id?: string
  raw_materials_used: {
    item_id: string
    qty: number
    cost: number
  }[]
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
  created_at: Date
  completed_at?: Date
  updated_at?: Date
  completionPercentage?: number
  assigned_worker?: string
  start_time?: Date
  estimated_completion?: Date
  notes?: string
  items?: any[] // Order items
  customer_name?: string
  customer_email?: string
  total_amount?: number
  order_source?: string
}

export interface InventoryItem {
  id: string // SKU
  name: string
  type: "raw" | "finished"
  quantity_on_hand: number
  cost_per_unit: number
  created_at: Date
}

export interface InventoryMovement {
  id: string
  item_id: string
  qty: number
  type: "issue" | "receipt" | "return" | "adjustment"
  related_doc?: string
  created_at: Date
}

export interface Invoice {
  id: string
  sales_order_id: string
  customer_id: string
  amount: number
  due_date: Date
  status: "unpaid" | "paid" | "partial"
  created_at: Date
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  method: string
  date: Date
  created_at: Date
}

// Source data types (from existing website)
export interface WebsiteOrder {
  id: string
  customer_email: string
  items: any[]
  total: number
  processed?: boolean
  processed_at?: Date
  created_at: Date
}

export interface WebsiteReturn {
  id: string
  order_id: string
  items: any[]
  reason: string
  processed?: boolean
  processed_at?: Date
  created_at: Date
}
