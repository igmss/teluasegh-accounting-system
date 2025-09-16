import { db, COLLECTIONS } from "../firebase";
import { DesignService } from "./design-service";

export class OrderItemDesignService {
  /**
   * Map order items to designs and calculate total costs
   */
  static async calculateOrderCostsFromDesigns(orderItems: any[]): Promise<{
    success: boolean;
    totalEstimatedCost: number;
    itemCosts: Array<{
      item: any;
      designId?: string;
      designName?: string;
      estimatedCost: number;
      materialCost: number;
      laborCost: number;
      overheadCost: number;
      quantity: number;
    }>;
    error?: string;
  }> {
    try {
      console.log(`Calculating costs for ${orderItems.length} order items from designs...`);
      
      const itemCosts = [];
      let totalEstimatedCost = 0;

      for (const item of orderItems) {
        console.log(`Processing item: ${item.name} (${item.productId})`);
        
        // Try to find design by product ID or name
        const design = await this.findDesignForItem(item);
        
        if (design) {
          console.log(`Found design: ${design.name} for item: ${item.name}`);
          
          const quantity = item.quantity || 1;
          const materialCost = design.materialCost * quantity;
          const laborCost = design.laborCost * quantity;
          const overheadCost = design.overheadCost * quantity;
          const estimatedCost = materialCost + laborCost + overheadCost;
          
          itemCosts.push({
            item,
            designId: design.id,
            designName: design.name,
            estimatedCost,
            materialCost,
            laborCost,
            overheadCost,
            quantity
          });
          
          totalEstimatedCost += estimatedCost;
          
          console.log(`Item ${item.name}: Estimated cost EGP ${estimatedCost} (Material: ${materialCost}, Labor: ${laborCost}, Overhead: ${overheadCost})`);
        } else {
          console.warn(`No design found for item: ${item.name} (${item.productId})`);
          
          // Use default costs if no design found
          const quantity = item.quantity || 1;
          const defaultCost = (item.basePrice || 0) * 0.3; // 30% of retail price as default cost
          
          itemCosts.push({
            item,
            designId: undefined,
            designName: undefined,
            estimatedCost: defaultCost,
            materialCost: defaultCost * 0.6,
            laborCost: defaultCost * 0.3,
            overheadCost: defaultCost * 0.1,
            quantity
          });
          
          totalEstimatedCost += defaultCost;
          
          console.log(`Item ${item.name}: Using default cost EGP ${defaultCost}`);
        }
      }

      console.log(`Total estimated cost for order: EGP ${totalEstimatedCost}`);

      return {
        success: true,
        totalEstimatedCost,
        itemCosts
      };

    } catch (error) {
      console.error("Error calculating order costs from designs:", error);
      return {
        success: false,
        totalEstimatedCost: 0,
        itemCosts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find design for an order item
   */
  private static async findDesignForItem(item: any): Promise<any | null> {
    try {
      // Method 1: Try to find by productId
      if (item.productId) {
        const designByProductId = await this.findDesignByProductId(item.productId);
        if (designByProductId) return designByProductId;
      }

      // Method 2: Try to find by product name
      if (item.name) {
        const designByName = await this.findDesignByName(item.name);
        if (designByName) return designByName;
      }

      // Method 3: Try to find by category
      if (item.category) {
        const designByCategory = await this.findDesignByCategory(item.category);
        if (designByCategory) return designByCategory;
      }

      return null;
    } catch (error) {
      console.error("Error finding design for item:", error);
      return null;
    }
  }

  /**
   * Find design by product ID
   */
  private static async findDesignByProductId(productId: string): Promise<any | null> {
    try {
      const snapshot = await db.collection(COLLECTIONS.DESIGNS)
        .where("productId", "==", productId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }

      return null;
    } catch (error) {
      console.error("Error finding design by product ID:", error);
      return null;
    }
  }

  /**
   * Find design by name (fuzzy matching)
   */
  private static async findDesignByName(itemName: string): Promise<any | null> {
    try {
      const snapshot = await db.collection(COLLECTIONS.DESIGNS).get();
      
      for (const doc of snapshot.docs) {
        const design = doc.data();
        const designName = design.name?.toLowerCase() || '';
        const itemNameLower = itemName.toLowerCase();
        
        // Check for exact match or partial match
        if (designName === itemNameLower || 
            designName.includes(itemNameLower) || 
            itemNameLower.includes(designName)) {
          return { id: doc.id, ...design };
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding design by name:", error);
      return null;
    }
  }

  /**
   * Find design by category
   */
  private static async findDesignByCategory(category: string): Promise<any | null> {
    try {
      const snapshot = await db.collection(COLLECTIONS.DESIGNS)
        .where("category", "==", category)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }

      return null;
    } catch (error) {
      console.error("Error finding design by category:", error);
      return null;
    }
  }

  /**
   * Create work order with automatic cost calculation from designs
   */
  static async createWorkOrderWithAutoCosts(
    salesOrderId: string,
    orderItems: any[],
    additionalData: any = {}
  ): Promise<{
    success: boolean;
    workOrderId?: string;
    totalEstimatedCost?: number;
    itemCosts?: any[];
    error?: string;
  }> {
    try {
      console.log(`Creating work order with auto costs for sales order ${salesOrderId}...`);

      // Calculate costs from designs
      const costCalculation = await this.calculateOrderCostsFromDesigns(orderItems);
      
      if (!costCalculation.success) {
        throw new Error(costCalculation.error || 'Failed to calculate costs');
      }

      // Create work order with calculated costs
      const workOrder = {
        id: `WO-${salesOrderId.split("-").slice(-1)[0]}-${Date.now()}`,
        sales_order_id: salesOrderId,
        raw_materials_used: [],
        materials_issued: [],
        labor_hours: costCalculation.itemCosts.reduce((sum, item) => 
          sum + (item.laborCost / 50), 0), // Assuming EGP 50/hour labor rate
        labor_cost: costCalculation.itemCosts.reduce((sum, item) => sum + item.laborCost, 0),
        overhead_cost: costCalculation.itemCosts.reduce((sum, item) => sum + item.overheadCost, 0),
        total_cost: 0, // Will be updated when materials are issued
        estimated_cost: costCalculation.totalEstimatedCost,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
        completionPercentage: 0,
        notes: `Auto-generated work order with design-based costs (EGP ${costCalculation.totalEstimatedCost})`,
        items: orderItems,
        item_costs: costCalculation.itemCosts, // Store item-level cost breakdown
        ...additionalData
      };

      // Save work order to database
      const workOrderRef = await db.collection(COLLECTIONS.WORK_ORDERS).add(workOrder);

      console.log(`✅ Created work order ${workOrderRef.id} with auto-calculated cost EGP ${costCalculation.totalEstimatedCost}`);

      return {
        success: true,
        workOrderId: workOrderRef.id,
        totalEstimatedCost: costCalculation.totalEstimatedCost,
        itemCosts: costCalculation.itemCosts
      };

    } catch (error) {
      console.error("Error creating work order with auto costs:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
