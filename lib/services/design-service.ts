import { db, COLLECTIONS } from "../firebase";
import type { 
  Design, 
  DesignFilter, 
  DesignStats, 
  Material, 
  Process, 
  DesignVariant,
  MaterialRequirement 
} from "../types/designs";

export class DesignService {
  private static readonly COLLECTION_NAME = COLLECTIONS.DESIGNS;

  /**
   * Get all designs with optional filtering and pagination
   */
  static async getDesigns(
    filter?: DesignFilter,
    lastDocId?: string,
    pageSize: number = 50
  ): Promise<{ designs: Design[]; lastDoc?: any; hasMore: boolean }> {
    try {
      console.log("DesignService.getDesigns called with:", { filter, lastDocId, pageSize });
      console.log("Collection name:", this.COLLECTION_NAME);
      
      let query = db.collection(this.COLLECTION_NAME).orderBy("createdAt", "desc").limit(pageSize);

      // Apply filters
      if (filter?.category) {
        query = query.where("category", "==", filter.category);
      }
      if (filter?.subcategory) {
        query = query.where("subcategory", "==", filter.subcategory);
      }
      if (filter?.status) {
        query = query.where("status", "==", filter.status);
      }
      if (filter?.complexity) {
        query = query.where("complexity", "==", filter.complexity);
      }

      // Add pagination
      if (lastDocId) {
        const lastDoc = await db.collection(this.COLLECTION_NAME).doc(lastDocId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      const snapshot = await query.get();
      console.log("Query executed successfully, found", snapshot.docs.length, "documents");
      
      const designs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
        };
      }) as Design[];

      // Apply client-side filters for cost ranges
      let filteredDesigns = designs;
      if (filter?.minCost !== undefined) {
        filteredDesigns = filteredDesigns.filter(d => d.totalCost >= filter.minCost!);
      }
      if (filter?.maxCost !== undefined) {
        filteredDesigns = filteredDesigns.filter(d => d.totalCost <= filter.maxCost!);
      }

      console.log("Returning", filteredDesigns.length, "filtered designs");
      
      return {
        designs: filteredDesigns,
        lastDoc: snapshot.docs[snapshot.docs.length - 1],
        hasMore: snapshot.docs.length === pageSize
      };
    } catch (error) {
      console.error("Error fetching designs:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to fetch designs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single design by ID
   */
  static async getDesign(id: string): Promise<Design | null> {
    try {
      const docRef = db.collection(this.COLLECTION_NAME).doc(id);
      const docSnap = await docRef.get();
      
          if (docSnap.exists) {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : (data?.createdAt || new Date()),
              updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate() : (data?.updatedAt || new Date())
            } as Design;
          }
      return null;
    } catch (error) {
      console.error("Error fetching design:", error);
      throw new Error("Failed to fetch design");
    }
  }

  /**
   * Create a new design
   */
  static async createDesign(designData: Omit<Design, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      const designDoc = {
        ...designData,
        totalCost: this.calculateTotalCost(designData),
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection(this.COLLECTION_NAME).add(designDoc);
      console.log("Design created with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error creating design:", error);
      throw new Error("Failed to create design");
    }
  }

  /**
   * Update an existing design
   */
  static async updateDesign(id: string, updates: Partial<Omit<Design, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION_NAME).doc(id);
      
      // Recalculate costs and margins if relevant fields are updated
      const updateData: any = {
        ...updates,
        updatedAt: new Date()
      };

      if (updates.materialCost !== undefined || 
          updates.laborCost !== undefined || 
          updates.overheadCost !== undefined) {
        updateData.totalCost = this.calculateTotalCost(updates as Design);
      }

      await docRef.update(updateData);
      console.log("Design updated:", id);
    } catch (error) {
      console.error("Error updating design:", error);
      throw new Error("Failed to update design");
    }
  }

  /**
   * Delete a design
   */
  static async deleteDesign(id: string): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION_NAME).doc(id);
      await docRef.delete();
      console.log("Design deleted:", id);
    } catch (error) {
      console.error("Error deleting design:", error);
      throw new Error("Failed to delete design");
    }
  }

  /**
   * Get design statistics
   */
  static async getDesignStats(): Promise<DesignStats> {
    try {
      const snapshot = await db.collection(this.COLLECTION_NAME).get();
      const designs = snapshot.docs.map(doc => doc.data()) as Design[];

      const stats: DesignStats = {
        totalDesigns: designs.length,
        activeDesigns: designs.filter(d => d.status === 'active').length,
        inactiveDesigns: designs.filter(d => d.status === 'inactive').length,
        discontinuedDesigns: designs.filter(d => d.status === 'discontinued').length,
        averageCost: designs.reduce((sum, d) => sum + d.totalCost, 0) / designs.length || 0,
        totalCostValue: designs.reduce((sum, d) => sum + (d.totalCost * 10), 0), // Assuming 10 units average
        categoryBreakdown: {}
      };

      // Calculate category breakdown
      designs.forEach(design => {
        stats.categoryBreakdown[design.category] = (stats.categoryBreakdown[design.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error("Error fetching design stats:", error);
      throw new Error("Failed to fetch design statistics");
    }
  }

  /**
   * Import designs from main website products collection
   */
  static async importFromProducts(): Promise<{ imported: number; errors: string[] }> {
    try {
      console.log("Starting import of designs from products collection...");
      
      // Fetch products from main website
      const productsSnapshot = await db.collection(COLLECTIONS.PRODUCTS).get();
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${products.length} products to import`);

      const batch = db.batch();
      let imported = 0;
      const errors: string[] = [];

      for (const product of products) {
        try {
          // Convert product to design format
          const designData: Omit<Design, "id" | "createdAt" | "updatedAt"> = {
            name: product.name || "Unnamed Design",
            description: product.description || "",
            category: product.category || "General",
            subcategory: product.subcategory || "",
            image: product.image || "",
            images: product.images || [],
            
            // Default cost configuration (to be updated manually)
            materialCost: product.basePrice ? product.basePrice * 0.15 : 150,
            laborCost: product.basePrice ? product.basePrice * 0.1 : 100,
            overheadCost: product.basePrice ? product.basePrice * 0.05 : 50,
            totalCost: 0, // Will be calculated
            
            // Manufacturing details
            manufacturingTime: 2, // Default 2 hours
            complexity: 'medium',
            materials: [],
            processes: [],
            
            // Status
            status: 'active',
            createdBy: 'system-import',
            updatedBy: 'system-import',
            
            // Additional fields
            tags: product.tags || [],
            notes: `Imported from product: ${product.id}`,
            variants: []
          };

          // Calculate total cost
          designData.totalCost = this.calculateTotalCost(designData);

          const designRef = db.collection(this.COLLECTION_NAME).doc();
          batch.set(designRef, {
            ...designData,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          imported++;
        } catch (error) {
          console.error(`Error importing product ${product.id}:`, error);
          errors.push(`Product ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      await batch.commit();
      console.log(`Successfully imported ${imported} designs`);

      return { imported, errors };
    } catch (error) {
      console.error("Error importing designs:", error);
      throw new Error("Failed to import designs from products");
    }
  }

  /**
   * Calculate total cost for a design
   */
  private static calculateTotalCost(design: Partial<Design>): number {
    const materialCost = design.materialCost || 0;
    const laborCostPerHour = design.laborCost || 0;
    const manufacturingTime = design.manufacturingTime || 0;
    const overheadCost = design.overheadCost || 0;
    
    // Labor cost = cost per hour × manufacturing time
    const totalLaborCost = laborCostPerHour * manufacturingTime;
    
    return materialCost + totalLaborCost + overheadCost;
  }


  /**
   * Get categories for filtering
   */
  static async getCategories(): Promise<string[]> {
    try {
      const snapshot = await db.collection(this.COLLECTION_NAME).get();
      const categories = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.category) {
          categories.add(data.category);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }

  /**
   * Get subcategories for a given category
   */
  static async getSubcategories(category: string): Promise<string[]> {
    try {
      const snapshot = await db.collection(this.COLLECTION_NAME)
        .where("category", "==", category)
        .get();
      
      const subcategories = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.subcategory) {
          subcategories.add(data.subcategory);
        }
      });

      return Array.from(subcategories).sort();
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      return [];
    }
  }

  /**
   * Get material requirements for a design (for work order creation)
   */
  static async getMaterialRequirements(designId: string, quantity: number = 1): Promise<MaterialRequirement[]> {
    try {
      const design = await this.getDesign(designId);
      if (!design) {
        throw new Error("Design not found");
      }

      const materialRequirements: MaterialRequirement[] = [];

      for (const material of design.materials) {
        if (material.inventoryItemId) {
          // Get current inventory data
          const inventoryDoc = await db.collection(COLLECTIONS.INVENTORY_ITEMS)
            .doc(material.inventoryItemId)
            .get();

          if (inventoryDoc.exists) {
            const inventoryData = inventoryDoc.data();
            const requiredQuantity = material.quantityPerUnit * quantity;
            const availableQuantity = inventoryData?.quantity_on_hand || 0;
            const costPerUnit = inventoryData?.cost_per_unit || material.costPerUnit;

            materialRequirements.push({
              inventoryItemId: material.inventoryItemId,
              inventoryItemName: material.inventoryItemName || material.name,
              inventoryItemSku: material.inventoryItemSku || '',
              requiredQuantity,
              unit: material.unit,
              costPerUnit,
              totalCost: requiredQuantity * costPerUnit,
              availableQuantity,
              isAvailable: availableQuantity >= requiredQuantity
            });
          }
        }
      }

      return materialRequirements;
    } catch (error) {
      console.error("Error getting material requirements:", error);
      throw new Error("Failed to get material requirements");
    }
  }

  /**
   * Check if materials are available for a design
   */
  static async checkMaterialAvailability(designId: string, quantity: number = 1): Promise<{
    isAvailable: boolean;
    unavailableMaterials: MaterialRequirement[];
    totalCost: number;
  }> {
    try {
      const requirements = await this.getMaterialRequirements(designId, quantity);
      
      const unavailableMaterials = requirements.filter(req => !req.isAvailable);
      const totalCost = requirements.reduce((sum, req) => sum + req.totalCost, 0);

      return {
        isAvailable: unavailableMaterials.length === 0,
        unavailableMaterials,
        totalCost
      };
    } catch (error) {
      console.error("Error checking material availability:", error);
      throw new Error("Failed to check material availability");
    }
  }
}
