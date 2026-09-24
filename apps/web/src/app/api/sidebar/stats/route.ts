import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface SidebarStatsResponse {
  activeVaultsCount: number;
  pendingApprovalsCount: number;
  activeVault: {
    id: string;
    label: string;
    threshold: number;
    totalParticipants: number;
    network: string;
  } | null;
}

export async function GET() {
  let activeVaultsCount = 0;
  let pendingApprovalsCount = 0;
  let activeVault: SidebarStatsResponse["activeVault"] = null;
  let dbSuccess = false;

  // 1. Try local Prisma DB
  try {
    const [vaults, pendingApprovals] = await Promise.all([
      prisma.vault.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalRequest.findMany({
        where: { status: "PENDING" },
      }),
    ]);

    dbSuccess = true;
    const activeList = vaults.filter((v) => v.status === "ACTIVE");
    activeVaultsCount = activeList.length > 0 ? activeList.length : vaults.length;
    pendingApprovalsCount = pendingApprovals.length;

    const chosen = activeList[0] || vaults[0];
    if (chosen) {
      activeVault = {
        id: chosen.id,
        label: chosen.label,
        threshold: chosen.threshold,
        totalParticipants: chosen.totalParticipants,
        network: chosen.network,
      };
    }
  } catch (error) {
    console.warn("Prisma query failed in /api/sidebar/stats, trying Supabase:", error);
  }

  // 2. Supabase fallback if local DB failed or has 0 vaults
  if (!activeVault) {
    try {
      const [sbVaultsRes, sbApprovalsRes] = await Promise.all([
        supabase
          .from("vaults")
          .select("id, label, threshold, total_participants, status, network")
          .order("created_at", { ascending: false }),
        supabase
          .from("approval_requests")
          .select("id, status")
          .eq("status", "PENDING"),
      ]);

      if (sbVaultsRes.data && sbVaultsRes.data.length > 0) {
        dbSuccess = true;
        const sbVaults = sbVaultsRes.data;
        const activeList = sbVaults.filter((v) => v.status === "ACTIVE");
        activeVaultsCount = activeList.length > 0 ? activeList.length : sbVaults.length;
        const chosen = activeList[0] || sbVaults[0];
        if (chosen) {
          activeVault = {
            id: chosen.id,
            label: chosen.label,
            threshold: chosen.threshold,
            totalParticipants: chosen.total_participants,
            network: chosen.network || "TESTNET",
          };
        }
      }

      if (sbApprovalsRes.data) {
        pendingApprovalsCount = sbApprovalsRes.data.length;
      }
    } catch (error) {
      console.warn("Supabase query failed in /api/sidebar/stats:", error);
    }
  }

  // 3. Fallback demo data if neither database returned records
  if (!dbSuccess && !activeVault) {
    activeVault = {
      id: "vault-demo-001",
      label: "Foundation Treasury",
      threshold: 2,
      totalParticipants: 3,
      network: "TESTNET",
    };
    activeVaultsCount = 1;
    pendingApprovalsCount = 1;
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        activeVaultsCount,
        pendingApprovalsCount,
        activeVault,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
