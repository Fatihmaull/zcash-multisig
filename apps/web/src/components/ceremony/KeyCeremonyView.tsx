"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Lock,
  ShieldCheck,
  ArrowRight,
  Plus,
  Trash2,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Button } from "@/components/ui/Button";

interface Participant {
  name: string;
  role: string;
}

type CeremonyStep = 1 | 2 | 3;

interface KeyCeremonyViewProps {
  vaultId?: string;
}

export function KeyCeremonyView({ vaultId }: KeyCeremonyViewProps = {}) {
  const [step, setStep] = useState<CeremonyStep>(1);
  const [vaultName, setVaultName] = useState("Dev Treasury");
  const [threshold, setThreshold] = useState(2);
  const [isSaving, setIsSaving] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([
    { name: "Alice", role: "Lead Treasurer" },
    { name: "Bob", role: "Finance Director" },
    { name: "Carol", role: "Auditor (Standby)" },
  ]);

  // If vaultId is provided, load existing vault from DB
  useEffect(() => {
    if (!vaultId) return;

    fetch(`/api/vaults/${vaultId}/ceremony`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.vault) {
          const v = data.vault;
          setVaultName(v.label);
          setThreshold(v.threshold);
          if (v.participants && v.participants.length > 0) {
            setParticipants(
              v.participants.map((p: { label: string }) => ({
                name: p.label.split(" (")[0] || p.label,
                role: p.label.includes("(") ? p.label.split("(")[1].replace(")", "") : "Key Holder",
              }))
            );
          }
        }
      })
      .catch((err) => console.error("Failed to load vault for ceremony:", err));
  }, [vaultId]);

  const handleAddParticipant = () => {
    if (participants.length >= 5) return;
    const newIndex = participants.length + 1;
    setParticipants([
      ...participants,
      { name: `Signer ${newIndex}`, role: "Key Holder" },
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

  const handleConnectChannels = () => {
    setStep(2);
  };

  const [createdVaultId, setCreatedVaultId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRunDkg = async () => {
    setStep(3);
    setIsSaving(true);
    setSaveError(null);

    // This page does not run DKG and does not write an address.
    // A new vault record, if saved, stays PENDING_DKG with no address.
    if (!vaultId) {
      try {
        const res = await fetch("/api/vaults/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: vaultName,
            threshold,
            totalParticipants: participants.length,
            participants,
          }),
        });
        const data = await res.json();
        if (data.success && data.vault) {
          setCreatedVaultId(data.vault.id);
        } else {
          setSaveError(data.error || "The vault record was not saved.");
        }
      } catch (err) {
        console.error("Failed to save vault:", err);
        setSaveError("The vault record was not saved.");
      }
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Wizard Step Navigation */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { num: 1, label: "1. Key Holders", desc: "Configure Members" },
            { num: 2, label: "2. Link Devices", desc: "Not run here" },
            { num: 3, label: "3. Ceremony", desc: "Runs outside this page" },
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;

            return (
              <div
                key={s.num}
                className="p-3 rounded-xl border text-left flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3.5"
                style={
                  isActive
                    ? { background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }
                    : isDone
                      ? { background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }
                      : { background: "var(--bg-secondary)", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }
                }
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                  style={
                    isActive
                      ? { background: "var(--warning)", color: "var(--bg-primary)" }
                      : isDone
                        ? { background: "var(--success)", color: "var(--bg-primary)" }
                        : { background: "var(--border-subtle)", color: "var(--text-muted)" }
                  }
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
                        className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {participants.length < 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={handleAddParticipant}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Key Holder (Up to 5)
                </Button>
              )}
            </div>

            {/* Zero Custody Notice */}
            <div
              className="p-4 rounded-xl border text-xs flex items-start gap-2.5 text-[var(--text-secondary)]"
              style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}
            >
              <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
              <p className="leading-relaxed">
                <strong>Simulated.</strong> This page records who the holders would be. It does not generate key shares, and a share never belongs in the browser.
              </p>
            </div>

            {/* Continue Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleConnectChannels}
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Next: Connect Signer Devices
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--zcash-gold)]" />
                Signer devices are not linked here
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                <span
                  className="mr-2 px-2 py-0.5 rounded text-[10px] font-mono font-medium border"
                  style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }}
                >
                  Simulated
                </span>
                DKG needs authenticated and confidential channels between the participant processes. This page does not open them, and it does not mark anyone connected.
              </p>
            </div>

            <div className="space-y-3">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{p.role}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium font-mono text-[var(--text-muted)] border border-[var(--border-default)]">
                    Not linked
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleRunDkg}
              isLoading={isSaving}
              iconRight={!isSaving ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div
              className="p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5"
              style={{ borderColor: "var(--info-border)", background: "var(--info-bg)" }}
            >
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                  This page does not run the ceremony
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  No shielded address was generated, and none was written. The ceremony is{" "}
                  <span className="font-mono">three-party-ceremony.sh</span> — three processes, one share each.
                  {createdVaultId
                    ? " A vault record was saved as pending, with no address."
                    : " The vault stays as it is."}
                </p>
                {saveError && (
                  <p className="text-xs font-mono mt-1" style={{ color: "var(--danger-text)" }}>
                    {saveError}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Pool</span>
                <span className="text-[var(--text-primary)] font-semibold">Shielded (Ironwood)</span>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Spend Policy</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  At least {threshold} of {participants.length} signers
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Key Custody</span>
                <span className="font-semibold" style={{ color: "var(--success-text)" }}>Non-custodial</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] space-y-1">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                Vault address
              </span>
              <p className="text-xs text-[var(--text-secondary)]">
                Not recorded. This wizard does not invent one.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              href={vaultId ? `/vaults/${vaultId}` : createdVaultId ? `/vaults/${createdVaultId}` : "/vaults"}
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              {createdVaultId ? "Open vault record" : "Back to vaults"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
