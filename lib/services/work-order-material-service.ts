import { db, COLLECTIONS } from "../firebase";
import { DesignService } from "./design-service";
import type { MaterialRequirement } from "../types/designs";

export class WorkOrderMaterialService {
  /**
   * Issue materials for a work order based on design requirements
   */
  static async issueMaterialsForWorkOrder(
    workOrderId: string, 
    designId: string, 
    quantity: number = 1
  ): Promise<{
    success: boolean;
    issuedMaterials: MaterialRequirement[];
    totalCost: number;
    journalEntryId?: string;
    error?: string;
  }> {
    try {
      console.log(`Issuing materials for work order ${workOrderId}, design ${designId}, quantity ${quantity}`);

      // Get material requirements for the design
      const requirements = await DesignService.getMaterialRequirements(designId, quantity);
      
      // Check availability
      const unavailableMaterials = requirements.filter(req => !req.isAvailable);
      if (unavailableMaterials.length > 0) {
        return {
          success: false,
          issuedMaterials: [],
          totalCost: 0,
          error: `Insufficient materials: ${unavailableMaterials.map(m => m.inventoryItemName).join(', ')}`
        };
      }

      // Issue materials from inventory
      const issuedMaterials: MaterialRequirement[] = [];
      const batch = db.batch();
      let totalCost = 0;

      for (const requirement of requirements) {
        // Update inventory quantity
        const inventoryRef = db.collection(COLLECTIONS.INVENTORY_ITEMS)
          .doc(requirement.inventoryItemId);
        
        batch.update(inventoryRef, {
          quantity_on_hand: db.FieldValue.increment(-requirement.requiredQuantity),
          updatedAt: new Date()
        });

        // Create inventory movement record
        const movementRef = db.collection(COLLECTIONS.INVENTORY_MOVEMENTS).doc();
        batch.set(movementRef, {
          item_id: requirement.inventoryItemId,
          qty: -requirement.requiredQuantity, // Negative for issue
          type: "issue",
          related_doc: workOrderId,
          created_at: new Date(),
          description: `Issued for work order ${workOrderId} - Design ${designId}`,
          unit_cost: requirement.costPerUnit,
          total_cost: requirement.totalCost
        });

        issuedMaterials.push(requirement);
        totalCost += requirement.totalCost;
      }

      // Update work order with issued materials
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      batch.update(workOrderRef, {
        materials_issued: issuedMaterials.map(m => ({
          inventoryItemId: m.inventoryItemId,
          inventoryItemName: m.inventoryItemName,
          quantityIssued: m.requiredQuantity,
          unitCost: m.costPerUnit,
          totalCost: m.totalCost
        })),
        status: "in_progress",
        updated_at: new Date()
      });

      // Create journal entry for materials usage
      const journalEntryRef = db.collection(COLLECTIONS.JOURNAL_ENTRIES).doc();
      batch.set(journalEntryRef, {
        date: new Date(),
        entries: [
          {
            account_id: "INVENTORY_WIP",
            debit: totalCost,
            credit: 0,
            description: `Materials issued for work order ${workOrderId} - Design ${designId}`
          },
          {
            account_id: "INVENTORY_RAW",
            debit: 0,
            credit: totalCost,
            description: `Raw materials issued for work order ${workOrderId}`
          }
        ],
        linked_doc: workOrderId,
        created_at: new Date(),
        type: "material_issue"
      });

      // Commit all changes
      await batch.commit();

      console.log(`✅ Successfully issued materials for work order ${workOrderId}, total cost: EGP ${totalCost}`);

      return {
        success: true,
        issuedMaterials,
        totalCost,
        journalEntryId: journalEntryRef.id
      };

    } catch (error) {
      console.error("Error issuing materials for work order:", error);
      return {
        success: false,
        issuedMaterials: [],
        totalCost: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete work order and transfer from WIP to Finished Goods
   */
  static async completeWorkOrder(
    workOrderId: string,
    designId: string,
    quantity: number = 1
  ): Promise<{
    success: boolean;
    journalEntryId?: string;
    error?: string;
  }> {
    try {
      console.log(`Completing work order ${workOrderId} for design ${designId}`);

      // Get work order
      const workOrderDoc = await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).get();
      if (!workOrderDoc.exists) {
        throw new Error("Work order not found");
      }

      const workOrderData = workOrderDoc.data();
      const totalCost = workOrderData?.materials_issued?.reduce((sum: number, material: any) => 
        sum + material.totalCost, 0) || 0;

      // Update work order status
      await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).update({
        status: "completed",
        completed_at: new Date(),
        updated_at: new Date()
      });

      // Create journal entry for completion (WIP → Finished Goods)
      const journalEntryRef = db.collection(COLLECTIONS.JOURNAL_ENTRIES).doc();
      await db.collection(COLLECTIONS.JOURNAL_ENTRIES).doc(journalEntryRef.id).set({
        date: new Date(),
        entries: [
          {
            account_id: "INVENTORY_FINISHED",
            debit: totalCost,
            credit: 0,
            description: `Completed work order ${workOrderId} - Design ${designId}`
          },
          {
            account_id: "INVENTORY_WIP",
            debit: 0,
            credit: totalCost,
            description: `Work order ${workOrderId} completed`
          }
        ],
        linked_doc: workOrderId,
        created_at: new Date(),
        type: "work_order_completion"
      });

      console.log(`✅ Successfully completed work order ${workOrderId}`);

      return {
        success: true,
        journalEntryId: journalEntryRef.id
      };

    } catch (error) {
      console.error("Error completing work order:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get material requirements for a work order
   */
  static async getWorkOrderMaterialRequirements(
    workOrderId: string
  ): Promise<MaterialRequirement[]> {
    try {
      const workOrderDoc = await db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).get();
      if (!workOrderDoc.exists) {
        throw new Error("Work order not found");
      }

      const workOrderData = workOrderDoc.data();
      const designId = workOrderData?.design_id;
      const quantity = workOrderData?.quantity || 1;

      if (!designId) {
        throw new Error("Work order does not have a design ID");
      }

      return await DesignService.getMaterialRequirements(designId, quantity);

    } catch (error) {
      console.error("Error getting work order material requirements:", error);
      throw new Error("Failed to get work order material requirements");
    }
  }
}
