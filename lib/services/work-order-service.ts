import { db, COLLECTIONS } from "../firebase";
import { DesignService } from "./design-service";
import type { WorkOrder } from "../types";

export class WorkOrderService {
  /**
   * Create a work order with design-based cost calculation
   */
  static async createWorkOrderWithDesign(
    salesOrderId: string,
    designId: string,
    quantity: number = 1,
    additionalData: Partial<WorkOrder> = {}
  ): Promise<{
    success: boolean;
    workOrderId?: string;
    estimatedCost?: number;
    error?: string;
  }> {
    try {
      console.log(`Creating work order for sales order ${salesOrderId}, design ${designId}, quantity ${quantity}`);

      // Get design configuration
      const design = await DesignService.getDesign(designId);
      if (!design) {
        throw new Error(`Design ${designId} not found`);
      }

      // Calculate estimated costs based on design
      const estimatedMaterialCost = design.materialCost * quantity;
      const estimatedLaborCost = design.laborCost * quantity;
      const estimatedOverheadCost = design.overheadCost * quantity;
      const estimatedTotalCost = estimatedMaterialCost + estimatedLaborCost + estimatedOverheadCost;

      // Check material availability
      const materialAvailability = await DesignService.checkMaterialAvailability(designId, quantity);
      
      if (!materialAvailability.isAvailable) {
        console.warn(`Materials not available for design ${designId}:`, materialAvailability.unavailableMaterials);
      }

      // Create work order with design integration
      const workOrder: WorkOrder = {
        id: `WO-${salesOrderId.split("-").slice(-1)[0]}-${Date.now()}`,
        sales_order_id: salesOrderId,
        design_id: designId,
        design_name: design.name,
        raw_materials_used: [],
        materials_issued: [],
        labor_hours: design.manufacturingTime * quantity,
        labor_cost: estimatedLaborCost,
        overhead_cost: estimatedOverheadCost,
        total_cost: 0, // Will be updated when materials are issued
        estimated_cost: estimatedTotalCost,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
        completionPercentage: 0,
        notes: `Work order for design: ${design.name} (${quantity} units)`,
        ...additionalData
      };

      // Save work order to database
      const workOrderRef = await db.collection(COLLECTIONS.WORK_ORDERS).add(workOrder);

      console.log(`✅ Created work order ${workOrderRef.id} with estimated cost EGP ${estimatedTotalCost}`);

      return {
        success: true,
        workOrderId: workOrderRef.id,
        estimatedCost: estimatedTotalCost
      };

    } catch (error) {
      console.error("Error creating work order with design:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update work order with actual costs when materials are issued
   */
  static async updateWorkOrderCosts(
    workOrderId: string,
    materialCosts: number,
    laborHours: number,
    laborRate: number = 50 // Default labor rate per hour in EGP
  ): Promise<void> {
    try {
      const laborCost = laborHours * laborRate;
      const totalCost = materialCosts + laborCost;

      await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).update({
        labor_hours: laborHours,
        labor_cost: laborCost,
        total_cost: totalCost,
        updated_at: new Date()
      });

      console.log(`Updated work order ${workOrderId} costs: Materials EGP ${materialCosts}, Labor EGP ${laborCost}, Total EGP ${totalCost}`);
    } catch (error) {
      console.error("Error updating work order costs:", error);
      throw new Error("Failed to update work order costs");
    }
  }

  /**
   * Get work order with design, customer, and sales order information
   */
  static async getWorkOrderWithDesign(workOrderId: string): Promise<{
    workOrder: WorkOrder | null;
    design: any | null;
    materialRequirements: any[];
  }> {
    try {
      // Get work order
      const workOrderDoc = await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).get();
      if (!workOrderDoc.exists) {
        return { workOrder: null, design: null, materialRequirements: [] };
      }

      const workOrder = { 
        id: workOrderDoc.id, 
        ...workOrderDoc.data(),
        created_at: workOrderDoc.data()?.created_at?.toDate ? workOrderDoc.data().created_at.toDate() : (workOrderDoc.data()?.created_at || new Date()),
        updated_at: workOrderDoc.data()?.updated_at?.toDate ? workOrderDoc.data().updated_at.toDate() : (workOrderDoc.data()?.updated_at || new Date()),
        completed_at: workOrderDoc.data()?.completed_at?.toDate ? workOrderDoc.data().completed_at.toDate() : (workOrderDoc.data()?.completed_at || null),
        start_time: workOrderDoc.data()?.start_time?.toDate ? workOrderDoc.data().start_time.toDate() : (workOrderDoc.data()?.start_time || null),
        estimated_completion: workOrderDoc.data()?.estimated_completion?.toDate ? workOrderDoc.data().estimated_completion.toDate() : (workOrderDoc.data()?.estimated_completion || null)
      } as WorkOrder;

      // Fetch sales order details from multiple possible sources
      if (workOrder.sales_order_id) {
        try {
          let salesOrderData = null;
          let customerData = null;
          
          // Try to get from acc_sales_orders first (accounting system)
          const accSalesOrderDoc = await db.collection(COLLECTIONS.SALES_ORDERS).doc(workOrder.sales_order_id).get();
          if (accSalesOrderDoc.exists) {
            salesOrderData = accSalesOrderDoc.data();
            
            // Use customer data directly from sales order if available
            if (salesOrderData?.customer_name) {
              customerData = {
                name: salesOrderData.customer_name,
                email: salesOrderData.customer_email || "",
                phone: salesOrderData.customer_phone || "",
                address: salesOrderData.customer_address || ""
              };
            } else if (salesOrderData?.customer_id) {
              // Fallback: try to fetch from customers collection
              const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(salesOrderData.customer_id).get();
              if (customerDoc.exists) {
                customerData = customerDoc.data();
              }
            }
          }
          
          // If not found in accounting system, try original orders collection
          if (!salesOrderData) {
            const orderDoc = await db.collection("orders").doc(workOrder.sales_order_id).get();
            if (orderDoc.exists) {
              salesOrderData = orderDoc.data();
              // Extract customer data from order
              customerData = {
                name: salesOrderData?.shippingAddress?.fullName || "Unknown Customer",
                email: salesOrderData?.userId || "",
                phone: salesOrderData?.shippingAddress?.phone || "",
                address: `${salesOrderData?.shippingAddress?.street || ""} ${salesOrderData?.shippingAddress?.city || ""}`.trim()
              };
            }
          }
          
          // If still not found, try manual_orders collection
          if (!salesOrderData) {
            const manualOrderDoc = await db.collection("manual_orders").doc(workOrder.sales_order_id).get();
            if (manualOrderDoc.exists) {
              salesOrderData = manualOrderDoc.data();
              // Extract customer data from manual order
              customerData = {
                name: salesOrderData?.shippingAddress?.fullName || "Unknown Customer",
                email: salesOrderData?.userId || "",
                phone: salesOrderData?.shippingAddress?.phone || "",
                address: `${salesOrderData?.shippingAddress?.street || ""} ${salesOrderData?.shippingAddress?.city || ""}`.trim()
              };
            }
          }
          
          // Set customer data if found
          if (customerData) {
            workOrder.customer_name = customerData.name || "Unknown Customer";
            workOrder.customer_email = customerData.email || "";
            workOrder.customer_phone = customerData.phone || "";
            workOrder.customer_address = customerData.address || "";
          } else {
            workOrder.customer_name = "Unknown Customer";
            workOrder.customer_email = "";
            workOrder.customer_phone = "";
            workOrder.customer_address = "";
          }

          // Add sales order items and total amount (preserve original work order items if they exist)
          if (salesOrderData) {
            // Only set items if work order doesn't already have complete item data
            if (!workOrder.items || workOrder.items.length === 0 || !workOrder.items[0]?.name) {
              workOrder.items = salesOrderData.items || [];
            }
            workOrder.total_amount = salesOrderData.total || salesOrderData.total_amount || 0;
            workOrder.order_status = salesOrderData.status || "unknown";
          } else {
            workOrder.items = [];
            workOrder.total_amount = 0;
            workOrder.order_status = "unknown";
          }
        } catch (error) {
          console.warn(`Failed to fetch sales order ${workOrder.sales_order_id}:`, error);
          workOrder.customer_name = "Unknown Customer";
          workOrder.customer_email = "";
          workOrder.customer_phone = "";
          workOrder.customer_address = "";
          workOrder.items = [];
          workOrder.total_amount = 0;
          workOrder.order_status = "unknown";
        }
      } else {
        workOrder.customer_name = "Unknown Customer";
        workOrder.customer_email = "";
        workOrder.customer_phone = "";
        workOrder.customer_address = "";
        workOrder.items = [];
        workOrder.total_amount = 0;
        workOrder.order_status = "unknown";
      }

      // Get design information if available
      let design = null;
      let materialRequirements = [];
      
      if (workOrder.design_id) {
        design = await DesignService.getDesign(workOrder.design_id);
        if (design) {
          const quantity = 1; // Default quantity, could be calculated from work order
          materialRequirements = await DesignService.getMaterialRequirements(workOrder.design_id, quantity);
        }
      }

      return { workOrder, design, materialRequirements };
    } catch (error) {
      console.error("Error getting work order with design:", error);
      throw new Error("Failed to get work order with design");
    }
  }

  /**
   * Get all work orders with design, customer, and sales order information
   */
  static async getAllWorkOrdersWithDesigns(): Promise<WorkOrder[]> {
    try {
      const snapshot = await db.collection(COLLECTIONS.WORK_ORDERS)
        .orderBy("created_at", "desc")
        .get();

      const workOrders = await Promise.all(snapshot.docs.map(async (doc) => {
        const workOrderData = {
          id: doc.id,
          ...doc.data(),
          created_at: doc.data().created_at?.toDate ? doc.data().created_at.toDate() : (doc.data().created_at || new Date()),
          updated_at: doc.data().updated_at?.toDate ? doc.data().updated_at.toDate() : (doc.data().updated_at || new Date()),
          completed_at: doc.data().completed_at?.toDate ? doc.data().completed_at.toDate() : (doc.data().completed_at || null),
          start_time: doc.data().start_time?.toDate ? doc.data().start_time.toDate() : (doc.data().start_time || null),
          estimated_completion: doc.data().estimated_completion?.toDate ? doc.data().estimated_completion.toDate() : (doc.data().estimated_completion || null)
        } as WorkOrder;

        // Fetch sales order details from multiple possible sources
        if (workOrderData.sales_order_id) {
          try {
            let salesOrderData = null;
            let customerData = null;
            
            // Try to get from acc_sales_orders first (accounting system)
            const accSalesOrderDoc = await db.collection(COLLECTIONS.SALES_ORDERS).doc(workOrderData.sales_order_id).get();
            if (accSalesOrderDoc.exists) {
              salesOrderData = accSalesOrderDoc.data();
              
              // Use customer data directly from sales order if available
              if (salesOrderData?.customer_name) {
                customerData = {
                  name: salesOrderData.customer_name,
                  email: salesOrderData.customer_email || "",
                  phone: salesOrderData.customer_phone || "",
                  address: salesOrderData.customer_address || ""
                };
              } else if (salesOrderData?.customer_id) {
                // Fallback: try to fetch from customers collection
                const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(salesOrderData.customer_id).get();
                if (customerDoc.exists) {
                  customerData = customerDoc.data();
                }
              }
            }
            
            // If not found in accounting system, try original orders collection
            if (!salesOrderData) {
              const orderDoc = await db.collection("orders").doc(workOrderData.sales_order_id).get();
              if (orderDoc.exists) {
                salesOrderData = orderDoc.data();
                // Extract customer data from order
                customerData = {
                  name: salesOrderData?.shippingAddress?.fullName || "Unknown Customer",
                  email: salesOrderData?.userId || "",
                  phone: salesOrderData?.shippingAddress?.phone || "",
                  address: `${salesOrderData?.shippingAddress?.street || ""} ${salesOrderData?.shippingAddress?.city || ""}`.trim()
                };
              }
            }
            
            // If still not found, try manual_orders collection
            if (!salesOrderData) {
              const manualOrderDoc = await db.collection("manual_orders").doc(workOrderData.sales_order_id).get();
              if (manualOrderDoc.exists) {
                salesOrderData = manualOrderDoc.data();
                // Extract customer data from manual order
                customerData = {
                  name: salesOrderData?.shippingAddress?.fullName || "Unknown Customer",
                  email: salesOrderData?.userId || "",
                  phone: salesOrderData?.shippingAddress?.phone || "",
                  address: `${salesOrderData?.shippingAddress?.street || ""} ${salesOrderData?.shippingAddress?.city || ""}`.trim()
                };
              }
            }
            
            // Set customer data if found
            if (customerData) {
              workOrderData.customer_name = customerData.name || "Unknown Customer";
              workOrderData.customer_email = customerData.email || "";
              workOrderData.customer_phone = customerData.phone || "";
              workOrderData.customer_address = customerData.address || "";
            } else {
              workOrderData.customer_name = "Unknown Customer";
              workOrderData.customer_email = "";
              workOrderData.customer_phone = "";
              workOrderData.customer_address = "";
            }

            // Add sales order items and total amount (preserve original work order items if they exist)
            if (salesOrderData) {
              // Only set items if work order doesn't already have complete item data
              if (!workOrderData.items || workOrderData.items.length === 0 || !workOrderData.items[0]?.name) {
                workOrderData.items = salesOrderData.items || [];
              }
              workOrderData.total_amount = salesOrderData.total || salesOrderData.total_amount || 0;
              workOrderData.order_status = salesOrderData.status || "unknown";
            } else {
              workOrderData.items = [];
              workOrderData.total_amount = 0;
              workOrderData.order_status = "unknown";
            }
          } catch (error) {
            console.warn(`Failed to fetch sales order ${workOrderData.sales_order_id}:`, error);
            workOrderData.customer_name = "Unknown Customer";
            workOrderData.customer_email = "";
            workOrderData.customer_phone = "";
            workOrderData.customer_address = "";
            workOrderData.items = [];
            workOrderData.total_amount = 0;
            workOrderData.order_status = "unknown";
          }
        } else {
          workOrderData.customer_name = "Unknown Customer";
          workOrderData.customer_email = "";
          workOrderData.customer_phone = "";
          workOrderData.customer_address = "";
          workOrderData.items = [];
          workOrderData.total_amount = 0;
          workOrderData.order_status = "unknown";
        }

        return workOrderData;
      }));

      return workOrders;
    } catch (error) {
      console.error("Error getting work orders with designs:", error);
      throw new Error("Failed to get work orders with designs");
    }
  }

  /**
   * Calculate work order profitability
   */
  static async calculateWorkOrderProfitability(workOrderId: string): Promise<{
    revenue: number;
    totalCost: number;
    profit: number;
    profitMargin: number;
  }> {
    try {
      const { workOrder } = await this.getWorkOrderWithDesign(workOrderId);
      if (!workOrder) {
        throw new Error("Work order not found");
      }

      const revenue = workOrder.total_amount || 0;
      const totalCost = workOrder.total_cost || workOrder.estimated_cost || 0;
      const profit = revenue - totalCost;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        revenue,
        totalCost,
        profit,
        profitMargin
      };
    } catch (error) {
      console.error("Error calculating work order profitability:", error);
      throw new Error("Failed to calculate work order profitability");
    }
  }
}
