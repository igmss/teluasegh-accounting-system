import { NextRequest, NextResponse } from "next/server";
import { DesignService } from "@/lib/services/design-service";

// POST /api/designs/import - Import designs from products collection
export async function POST() {
  try {
    console.log("Starting design import from products collection");

    const result = await DesignService.importFromProducts();
    
    return NextResponse.json({
      success: true,
      data: result,
      message: result.updated > 0 
        ? `Successfully imported ${result.imported} new designs, updated ${result.updated} existing designs`
        : `Successfully imported ${result.imported} new designs`
    });

  } catch (error) {
    console.error("Error importing designs:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
