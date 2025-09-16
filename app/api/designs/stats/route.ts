import { NextRequest, NextResponse } from "next/server";
import { DesignService } from "@/lib/services/design-service";

// GET /api/designs/stats - Get design statistics
export async function GET() {
  try {
    console.log("Fetching design statistics");

    const stats = await DesignService.getDesignStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error fetching design stats:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
