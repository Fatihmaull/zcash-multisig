"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Shield, 
  ArrowLeft, 
  Copy, 
  Check, 
  CheckCircle2, 
  Sparkles
} from "lucide-react";
import { QuorumIndicator } from "./QuorumIndicator";
import { MisbehaviorAlert } from "./MisbehaviorAlert";
import { useUI } from "@/context/UIContext";

interface ApprovalDetailViewProps {
  requestId?: string;
  showMisbehavior?: boolean;
}

export function ApprovalDetailView({
  requestId = "req-demo-001",
  showMisbehavior: propShowMisbehavior,
}: ApprovalDetailViewProps) {
  const { activeScenario, setActiveScenario } = useUI();
  
  // Interactive state
  const isMalicious = propShowMisbehavior ?? (activeScenario === "malicious_share");
  const isTimeout = activeScenario === "non_responding";

  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [bobSigned, setBobSigned] = useState(false);
  const [carolSigned, setCarolSigned] = useState(false);
  const [excludedCulprit, setExcludedCulprit] = useState(false);
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null);

  // Compute quorum counts
  let collectedSignatures = 1; // Alice signed
  if (bobSigned && !isMalicious) collectedSignatures++;
  if (carolSigned) collectedSignatures++;
  const threshold = 2;
  const isQuorumMet = collectedSignatures >= threshold;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateBobSigning = async () => {
    setIsSigning(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSigning(false);
    setBobSigned(true);
    if (!isMalicious) {
      setBroadcastTxid("4a7f92b8812c85e33d45f92160d5c8290f91a27b876e5117462fa112d8a4e320");
    }
  };

  const handleSimulateCarolSigning = async () => {
    setIsSigning(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSigning(false);
    setCarolSigned(true);
    setBroadcastTxid("8b1e42a9923d74f22e34a81050c4b7180e80b16a765d4006351eb001c7b3d219");
  };

  const handleExcludeCulprit = () => {
    setExcludedCulprit(true);
    setActiveScenario("happy_path");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Back link & Top Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Approvals
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              2.50000000 <span className="text-[var(--zcash-gold)] text-lg sm:text-xl font-normal">TAZ</span>
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${
              broadcastTxid 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : isMalicious && !excludedCulprit
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            }`}>
              {broadcastTxid 
                ? "TRANSACTION BROADCAST" 
                : isMalicious && !excludedCulprit
                ? "SHARE REJECTED" 
                : "AWAITING 1 SIGNATURE"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Purpose: &ldquo;Security audit fee &amp; protocol code review&rdquo;
          </p>
        </div>

        <div className="text-left sm:text-right text-xs text-[var(--text-muted)]">
          <div>Proposal ID</div>
          <div className="text-[var(--text-primary)] font-mono font-medium">{requestId}</div>
        </div>
      </div>

      {/* Misbehavior Alert Banner */}
      {isMalicious && !excludedCulprit && (
        <MisbehaviorAlert
          participantName="Bob"
          errorMessage="Bob's device submitted an invalid signature share that failed mathematical verification against the vault's group public key. The threshold signing protocol safely aborted to protect treasury funds."
          recoverable={true}
          onExcludeCulprit={handleExcludeCulprit}
        />
      )}

      {/* Broadcast Success Banner */}
      {broadcastTxid && (
        <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-[#0a1712] dark:to-[#080b11] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Threshold Reached (2-of-2) — Shielded Transaction Broadcast!</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono break-all">
              Broadcast TxID: {broadcastTxid}
            </p>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0 font-medium font-mono">
            Confirmed on Testnet
          </span>
        </div>
      )}

      {/* Main Grid: Details + Quorum */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Signers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spend Parameters */}
          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--zcash-gold)]" />
              Spend Proposal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)]">Source Vault</span>
                <p className="text-[var(--text-primary)] font-semibold text-sm">Dev Treasury</p>
                <span className="text-[11px] text-[var(--zcash-gold)] font-medium">2-of-3 Threshold Policy</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)]">Transfer Amount</span>
                <p className="text-[var(--text-primary)] font-semibold text-sm font-mono">2.50000000 TAZ</p>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Balance verified in vault</span>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] font-medium">Recipient Address (Shielded / Private)</span>
                <button
                  onClick={() => copyToClipboard("utest1z67w88a9c8e104f7623d9b4009e817a02c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c")}
                  className="inline-flex items-center gap-1 text-xs text-[var(--zcash-gold)] hover:underline transition font-medium cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Address"}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-[var(--text-secondary)] break-all bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-default)] select-all">
                utest1z67w88a9c8e104f7623d9b4009e817a02c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c
              </p>
            </div>
          </div>

          {/* Participant Signatures */}
          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                Signer Approvals ({collectedSignatures} of {threshold} Collected)
              </h2>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Signing Round 2
              </span>
            </div>

            <div className="space-y-3">
              {/* Alice */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Alice (Lead Signer)</div>
                    <div className="text-xs text-[var(--text-muted)]">Signed from Hardware Key #1</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  APPROVED
                </span>
              </div>

              {/* Bob */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                bobSigned && !isMalicious
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : isMalicious && !excludedCulprit
                  ? "border-rose-500/30 bg-rose-500/[0.05]"
                  : isTimeout
                  ? "border-amber-500/30 bg-amber-500/[0.04]"
                  : "border-[var(--border-default)] bg-[var(--bg-secondary)]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    bobSigned && !isMalicious
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : isMalicious && !excludedCulprit
                      ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}>
                    {bobSigned && !isMalicious ? "✓" : isMalicious && !excludedCulprit ? "✕" : "B"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Bob (Co-Signer)</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {bobSigned && !isMalicious
                        ? "Valid signature share verified"
                        : isMalicious && !excludedCulprit
                        ? "Corrupted share rejected by F4 verifier"
                        : isTimeout
                        ? "Device unresponsive / timeout"
                        : "Awaiting approval signature"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!bobSigned && !isMalicious && !isTimeout && (
                    <button
                      onClick={handleSimulateBobSigning}
                      disabled={isSigning}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSigning ? "Signing..." : "Sign as Bob"}
                    </button>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                    bobSigned && !isMalicious
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : isMalicious && !excludedCulprit
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}>
                    {bobSigned && !isMalicious 
                      ? "APPROVED" 
                      : isMalicious && !excludedCulprit 
                      ? "REJECTED" 
                      : isTimeout 
                      ? "OFFLINE" 
                      : "PENDING"}
                  </span>
                </div>
              </div>

              {/* Carol */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                carolSigned
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-[var(--border-default)] bg-[var(--bg-secondary)]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    carolSigned ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}>
                    {carolSigned ? "✓" : "C"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Carol (Standby Signer)</div>
                    <div className="text-xs text-[var(--text-muted)]">Available to complete threshold if needed</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(excludedCulprit || isTimeout) && !carolSigned && (
                    <button
                      onClick={handleSimulateCarolSigning}
                      disabled={isSigning}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSigning ? "Signing..." : "Sign as Carol"}
                    </button>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                    carolSigned 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-[var(--border-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]"
                  }`}>
                    {carolSigned ? "APPROVED" : "STANDBY"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Status Quorum */}
        <div className="space-y-6">
          {/* Quorum Indicator Card */}
          <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col items-center justify-center text-center space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Approval Quorum
            </h3>

            <div className="py-2">
              <QuorumIndicator
                collected={collectedSignatures}
                required={threshold}
                total={3}
                size={150}
              />
            </div>

            <div className="w-full pt-4 border-t border-[var(--border-subtle)] space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Required Quorum:</span>
                <span className="text-[var(--text-primary)] font-medium">2 of 3 Signers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Current Status:</span>
                <span className={isQuorumMet ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-medium"}>
                  {isQuorumMet ? "Threshold Reached" : "1 More Needed"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Scenarios Card */}
          <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>Interactive Edge-Case Sandbox</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Test how Quorum guarantees zero funds loss across all real-world conditions:
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setActiveScenario("happy_path");
                  setExcludedCulprit(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition border cursor-pointer ${
                  activeScenario === "happy_path" && !isMalicious
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold"
                    : "bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                1. Normal Flow (Bob signs smoothly)
              </button>
              <button
                onClick={() => {
                  setActiveScenario("non_responding");
                  setExcludedCulprit(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition border cursor-pointer ${
                  activeScenario === "non_responding"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold"
                    : "bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                2. Bob Unreachable (Switch to Carol)
              </button>
              <button
                onClick={() => {
                  setActiveScenario("malicious_share");
                  setExcludedCulprit(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition border cursor-pointer ${
                  activeScenario === "malicious_share" && !excludedCulprit
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300 font-semibold"
                    : "bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                3. Corrupt Share (F4 Culprit Detection)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
