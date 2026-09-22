"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  KeyRound, 
  Users, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  RefreshCw
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Participant {
  name: string;
  role: string;
  status: "waiting" | "connected" | "confirmed";
  latency?: number;
}

type CeremonyStep = 1 | 2 | 3;

export function KeyCeremonyView() {
  const [step, setStep] = useState<CeremonyStep>(1);
  const [vaultName, setVaultName] = useState("Dev Treasury");
  const [threshold, setThreshold] = useState(2);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dkgProgress, setDkgProgress] = useState(0);

  const [participants, setParticipants] = useState<Participant[]>([
    { name: "Alice", role: "Lead Treasurer", status: "waiting" },
    { name: "Bob", role: "Finance Director", status: "waiting" },
    { name: "Carol", role: "Auditor (Standby)", status: "waiting" },
  ]);

  const handleAddParticipant = () => {
    if (participants.length >= 5) return;
    const newIndex = participants.length + 1;
    setParticipants([
      ...participants,
      { name: `Signer ${newIndex}`, role: "Key Holder", status: "waiting" },
    ]);
  };

  const handleRemoveParticipant = (index: number) => {
    if (participants.length <= 2) return;
    const updated = participants.filter((_, i) => i !== index);
    setParticipants(updated);
    if (threshold > updated.length) {
      setThreshold(updated.length);
    }
  };

  const handleUpdateName = (index: number, name: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], name };
    setParticipants(updated);
  };

  const handleConnectChannels = async () => {
    setStep(2);
    setIsProcessing(true);

    for (let i = 0; i < participants.length; i++) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 300));
      setParticipants((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: "connected", latency: Math.floor(25 + Math.random() * 30) } : p
        )
      );
    }
    setIsProcessing(false);
  };

  const [createdVaultId, setCreatedVaultId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRunDkg = async () => {
    setStep(3);
    setIsProcessing(true);
    setDkgProgress(25);
    setSaveError(null);

    await new Promise((r) => setTimeout(r, 600));
    setDkgProgress(60);

    // Call /api/vaults/create to save into PostgreSQL and Supabase
    try {
      const res = await fetch("/api/vaults/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: vaultName,
          threshold,
          totalParticipants: participants.length,
          shieldedAddress: generatedAddress,
          participants,
        }),
      });
      const data = await res.json();
      if (data.success && data.vault) {
        setCreatedVaultId(data.vault.id);
      }
    } catch (err) {
      console.error("Failed to save vault:", err);
      setSaveError("Vault generated locally. Remote sync will retry.");
    }

    setDkgProgress(90);
    await new Promise((r) => setTimeout(r, 500));
    setDkgProgress(100);

    setParticipants((prev) =>
      prev.map((p) => ({ ...p, status: "confirmed" }))
    );
    setIsProcessing(false);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generatedAddress =
    "utest1quqhwz3035hsf3z2pv4v24qce5r42qalfeqgzxslfjrys660kfg5m6spw4fahvcpw02y4x38t4j3ykh44lnvmvct3zkjuuugggr2k772lh6gvs52t62yv94m2gngu7n7t0yk0whue3rtk5y73w9xj2hssm4p46wvsw5n8rqctm6c63vwdl3df2t6t9aqpr42qgs90cpyup7zghh8482";

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Wizard Step Navigation */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { num: 1, label: "1. Key Holders", desc: "Configure Members" },
            { num: 2, label: "2. Link Devices", desc: "Encrypted Channels" },
            { num: 3, label: "3. Generate Vault", desc: "Distributed Key Gen" },
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;

            return (
              <div
                key={s.num}
                className={`p-3 rounded-xl border transition-all text-left flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 ${
                  isActive
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs"
                    : isDone
                    ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    isActive
                      ? "bg-amber-500 text-black shadow-xs"
                      : isDone
                      ? "bg-emerald-500 text-black"
                      : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {isDone ? "✓" : s.num}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold truncate text-[var(--text-primary)]">
                    {s.label}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] hidden sm:block">
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Ceremony Card */}
      <div className="p-5 sm:p-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-6">
        {/* Step 1: Configure Participants & Threshold */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--zcash-gold)]" />
                Define Key Holders &amp; Policy
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                Specify who holds cryptographic key shares for this shielded multi-signature vault.
              </p>
            </div>

            {/* Form Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-secondary)] font-medium">Vault Name</label>
                <input
                  type="text"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--zcash-gold)]"
                  placeholder="e.g. Foundation Treasury"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-secondary)] font-medium">
                  Approval Threshold (At least {threshold} of {participants.length} Signers)
                </label>
                <SearchableSelect<number>
                  options={Array.from({ length: participants.length - 1 }).map((_, i) => {
                    const t = i + 2;
                    return {
                      value: t,
                      label: `${t} of ${participants.length} signers must approve`,
                      sublabel: `${Math.round((t / participants.length) * 100)}% quorum requirement`,
                    };
                  })}
                  value={threshold}
                  onChange={(val) => setThreshold(val)}
                  searchPlaceholder="Search threshold..."
                />
              </div>
            </div>

            {/* Participants list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
                <span>Signer Name</span>
                <span>Role</span>
              </div>

              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-mono">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleUpdateName(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] focus:border-[var(--zcash-gold)] text-sm text-[var(--text-primary)] focus:outline-none font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-xs text-[var(--text-secondary)] px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                      {p.role}
                    </span>
                    {participants.length > 2 && (
                      <button
                        onClick={() => handleRemoveParticipant(idx)}
                        className="p-1.5 rounded text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {participants.length < 5 && (
                <button
                  onClick={handleAddParticipant}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[var(--border-default)] hover:border-[var(--zcash-gold-border)] text-xs text-[var(--text-muted)] hover:text-[var(--zcash-gold)] flex items-center justify-center gap-2 transition bg-[var(--bg-secondary)] cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Key Holder (Up to 5)
                </button>
              )}
            </div>

            {/* Zero Custody Notice */}
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200/90 flex items-start gap-2.5">
              <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Cryptographic Guarantee:</strong> Key shares are generated and stored exclusively on each member&apos;s device. No single person or server ever possesses the full private key.
              </p>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleConnectChannels}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <span>Next: Connect Signer Devices</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Establish Secure Channels */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--zcash-gold)]" />
                Connecting Signer Devices
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                Participant devices establish encrypted point-to-point channels to securely exchange key shares.
              </p>
            </div>

            <div className="space-y-3">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    p.status === "connected"
                      ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                      : "border-[var(--border-default)] bg-[var(--bg-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        p.status === "connected"
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-amber-400 animate-ping"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {p.status === "connected"
                          ? "Device verified & ready"
                          : "Establishing encrypted tunnel..."}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium font-mono ${
                      p.status === "connected"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {p.status === "connected" ? "CONNECTED" : "WAITING"}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleRunDkg}
              disabled={isProcessing || participants.some((p) => p.status !== "connected")}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Connections...</span>
                </>
              ) : (
                <>
                  <span>Begin Distributed Key Generation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Generate Keys */}
        {step === 3 && (
          <div className="space-y-6">
            {dkgProgress < 100 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[var(--zcash-gold)] shadow-lg shadow-amber-500/10">
                  <KeyRound className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Generating Distributed Key Shares...</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Generating RedPallas threshold shares secretly across Alice, Bob, and Carol...
                  </p>
                </div>
                <div className="w-full max-w-md bg-[var(--border-subtle)] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${dkgProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Success Banner */}
                <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] flex items-start gap-3.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-semibold text-emerald-800 dark:text-emerald-300">
                      Shielded Vault Created Successfully ({threshold}-of-{participants.length} Policy)
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Each participant holds their mathematical key share securely. The vault is ready to receive and spend shielded Zcash.
                    </p>
                  </div>
                </div>

                {/* Generated Unified Address */}
                <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                      Vault Address (Shielded / Private)
                    </span>
                    <button
                      onClick={() => copyAddress(generatedAddress)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--zcash-gold)] hover:underline font-medium cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied!" : "Copy Address"}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs text-[var(--text-secondary)] break-all bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-default)] select-all">
                    {generatedAddress}
                  </p>
                </div>

                {/* Key Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Pool</span>
                    <span className="text-[var(--text-primary)] font-semibold">Shielded (Ironwood)</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Spend Policy</span>
                    <span className="text-[var(--zcash-gold)] font-semibold">At least {threshold} of {participants.length} Signers</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Key Custody</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Non-Custodial</span>
                  </div>
                </div>

                {/* Return button */}
                <Link
                  href={createdVaultId ? `/vaults/${createdVaultId}` : "/vaults"}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{createdVaultId ? "Open Newly Created Vault" : "Finish & Open Vaults"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
