"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NewProposalPage() {
  const router = useRouter();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amountZec, setAmountZec] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/approvals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAddress,
          amountZec,
          memo,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create spend proposal");
      }

      router.push(`/approvals/${data.approvalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating proposal");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Approvals
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Propose Shielded Spend
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Initiate an outgoing transfer from the threshold vault. Requires consensus from key holders before broadcast.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 sm:p-8 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-5"
      >
        {error && (
          <div
            className="p-3.5 rounded-xl border text-xs flex items-center gap-2"
            style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-text)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            Recipient Address (Zcash Unified Address / Shielded)
          </label>
          <textarea
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            rows={3}
            required
            placeholder="utest1..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--zcash-gold)] resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            Amount (TAZ)
          </label>
          <div className="relative">
            <input
              type="text"
              value={amountZec}
              onChange={(e) => setAmountZec(e.target.value)}
              required
              placeholder="0.05000000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--zcash-gold)]"
            />
            <span className="absolute right-3.5 top-2.5 text-xs font-bold text-[var(--zcash-gold)]">
              TAZ
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            A shielded balance is not shown here — it needs the vault&apos;s viewing key.
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            Spend Memo / Purpose
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. Infrastructure operational cost"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--zcash-gold)]"
          />
        </div>

        <div
          className="p-4 rounded-xl border text-xs space-y-1.5 text-[var(--text-secondary)]"
          style={{ borderColor: "var(--info-border)", background: "var(--info-bg)" }}
        >
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--info)" }}>
            <Shield className="w-3.5 h-3.5" />
            <span>Submitting does not collect a signature</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            The vault&apos;s own threshold applies. This form does not pre-sign for anyone.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          icon={<Send className="w-4 h-4" />}
        >
          Submit Spend Proposal
        </Button>
      </form>
    </div>
  );
}
