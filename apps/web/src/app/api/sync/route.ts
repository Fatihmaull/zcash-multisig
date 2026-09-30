import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Health & Sync endpoint to verify database and Supabase connectivity
 */
export async function GET() {
  try {
    const [vaultCount, requestCount] = await Promise.all([
      prisma.vault.count(),
      prisma.approvalRequest.count(),
    ]);

    // Test Supabase connectivity when it is configured
    let supabaseStatus: {
      connected: boolean;
      records: unknown[];
      error: string | null;
    } = {
      connected: false,
      records: [],
      error: "Supabase is not configured",
    };
    if (supabase) {
      const { data: supabaseVaults, error: supabaseError } = await supabase
        .from("vaults")
        .select("id, label, status")
        .limit(5);
      supabaseStatus = {
        connected: !supabaseError,
        records: supabaseVaults || [],
        error: supabaseError ? supabaseError.message : null,
      };
    }

    return NextResponse.json({
      status: "connected",
      database: {
        active: true,
        vaultsCount: vaultCount,
        approvalRequestsCount: requestCount,
      },
      supabase: supabaseStatus,
      network: "testnet",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}
