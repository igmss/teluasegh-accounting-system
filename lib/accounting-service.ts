import { db, COLLECTIONS } from "./firebase"
import type { Customer, SalesOrder, WorkOrder, Invoice, Payment, JournalEntry, WebsiteOrder } from "./types"

export class AccountingService {
  // Initialize chart of accounts
  static async initializeChartOfAccounts() {
    const accounts = [
      { id: "CASH", name: "Cash", type: "asset" as const, balance: 315000 },
      { id: "AR", name: "Accounts Receivable", type: "asset" as const },
      { id: "INVENTORY_RAW", name: "Raw Materials Inventory", type: "asset" as const },
      { id: "INVENTORY_WIP", name: "Work in Progress", type: "asset" as const },
      { id: "INVENTORY_FG", name: "Finished Goods Inventory", type: "asset" as const },
      { id: "REVENUE", name: "Sales Revenue", type: "revenue" as const },
      { id: "COGS", name: "Cost of Goods Sold", type: "expense" as const },
      { id: "RETURNS", name: "Returns and Allowances", type: "expense" as const },
      { id: "VAT_PAYABLE", name: "VAT Payable", type: "liability" as const },
    ]

    const batch = db.batch()
    accounts.forEach((account) => {
      const ref = db.collection(COLLECTIONS.CHART_OF_ACCOUNTS).doc(account.id)
      batch.set(ref, account)
    })

    await batch.commit()
  }

  // Process website orders
  static async processWebsiteOrders() {
    const processed: string[] = []
    const errors: string[] = []

    try {
      const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS).where("processed", "!=", true).limit(50).get()

      for (const orderDoc of ordersSnapshot.docs) {
        try {
          const order = orderDoc.data() as any
          await AccountingService.createSalesOrderFromWebsiteOrder(order)

          // Mark as processed
          await orderDoc.ref.update({
            processed: true,
            processed_at: new Date(),
          })

          processed.push(order.id)
        } catch (error) {
          console.error(`Error processing order ${orderDoc.id}:`, error)
          errors.push(`Order ${orderDoc.id}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      errors.push(`Fetch error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    return { processed, errors }
  }

  // Process website returns (for cron job)
  static async processWebsiteReturns() {
    const processed: string[] = []
    const errors: string[] = []

    try {
      const returnsSnapshot = await db.collection(COLLECTIONS.RETURNS).where("processed", "!=", true).limit(50).get()

      for (const returnDoc of returnsSnapshot.docs) {
        try {
          const returnData = returnDoc.data() as any
          await AccountingService.processReturn(returnData)

          // Mark as processed
          await returnDoc.ref.update({
            processed: true,
            processed_at: new Date(),
          })

          processed.push(returnData.id)
        } catch (error) {
          console.error(`Error processing return ${returnDoc.id}:`, error)
          errors.push(`Return ${returnDoc.id}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    } catch (error) {
      console.error("Error fetching returns:", error)
      errors.push(`Fetch error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    return { processed, errors }
  }

  // Process individual return
  private static async processReturn(returnData: any) {
    const creditMemoId = `CM-${Date.now()}`
    const returnAmount = returnData.amount || 0

    // Create credit memo journal entry
    await AccountingService.postJournalEntry({
      date: new Date(),
      entries: [
        { account_id: "RETURNS", debit: returnAmount, credit: 0, description: `Return ${returnData.id}` },
        { account_id: "AR", debit: 0, credit: returnAmount, description: `Credit memo ${creditMemoId}` },
      ],
      linked_doc: creditMemoId,
    })

    // Update inventory if items are returned to stock
    if (returnData.items && returnData.items.length > 0) {
      for (const item of returnData.items) {
        await AccountingService.adjustInventory(item.sku, item.quantity, "return")
      }
    }
  }

  // Update inventory valuations (for cron job)
  static async updateInventoryValuations() {
    const updated: string[] = []
    const lowStockAlerts: string[] = []

    try {
      const inventorySnapshot = await db.collection(COLLECTIONS.INVENTORY).get()

      for (const itemDoc of inventorySnapshot.docs) {
        const item = itemDoc.data() as any

        // Check for low stock
        if (item.qty_on_hand <= (item.reorder_point || 10)) {
          lowStockAlerts.push(`${item.sku}: ${item.qty_on_hand} units remaining`)
        }

        // Update valuation based on FIFO method
        const updatedValue = item.qty_on_hand * (item.unit_cost || 0)

        await itemDoc.ref.update({
          total_value: updatedValue,
          last_updated: new Date(),
        })

        updated.push(item.sku)
      }
    } catch (error) {
      console.error("Error updating inventory:", error)
    }

    return { updated, lowStockAlerts }
  }

  // Adjust inventory levels
  private static async adjustInventory(
    sku: string,
    quantity: number,
    type: "issue" | "receipt" | "return" | "adjustment",
  ) {
    const inventoryRef = db.collection(COLLECTIONS.INVENTORY).doc(sku)
    const inventoryDoc = await inventoryRef.get()

    if (inventoryDoc.exists) {
      const currentQty = inventoryDoc.data()?.qty_on_hand || 0
      const newQty = type === "issue" ? currentQty - quantity : currentQty + quantity

      await inventoryRef.update({
        qty_on_hand: Math.max(0, newQty),
        last_movement: new Date(),
      })

      // Record inventory movement
      const movementId = `MOV-${Date.now()}`
      await db
        .collection(COLLECTIONS.INVENTORY_MOVEMENTS)
        .doc(movementId)
        .set({
          id: movementId,
          sku,
          type,
          quantity,
          previous_qty: currentQty,
          new_qty: Math.max(0, newQty),
          date: new Date(),
          created_at: new Date(),
        })
    }
  }

  // Create sales order from website order
  static async createSalesOrderFromWebsiteOrder(websiteOrder: WebsiteOrder) {
    const salesOrderId = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

    // Find or create customer
    const customerId = await AccountingService.findOrCreateCustomer(websiteOrder.customer_email)

    const salesOrder: SalesOrder = {
      id: salesOrderId,
      website_order_id: websiteOrder.id,
      customer_id: customerId,
      items: websiteOrder.items.map((item) => ({
        sku: item.sku || item.id,
        qty: item.quantity || 1,
        unit_price: item.price || 0,
      })),
      status: "pending",
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.SALES_ORDERS).doc(salesOrderId).set(salesOrder)

    // Create work order
    await AccountingService.createWorkOrder(salesOrderId)
  }

  // Find or create customer
  static async findOrCreateCustomer(email: string): Promise<string> {
    const customerSnapshot = await db.collection(COLLECTIONS.CUSTOMERS).where("email", "==", email).limit(1).get()

    if (!customerSnapshot.empty) {
      return customerSnapshot.docs[0].id
    }

    // Create new customer
    const customerId = `CUST-${Date.now()}`
    const customer: Customer = {
      id: customerId,
      name: email.split("@")[0], // Use email prefix as name
      email,
      phone: "",
      address: "",
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.CUSTOMERS).doc(customerId).set(customer)
    return customerId
  }

  // Create work order
  static async createWorkOrder(salesOrderId: string) {
    const workOrderId = `WO-${salesOrderId.split("-").slice(-1)[0]}`

    const workOrder: WorkOrder = {
      id: workOrderId,
      sales_order_id: salesOrderId,
      raw_materials_used: [],
      labor_hours: 0,
      overhead_cost: 0,
      status: "pending",
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).set(workOrder)
  }

  // Post journal entry
  static async postJournalEntry(entry: Omit<JournalEntry, "id" | "created_at">) {
    const entryId = `JE-${Date.now()}`
    const journalEntry: JournalEntry = {
      ...entry,
      id: entryId,
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.JOURNAL_ENTRIES).doc(entryId).set(journalEntry)
  }

  // Complete work order and move to finished goods
  static async completeWorkOrder(workOrderId: string) {
    const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId)
    const workOrder = (await workOrderRef.get()).data() as WorkOrder

    // Update work order status
    await workOrderRef.update({
      status: "completed",
      completed_at: new Date(),
    })

    // Move WIP to Finished Goods
    const totalCost =
      workOrder.raw_materials_used.reduce((sum, material) => sum + material.qty * material.cost, 0) +
      workOrder.overhead_cost

    await AccountingService.postJournalEntry({
      date: new Date(),
      entries: [
        { account_id: "INVENTORY_FG", debit: totalCost, credit: 0, description: "Transfer from WIP to Finished Goods" },
        {
          account_id: "INVENTORY_WIP",
          debit: 0,
          credit: totalCost,
          description: "Transfer from WIP to Finished Goods",
        },
      ],
      linked_doc: workOrderId,
    })

    // Update sales order status
    await db.collection(COLLECTIONS.SALES_ORDERS).doc(workOrder.sales_order_id).update({
      status: "completed",
    })

    // Generate invoice
    await AccountingService.generateInvoice(workOrder.sales_order_id)
  }

  // Generate invoice
  static async generateInvoice(salesOrderId: string) {
    const salesOrderDoc = await db.collection(COLLECTIONS.SALES_ORDERS).doc(salesOrderId).get()
    const salesOrder = salesOrderDoc.data() as SalesOrder

    const invoiceId = `INV-${salesOrderId.split("-").slice(-1)[0]}`
    const totalAmount = salesOrder.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)

    const invoice: Invoice = {
      id: invoiceId,
      sales_order_id: salesOrderId,
      customer_id: salesOrder.customer_id,
      amount: totalAmount,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: "unpaid",
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).set(invoice)

    // Post journal entry for invoice
    await AccountingService.postJournalEntry({
      date: new Date(),
      entries: [
        { account_id: "AR", debit: totalAmount, credit: 0, description: `Invoice ${invoiceId}` },
        { account_id: "REVENUE", debit: 0, credit: totalAmount, description: `Sales revenue ${invoiceId}` },
      ],
      linked_doc: invoiceId,
    })

    // Update sales order status
    await salesOrderDoc.ref.update({ status: "invoiced" })
  }

  // Record payment
  static async recordPayment(invoiceId: string, amount: number, method: string) {
    const paymentId = `PAY-${Date.now()}`

    const payment: Payment = {
      id: paymentId,
      invoice_id: invoiceId,
      amount,
      method,
      date: new Date(),
      created_at: new Date(),
    }

    await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).set(payment)

    // Post journal entry
    await AccountingService.postJournalEntry({
      date: new Date(),
      entries: [
        { account_id: "CASH", debit: amount, credit: 0, description: `Payment received ${paymentId}` },
        { account_id: "AR", debit: 0, credit: amount, description: `Payment received ${paymentId}` },
      ],
      linked_doc: paymentId,
    })

    // Update invoice status
    const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(invoiceId)
    const invoice = (await invoiceRef.get()).data() as Invoice

    const totalPayments = amount // In real app, sum all payments for this invoice
    if (totalPayments >= invoice.amount) {
      await invoiceRef.update({ status: "paid" })
    } else {
      await invoiceRef.update({ status: "partial" })
    }
  }

  // Dashboard data methods
  async getKPIData() {
    try {
      const [invoicesSnapshot, journalEntriesSnapshot, workOrdersSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.INVOICES).where("status", "==", "paid").get(),
        db.collection(COLLECTIONS.JOURNAL_ENTRIES).get(),
        db.collection(COLLECTIONS.WORK_ORDERS).where("status", "==", "in_progress").get(),
      ])

      const totalRevenue = invoicesSnapshot.docs.reduce((sum, doc) => {
        const invoice = doc.data() as Invoice
        return sum + (invoice.amount || 0)
      }, 0)

      const totalCogs = journalEntriesSnapshot.docs.reduce((sum, doc) => {
        const entry = doc.data() as JournalEntry
        if (!entry || !entry.entries || !Array.isArray(entry.entries)) {
          return sum
        }
        return sum + entry.entries.reduce((entrySum, acc) => {
          if (!acc || !acc.account_id) {
            return entrySum
          }
          // Check if account_id is COGS (Cost of Goods Sold)
          return acc.account_id === "COGS" ? entrySum + (acc.debit || 0) : entrySum
        }, 0)
      }, 0)

      const wipValue = workOrdersSnapshot.docs.reduce((sum, doc) => {
        const workOrder = doc.data() as WorkOrder
        const materialCost = workOrder.raw_materials_used?.reduce((matSum, mat) => matSum + (mat.qty * mat.cost), 0) || 0
        const laborCost = workOrder.labor_cost || 0
        return sum + materialCost + laborCost
      }, 0)

      return {
        revenue: totalRevenue,
        cogs: totalCogs,
        profit: totalRevenue - totalCogs,
        wipValue,
      }
    } catch (error) {
      console.error("Error getting KPI data:", error)
      return {
        revenue: 0,
        cogs: 0,
        profit: 0,
        wipValue: 0,
      }
    }
  }

  async getMonthlyRevenue() {
    try {
      const invoicesSnapshot = await db.collection(COLLECTIONS.INVOICES).where("status", "==", "paid").get()
      const monthlyData = []
      const now = new Date()

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthName = date.toLocaleDateString("en", { month: "short" })

        const monthRevenue = invoicesSnapshot.docs.reduce((sum, doc) => {
          const invoice = doc.data() as Invoice
          const invDate = new Date(invoice.createdAt)
          if (
            invDate.getMonth() === date.getMonth() &&
            invDate.getFullYear() === date.getFullYear()
          ) {
            return sum + invoice.total
          }
          return sum
        }, 0)

        monthlyData.push({
          month: monthName,
          revenue: monthRevenue,
          cogs: monthRevenue * 0.6, // Simplified COGS calculation
        })
      }

      return monthlyData
    } catch (error) {
      console.error("Error getting monthly revenue:", error)
      return []
    }
  }

  async getTopCustomers() {
    try {
      const invoicesSnapshot = await db.collection(COLLECTIONS.INVOICES).where("status", "==", "paid").get()
      const customerTotals = new Map<string, number>()

      invoicesSnapshot.docs.forEach(doc => {
        const invoice = doc.data() as Invoice
        const current = customerTotals.get(invoice.customerName) || 0
        customerTotals.set(invoice.customerName, current + invoice.total)
      })

      return Array.from(customerTotals.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
    } catch (error) {
      console.error("Error getting top customers:", error)
      return []
    }
  }

  async getRecentOrders() {
    try {
      const salesOrdersSnapshot = await db.collection(COLLECTIONS.SALES_ORDERS)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get()

      return salesOrdersSnapshot.docs.map(doc => {
        const order = doc.data() as SalesOrder
        return {
          id: order.id,
          customerName: order.customerName,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        }
      })
    } catch (error) {
      console.error("Error getting recent orders:", error)
      return []
    }
  }

  async getInventoryAlerts() {
    try {
      const inventorySnapshot = await db.collection(COLLECTIONS.INVENTORY_ITEMS).get()
      const alerts = []

      inventorySnapshot.docs.forEach(doc => {
        const item = doc.data() as any
        if (item.qty_on_hand <= (item.reorder_point || 10)) {
          alerts.push({
            sku: item.sku,
            name: item.name,
            currentStock: item.qty_on_hand,
            reorderPoint: item.reorder_point || 10,
          })
        }
      })

      return alerts
    } catch (error) {
      console.error("Error getting inventory alerts:", error)
      return []
    }
  }

  async getWorkOrderStatus() {
    try {
      const workOrdersSnapshot = await db.collection(COLLECTIONS.WORK_ORDERS).get()
      const statusCounts = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        invoiced: 0,
      }
      const active = []

      workOrdersSnapshot.docs.forEach(doc => {
        const workOrder = doc.data() as WorkOrder
        statusCounts[workOrder.status as keyof typeof statusCounts]++
        
        if (workOrder.status !== "completed") {
          active.push({
            id: workOrder.id,
            salesOrderId: workOrder.salesOrderId,
            status: workOrder.status,
          })
        }
      })

      return {
        ...statusCounts,
        active: active.slice(0, 10),
      }
    } catch (error) {
      console.error("Error getting work order status:", error)
      return {
        pending: 0,
        in_progress: 0,
        completed: 0,
        invoiced: 0,
        active: [],
      }
    }
  }
}
