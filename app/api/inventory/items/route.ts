import { NextRequest, NextResponse } from "next/server";
import { db, COLLECTIONS } from "@/lib/firebase";

// GET /api/inventory/items - Get all inventory items for material selection
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Filter by type: 'raw', 'finished', etc.
    const search = searchParams.get('search'); // Search by name or SKU
    
    let query = db.collection(COLLECTIONS.INVENTORY_ITEMS);
    
    // Filter by type if specified
    if (type) {
      query = query.where('type', '==', type);
    }
    
    // Order by name for better UX
    query = query.orderBy('name', 'asc');
    
    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    }));
    
    // Apply search filter if specified
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item => 
        item.name?.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Only return items with available quantity
    items = items.filter(item => (item.quantity_on_hand || 0) > 0);
    
    return NextResponse.json({
      success: true,
      data: items,
      count: items.length
    });
    
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory items" },
      { status: 500 }
    );
  }
}
