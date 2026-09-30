// ──────────────────────────────────────────────────────────────
// Quorum — F6: Viewing-Key Audit Export API
//
// GET /api/vaults/[id]/audit-export?format=csv|json
//
// Generates an exportable audit record of:
// 1. Vault configuration and threshold policy
// 2. Cryptographic participants and verification keys (public only)
// 3. Complete approval request lifecycle and round attribution events
// 4. On-chain transaction records verifiable independently via the
//    vault's Full Viewing Key (FVK), NOT just a database log.
//
// Zero-Custody: No spend keys or private shares are ever involved.
// ──────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { decryptViewingKey } from "@/lib/viewing-key-crypto";
import { getVaultIronwoodBalance } from "@/lib/onchain-balance";

export const dynamic = "force-dynamic";

interface AuditExportPayload {
  exportMetadata: {
    generatedAt: string;
    network: string;
    protocolVersion: string;
    viewingKeyScope: string | null;
    /**
     * First 16 and last 8 characters of the decrypted viewing key.
     * A truncation, not a hash and not a fingerprint.
     */
    truncatedViewingKey: string;
    disclaimer: string;
  };
  vault: {
    id: string;
    label: string;
    threshold: number;
    totalParticipants: number;
    shieldedAddress: string | null;
    status: string;
    createdAt: string;
  };
  participants: Array<{
    id: string;
    label: string;
    publicKeyIdentifier: string | null;
    isActive: boolean;
  }>;
  approvalRequests: Array<{
    id: string;
    recipientAddress: string;
    amountTAZ: string;
    amountZatoshi: string;
    memo: string | null;
    status: string;
    txid: string | null;
    anchorBlock: number | null;
    createdAt: string;
    roundEvents: Array<{
      id: string;
      participantLabel: string;
      roundType: string;
      status: string;
      culpritDetected: boolean;
      errorCode: string | null;
      timestamp: string;
    }>;
  }>;
  onchainVerification: {
    liveBalanceTAZ: string | null;
    balanceSource: string | null;
    howToVerify: string;
    pool: string;
    endpoint: string;
    reconciliationStatus: string;
  };
}

interface SbAuditParticipant {
  id: string;
  label: string;
  public_key_identifier: string | null;
  is_active: boolean;
  joined_at?: string | null;
  updated_at?: string | null;
}

interface SbAuditRoundEvent {
  id: string;
  approval_request_id: string;
  participant_id: string;
  round_type: "COMMITMENT" | "SIGNATURE_SHARE";
  status: "PENDING" | "RECEIVED" | "TIMEOUT" | "INVALID";
  culprit_detected?: boolean;
  error_code?: string | null;
  error_details?: string | null;
  timestamp?: string | null;
}

interface SbAuditApproval {
  id: string;
  recipient_address: string;
  amount_zatoshi?: number | string;
  memo: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "BROADCASTED";
  txid: string | null;
  anchor_block: number | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  signature_round_events?: SbAuditRoundEvent[] | null;
}

interface SbAuditVault {
  id: string;
  label: string;
  threshold: number;
  total_participants: number;
  shielded_address: string | null;
  status: "PENDING_DKG" | "ACTIVE" | "ARCHIVED";
  network: "TESTNET";
  created_at: string;
  updated_at: string;
  participants?: SbAuditParticipant[] | null;
  approval_requests?: SbAuditApproval[] | null;
}

interface AuditVaultModel {
  id: string;
  label: string;
  threshold: number;
  totalParticipants: number;
  shieldedAddress: string | null;
  status: string;
  network: string;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    id: string;
    vaultId: string;
    label: string;
    publicKeyIdentifier: string | null;
    isActive: boolean;
    joinedAt: Date;
    updatedAt: Date;
  }>;
  approvalRequests: Array<{
    id: string;
    vaultId: string;
    recipientAddress: string;
    amountZatoshi: bigint;
    memo: string | null;
    status: string;
    txid: string | null;
    anchorBlock: number | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    signatureRoundEvents: Array<{
      id: string;
      approvalRequestId: string;
      participantId: string;
      roundType: string;
      status: string;
      culpritDetected: boolean;
      errorCode: string | null;
      errorDetails: string | null;
      timestamp: Date;
      participant?: { label: string } | null;
    }>;
  }>;
  viewingKeys: Array<{
    encryptedViewingKey: string;
    scope: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") || "json";

  try {
    // 1. Fetch vault, participants, approvals, round events, and viewing key from Prisma
    let vault: AuditVaultModel | null = await prisma.vault.findUnique({
      where: { id },
      include: {
        participants: true,
        approvalRequests: {
          include: {
            signatureRoundEvents: {
              include: { participant: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        viewingKeys: {
          orderBy: { addedAt: "desc" },
          take: 1,
        },
      },
    });

    // Fallback: If not found in local DB, fetch from Supabase
    if (!vault && supabase) {
      const { data: rawSbVault } = await supabase
        .from("vaults")
        .select("*, participants(*), approval_requests(*, signature_round_events(*))")
        .eq("id", id)
        .maybeSingle();

      const sbVault = rawSbVault as unknown as SbAuditVault | null;

      if (sbVault) {
        vault = {
          id: sbVault.id,
          label: sbVault.label,
          threshold: sbVault.threshold,
          totalParticipants: sbVault.total_participants,
          shieldedAddress: sbVault.shielded_address,
          status: sbVault.status,
          network: sbVault.network,
          createdAt: new Date(sbVault.created_at),
          updatedAt: new Date(sbVault.updated_at),
          participants: (sbVault.participants || []).map((p: SbAuditParticipant) => ({
            id: p.id,
            vaultId: sbVault.id,
            label: p.label,
            publicKeyIdentifier: p.public_key_identifier,
            isActive: p.is_active,
            joinedAt: new Date(p.joined_at || 0),
            updatedAt: new Date(p.updated_at || 0),
          })),
          approvalRequests: (sbVault.approval_requests || []).map((a: SbAuditApproval) => ({
            id: a.id,
            vaultId: sbVault.id,
            recipientAddress: a.recipient_address,
            amountZatoshi: BigInt(a.amount_zatoshi || 0),
            memo: a.memo,
            status: a.status,
            txid: a.txid,
            anchorBlock: a.anchor_block,
            expiresAt: a.expires_at ? new Date(a.expires_at) : null,
            createdAt: new Date(a.created_at || 0),
            updatedAt: new Date(a.updated_at || 0),
            signatureRoundEvents: (a.signature_round_events || []).map((e: SbAuditRoundEvent) => ({
              id: e.id,
              approvalRequestId: a.id,
              participantId: e.participant_id,
              roundType: e.round_type,
              status: e.status,
              culpritDetected: e.culprit_detected || false,
              errorCode: e.error_code || null,
              errorDetails: e.error_details || null,
              timestamp: new Date(e.timestamp || 0),
              participant: (sbVault.participants || []).find((p: SbAuditParticipant) => p.id === e.participant_id) || {
                label: "Unknown Signer",
              },
            })),
          })),
          viewingKeys: [],
        };
      }
    }

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    // The exact disclaimer, in both formats. Paraphrasing it is how it got lost.
    const disclaimer = "The event log is ours. The chain is not.";

    // 2. Truncation of the viewing key, when one is stored. Not a hash.
    let truncatedViewingKey = "No viewing key stored";
    if (vault.viewingKeys && vault.viewingKeys.length > 0) {
      try {
        const decryptedKey = decryptViewingKey(vault.viewingKeys[0].encryptedViewingKey);
        truncatedViewingKey = `${decryptedKey.slice(0, 16)}...${decryptedKey.slice(-8)}`;
      } catch {
        truncatedViewingKey = "Viewing key stored, encrypted — not shown";
      }
    }

    // This vault's balance, or nothing.
    //
    // It used to be getLiveWalletBalance() — the operator's local wallet,
    // whichever vault this export was for. An audit export exists so a funder
    // can check our figures against the chain; a figure belonging to a
    // different wallet is worse than no figure, because the recipient has no
    // way to know it is not theirs.
    const vaultBalance = await getVaultIronwoodBalance(vault.shieldedAddress);

    // 3. Assemble Audit Export Data Structure
    const auditData: AuditExportPayload = {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        network: vault.network,
        protocolVersion: "ZIP-312 / FROST-RedPallas v3 (Ironwood Pool)",
        viewingKeyScope:
          vault.viewingKeys && vault.viewingKeys.length > 0
            ? vault.viewingKeys[0].scope ?? null
            : null,
        truncatedViewingKey,
        disclaimer,
      },
      vault: {
        id: vault.id,
        label: vault.label,
        threshold: vault.threshold,
        totalParticipants: vault.totalParticipants,
        shieldedAddress: vault.shieldedAddress,
        status: vault.status,
        createdAt: vault.createdAt.toISOString(),
      },
      participants: vault.participants.map((p) => ({
        id: p.id,
        label: p.label,
        publicKeyIdentifier: p.publicKeyIdentifier,
        isActive: p.isActive,
      })),
      approvalRequests: vault.approvalRequests.map((a) => {
        const amountTAZ = (Number(a.amountZatoshi) / 100_000_000).toFixed(8);
        return {
          id: a.id,
          recipientAddress: a.recipientAddress,
          amountTAZ,
          amountZatoshi: a.amountZatoshi.toString(),
          memo: a.memo,
          status: a.status,
          txid: a.txid,
          anchorBlock: a.anchorBlock,
          createdAt: a.createdAt.toISOString(),
          roundEvents: a.signatureRoundEvents.map((e) => ({
            id: e.id,
            participantLabel: e.participant?.label || "Unknown Signer",
            roundType: e.roundType,
            status: e.status,
            culpritDetected: e.culpritDetected,
            errorCode: e.errorCode,
            timestamp: e.timestamp.toISOString(),
          })),
        };
      }),
      onchainVerification: {
        liveBalanceTAZ: vaultBalance?.ironwood ?? null,
        balanceSource: vaultBalance?.source ?? null,
        pool: "Ironwood (Nu6.3 Testnet)",
        endpoint: "testnet.zec.rocks:443",
        // Said plainly, because this line is the whole point of the export.
        // We did not reconcile anything: the event log below is ours, and a
        // log its author vouches for is worth nothing. The viewing key above
        // is what makes this checkable — scan the chain with it and compare.
        reconciliationStatus: vaultBalance
          ? "BALANCE_READ_FROM_CHAIN_FOR_THIS_VAULT"
          : "NOT_RECONCILED_NO_VIEWING_KEY_AVAILABLE_HERE",
        howToVerify:
          "Import the viewing key into a wallet, sync, and compare against the events below. " +
          disclaimer,
      },
    };

    // 4. Return as CSV or JSON
    if (format === "csv") {
      const csvRows: string[] = [];
      csvRows.push("--- AUDIT EXPORT METADATA ---");
      csvRows.push(`GeneratedAt,${auditData.exportMetadata.generatedAt}`);
      csvRows.push(`Network,${auditData.exportMetadata.network}`);
      csvRows.push(`Protocol,${auditData.exportMetadata.protocolVersion}`);
      csvRows.push(`TruncatedViewingKey,${auditData.exportMetadata.truncatedViewingKey}`);
      csvRows.push(`Disclaimer,"${auditData.exportMetadata.disclaimer}"`);
      csvRows.push(
        `IronwoodBalance,${
          auditData.onchainVerification.liveBalanceTAZ
            ? `${auditData.onchainVerification.liveBalanceTAZ} TAZ`
            : "not read — see ReconciliationStatus"
        }`
      );
      csvRows.push(`ReconciliationStatus,${auditData.onchainVerification.reconciliationStatus}`);
      csvRows.push("");

      csvRows.push("--- VAULT CONFIGURATION ---");
      csvRows.push(`VaultID,${auditData.vault.id}`);
      csvRows.push(`Label,${auditData.vault.label}`);
      csvRows.push(`ThresholdPolicy,${auditData.vault.threshold} of ${auditData.vault.totalParticipants}`);
      csvRows.push(`ShieldedAddress,${auditData.vault.shieldedAddress || "N/A"}`);
      csvRows.push("");

      csvRows.push("--- PARTICIPANTS ---");
      csvRows.push("ParticipantID,Label,Status,PublicKeyIdentifier");
      auditData.participants.forEach((p) => {
        csvRows.push(`"${p.id}","${p.label}","${p.isActive ? "ACTIVE" : "STANDBY"}","${p.publicKeyIdentifier || "N/A"}"`);
      });
      csvRows.push("");

      csvRows.push("--- SPEND APPROVAL AUDIT LOG ---");
      csvRows.push("ApprovalID,CreatedAt,RecipientAddress,AmountTAZ,Status,TxID,AnchorBlock,Memo");
      auditData.approvalRequests.forEach((a) => {
        csvRows.push(`"${a.id}","${a.createdAt}","${a.recipientAddress}","${a.amountTAZ}","${a.status}","${a.txid || ""}","${a.anchorBlock || ""}","${(a.memo || "").replace(/"/g, '""')}"`);
      });

      const csvContent = csvRows.join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="vault-audit-${id}-${Date.now()}.csv"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(auditData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="vault-audit-${id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("Audit export error:", error);
    return NextResponse.json(
      {
        error: `Failed to export audit log: ${
          error instanceof Error ? error.message : "Internal error"
        }`,
      },
      { status: 500 }
    );
  }
}
