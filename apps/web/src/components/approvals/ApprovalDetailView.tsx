"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  X,
} from "lucide-react";
import { QuorumIndicator } from "./QuorumIndicator";
import { MisbehaviorAlert } from "./MisbehaviorAlert";
import { useUI } from "@/context/UIContext";
import { Button } from "@/components/ui/Button";

interface RoundEvent {
  participantId: string;
  roundType: string;
  status: string;
  culpritDetected?: boolean;
}

interface ParticipantRecord {
  id: string;
  label: string;
}

interface ApprovalInitialData {
  id: string;
  amountZec: string | null;
  purpose: string | null;
  vaultName: string | null;
  recipientAddress: string | null;
  status: string;
  txid?: string | null;
  threshold?: number | null;
  totalParticipants?: number | null;
  participants?: ParticipantRecord[];
  signatureRoundEvents?: RoundEvent[];
}

interface ApprovalDetailViewProps {
  requestId?: string;
  showMisbehavior?: boolean;
  initialData?: ApprovalInitialData;
  /**
   * This vault's Ironwood balance, or null when it cannot be read.
   * A shielded balance needs the vault's viewing key. When null, the
   * sufficiency check is skipped — a shortfall that was not measured is
   * not a shortfall we can warn about.
   */
  liveBalance?: string | null;
}

const NOT_RECORDED = "not recorded";

function isRecordedAddress(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || /not recorded/i.test(trimmed)) return false;
  return trimmed.startsWith("utest1") || trimmed.startsWith("u1");
}

function policyLabel(threshold: number | null | undefined, total: number | null | undefined): string {
  if (threshold == null || total == null) return NOT_RECORDED;
  return `${threshold} of ${total}`;
}

export function ApprovalDetailView({
  requestId = "req-demo-001",
  showMisbehavior: propShowMisbehavior,
  initialData,
  liveBalance = null,
}: ApprovalDetailViewProps) {
  const { activeScenario, setActiveScenario } = useUI();
  const isBroadcast = initialData?.status === "BROADCASTED";

  const isMalicious = !isBroadcast && (propShowMisbehavior ?? activeScenario === "malicious_share");
  const isTimeout = !isBroadcast && activeScenario === "non_responding";

  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [bobSigned, setBobSigned] = useState(false);
  const [carolSigned, setCarolSigned] = useState(false);
  const [excludedCulprit, setExcludedCulprit] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    if (isBroadcast) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- simulation reset when the scenario toggle changes
    setBobSigned(false);
    setCarolSigned(false);
    setExcludedCulprit(false);
    setIsSigning(false);
  }, [activeScenario, isBroadcast]);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
  };

  const amountText = initialData?.amountZec ?? null;
  const proposalAmount = amountText ? parseFloat(amountText) : null;
  const availableBalance = liveBalance === null ? null : parseFloat(liveBalance);
  const isInsufficient =
    !isBroadcast &&
    availableBalance !== null &&
    proposalAmount !== null &&
    availableBalance < proposalAmount;

  const threshold = initialData?.threshold ?? null;
  const totalParticipants = initialData?.totalParticipants ?? null;
  const policy = policyLabel(threshold, totalParticipants);

  const recordedShares = (initialData?.signatureRoundEvents ?? []).filter(
    (event) => event.roundType === "SIGNATURE_SHARE"
  );
  const recordedCollected = recordedShares.filter((event) => event.status === "RECEIVED").length;

  // The simulated demo marks Alice approved up front. That count is not a
  // reading — the card that shows it is labelled Simulated, and it is not
  // used once a request has been broadcast.
  let simulatedCollected = 1;
  if (bobSigned && !isMalicious) simulatedCollected += 1;
  if (carolSigned) simulatedCollected += 1;
  const collectedSignatures = isBroadcast ? recordedCollected : simulatedCollected;
  const isQuorumMet = threshold !== null && collectedSignatures >= threshold;
  const remaining =
    threshold !== null ? Math.max(0, threshold - collectedSignatures) : null;

  const participantLabel = (participantId: string) =>
    initialData?.participants?.find((participant) => participant.id === participantId)?.label ??
    NOT_RECORDED;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const postSimulatedSign = async (signer: "Bob" | "Carol", rejected: boolean) => {
    if (isBroadcast) return;
    if (isInsufficient && availableBalance !== null && proposalAmount !== null) {
      showToast(
        "Approval not recorded",
        `The viewing-key balance (${availableBalance.toFixed(8)} TAZ) is below this proposal (${proposalAmount.toFixed(8)} TAZ).`
      );
      return;
    }

    setIsSigning(true);
    try {
      await fetch(`/api/approvals/${requestId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer,
          status: rejected ? "REJECTED" : "APPROVED",
        }),
      });
    } catch (err) {
      console.error("Failed to record simulated sign:", err);
    }
    setIsSigning(false);
    if (signer === "Bob") setBobSigned(true);
    if (signer === "Carol") setCarolSigned(true);
  };

  const handleExcludeCulprit = () => {
    setExcludedCulprit(true);
    setActiveScenario("happy_path");
  };

  const statusPill = isBroadcast
    ? "BROADCASTED"
    : isMalicious && !excludedCulprit
      ? "SHARE REJECTED · Simulated"
      : "AWAITING SIGNATURES · Simulated";

  const statusPillClass = isBroadcast
    ? "bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]"
    : isMalicious && !excludedCulprit
      ? "bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]"
      : "bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-border)]";

  return (
    <div className="space-y-6 max-w-6xl mx-auto relative">
      {toastMessage && (
        <div
          className="fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl border text-[var(--text-primary)] shadow-lg flex items-start gap-3"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--danger-border)",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ color: "var(--danger)" }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1 pr-2">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: "var(--danger-text)" }}>
              {toastMessage.title}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{toastMessage.desc}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Approvals
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {amountText ?? "—"}{" "}
              {amountText && (
                <span className="text-[var(--zcash-gold)] text-lg sm:text-xl font-normal">TAZ</span>
              )}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${statusPillClass}`}>
              {statusPill}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Purpose: {initialData?.purpose ? `\u201c${initialData.purpose}\u201d` : NOT_RECORDED}
          </p>
        </div>

        <div className="text-left sm:text-right text-xs text-[var(--text-muted)]">
          <div>Proposal ID</div>
          <div className="text-[var(--text-primary)] font-mono font-medium">{requestId}</div>
        </div>
      </div>

      {isInsufficient && availableBalance !== null && proposalAmount !== null && (
        <div
          className="p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs"
          style={{
            borderColor: "var(--danger-border)",
            background: "var(--danger-bg)",
            color: "var(--danger-text)",
          }}
        >
          <div className="flex items-center gap-2.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              This proposal is {proposalAmount.toFixed(8)} TAZ. The viewing-key balance read here is{" "}
              {availableBalance.toFixed(8)} TAZ.
            </span>
          </div>
        </div>
      )}

      {isMalicious && !excludedCulprit && (
        <MisbehaviorAlert
          participantName="Bob"
          recoverable
          onExcludeCulprit={handleExcludeCulprit}
        />
      )}

      {isBroadcast && (
        <div
          className="p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{
            borderColor: "var(--success-border)",
            background: "var(--success-bg)",
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--success-text)" }}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Broadcast recorded · {policy} policy</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono break-all">
              TxID: {initialData?.txid || NOT_RECORDED}
            </p>
          </div>
          <span
            className="text-xs px-3 py-1 rounded-full shrink-0 font-medium font-mono"
            style={{
              color: "var(--info)",
              background: "var(--info-bg)",
              border: "1px solid var(--info-border)",
            }}
          >
            Testnet
          </span>
        </div>
      )}

      {!isBroadcast && isQuorumMet && (
        <div
          className="p-4 rounded-2xl border text-sm"
          style={{
            borderColor: "var(--success-border)",
            background: "var(--success-bg)",
            color: "var(--success-text)",
          }}
        >
          Simulated — the threshold is marked reached in this demo. No transaction was broadcast.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--zcash-gold)]" />
              Spend Proposal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)]">Source Vault</span>
                <p className="text-[var(--text-primary)] font-semibold text-sm">
                  {initialData?.vaultName || NOT_RECORDED}
                </p>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                  {policy} threshold
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)]">Transfer Amount</span>
                <p className="text-[var(--text-primary)] font-semibold text-sm font-mono">
                  {amountText ? `${amountText} TAZ` : NOT_RECORDED}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Recipient Address (Shielded / Private)
                </span>
                {isRecordedAddress(initialData?.recipientAddress) && (
                  <button
                    onClick={() => copyToClipboard(initialData.recipientAddress as string)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--zcash-gold)] hover:underline font-medium cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Address"}</span>
                  </button>
                )}
              </div>
              <p className="font-mono text-xs text-[var(--text-secondary)] break-all bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-default)] select-all">
                {initialData?.recipientAddress || NOT_RECORDED}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                  {isBroadcast && recordedShares.length === 0
                    ? "Signatures: not recorded"
                    : `Signer Approvals (${
                        threshold != null
                          ? `${collectedSignatures} of ${threshold} recorded`
                          : NOT_RECORDED
                      })`}
                </h2>
                {!isBroadcast && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border"
                    style={{
                      background: "var(--warning-bg)",
                      color: "var(--warning-text)",
                      borderColor: "var(--warning-border)",
                    }}
                  >
                    Simulated
                  </span>
                )}
              </div>
            </div>

            {isBroadcast ? (
              recordedShares.length > 0 ? (
                <div className="space-y-3">
                  {recordedShares.map((event, index) => {
                    const approved = event.status === "RECEIVED" && !event.culpritDetected;
                    const rejected = event.status === "INVALID" || event.culpritDetected;
                    return (
                      <div
                        key={`${event.participantId}-${index}`}
                        className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                        style={{
                          borderColor: rejected
                            ? "var(--danger-border)"
                            : approved
                              ? "var(--success-border)"
                              : "var(--border-default)",
                          background: rejected
                            ? "var(--danger-bg)"
                            : approved
                              ? "var(--success-bg)"
                              : "var(--bg-secondary)",
                        }}
                      >
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {participantLabel(event.participantId)}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{event.status}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium font-mono text-[var(--text-secondary)]">
                          {event.roundType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Signature events for this broadcast are not recorded in this app.
                </p>
              )
            ) : (
              <div className="space-y-3">
                <SignerRow
                  initial="A"
                  name="Alice (Lead Signer)"
                  detail="Simulated — marked approved in this demo"
                  badge="APPROVED"
                  tone="success"
                />

                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                  style={{
                    borderColor:
                      bobSigned && !isMalicious
                        ? "var(--success-border)"
                        : isMalicious && !excludedCulprit
                          ? "var(--danger-border)"
                          : isTimeout
                            ? "var(--warning-border)"
                            : "var(--border-default)",
                    background:
                      bobSigned && !isMalicious
                        ? "var(--success-bg)"
                        : isMalicious && !excludedCulprit
                          ? "var(--danger-bg)"
                          : isTimeout
                            ? "var(--warning-bg)"
                            : "var(--bg-secondary)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[var(--text-secondary)]">
                      {bobSigned && !isMalicious ? "✓" : isMalicious && !excludedCulprit ? "✕" : "B"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Bob (Co-Signer)</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {bobSigned && !isMalicious
                          ? "Simulated approval"
                          : isMalicious && !excludedCulprit
                            ? "Simulated invalid share"
                            : isTimeout
                              ? "Simulated — not responding"
                              : "Simulated — awaiting a click"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!bobSigned && !isMalicious && !isTimeout && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => postSimulatedSign("Bob", false)}
                        isLoading={isSigning}
                        disabled={isSigning}
                      >
                        <span>Sign as Bob</span>
                        <span className="text-[10px] opacity-75 font-normal ml-1">(Simulated)</span>
                      </Button>
                    )}
                    <StatusBadge
                      tone={
                        bobSigned && !isMalicious
                          ? "success"
                          : isMalicious && !excludedCulprit
                            ? "danger"
                            : "warning"
                      }
                      label={
                        bobSigned && !isMalicious
                          ? "APPROVED"
                          : isMalicious && !excludedCulprit
                            ? "REJECTED"
                            : isTimeout
                              ? "OFFLINE"
                              : "PENDING"
                      }
                    />
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                  style={{
                    borderColor: carolSigned ? "var(--success-border)" : "var(--border-default)",
                    background: carolSigned ? "var(--success-bg)" : "var(--bg-secondary)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[var(--text-secondary)]">
                      {carolSigned ? "✓" : "C"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Carol (Standby Signer)</div>
                      <div className="text-xs text-[var(--text-muted)]">Simulated standby</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(excludedCulprit || isTimeout) && !carolSigned && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => postSimulatedSign("Carol", false)}
                        isLoading={isSigning}
                        disabled={isSigning}
                      >
                        <span>Sign as Carol</span>
                        <span className="text-[10px] opacity-75 font-normal ml-1">(Simulated)</span>
                      </Button>
                    )}
                    <StatusBadge tone={carolSigned ? "success" : "muted"} label={carolSigned ? "APPROVED" : "STANDBY"} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col items-center justify-center text-center space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Approval Quorum
            </h3>

            {threshold != null && totalParticipants != null && (!isBroadcast || recordedShares.length > 0) ? (
              <div className="py-2">
                <QuorumIndicator
                  collected={collectedSignatures}
                  required={threshold}
                  total={totalParticipants}
                  size={150}
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {isBroadcast
                  ? "Signature count not recorded in this app."
                  : "Threshold not recorded for this request."}
              </p>
            )}

            <div className="w-full pt-4 border-t border-[var(--border-subtle)] space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Required Quorum:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {threshold != null && totalParticipants != null
                    ? `${threshold} of ${totalParticipants} signers`
                    : NOT_RECORDED}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Current Status:</span>
                <span
                  style={{
                    color: isBroadcast
                      ? "var(--success-text)"
                      : isQuorumMet
                        ? "var(--success-text)"
                        : "var(--warning-text)",
                  }}
                >
                  {isBroadcast
                    ? "Broadcast recorded"
                    : isQuorumMet
                      ? "Threshold reached · Simulated"
                      : remaining != null
                        ? `${remaining} more in this simulation`
                        : NOT_RECORDED}
                </span>
              </div>
            </div>
          </div>

          {!isBroadcast && (
            <div
              className="p-5 rounded-2xl border space-y-3"
              style={{
                borderColor: "var(--info-border)",
                background: "var(--info-bg)",
              }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--info)" }}>
                <Sparkles className="w-4 h-4" />
                <span>Simulated edge cases</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                These buttons are simulated. They do not collect a signature and they do not move funds.
              </p>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={activeScenario === "happy_path" && !isMalicious ? "primary" : "outline"}
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setActiveScenario("happy_path");
                    setExcludedCulprit(false);
                  }}
                  className="justify-start text-left"
                >
                  1. Normal flow (Bob signs)
                </Button>
                <Button
                  variant={activeScenario === "non_responding" ? "primary" : "outline"}
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setActiveScenario("non_responding");
                    setExcludedCulprit(false);
                  }}
                  className="justify-start text-left"
                >
                  2. Bob not responding (Carol)
                </Button>
                <Button
                  variant={activeScenario === "malicious_share" && !excludedCulprit ? "danger" : "outline"}
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setActiveScenario("malicious_share");
                    setExcludedCulprit(false);
                  }}
                  className="justify-start text-left"
                >
                  3. Invalid share
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignerRow({
  initial,
  name,
  detail,
  badge,
  tone,
}: {
  initial: string;
  name: string;
  detail: string;
  badge: string;
  tone: "success" | "warning" | "danger" | "muted";
}) {
  return (
    <div
      className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
      style={{
        borderColor: tone === "success" ? "var(--success-border)" : "var(--border-default)",
        background: tone === "success" ? "var(--success-bg)" : "var(--bg-secondary)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[var(--text-secondary)]">
          {initial === "A" && tone === "success" ? "✓" : initial}
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{name}</div>
          <div className="text-xs text-[var(--text-muted)]">{detail}</div>
        </div>
      </div>
      <StatusBadge tone={tone} label={badge} />
    </div>
  );
}

function StatusBadge({
  tone,
  label,
}: {
  tone: "success" | "warning" | "danger" | "muted";
  label: string;
}) {
  const style =
    tone === "success"
      ? { background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }
      : tone === "danger"
        ? { background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }
        : tone === "warning"
          ? { background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }
          : { background: "var(--bg-secondary)", color: "var(--text-muted)", borderColor: "var(--border-default)" };

  return (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium font-mono border" style={style}>
      {label}
    </span>
  );
}
