"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles, Shield, AlertCircle } from "lucide-react";

export default function NewProposalPage() {
  const router = useRouter();
  const [recipientAddress, setRecipientAddress] = useState(
    "utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6"
  );
  const [amountZec, setAmountZec] = useState("0.05000000");
  const [memo, setMemo] = useState("Developer grant disbursement & security review");
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
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
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
          <span className="text-[11px] text-[var(--text-muted)]">Available shielded balance: 0.10000000 TAZ (Ironwood)</span>
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

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs space-y-1.5 text-[var(--text-secondary)]">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--zcash-gold)]">
            <Shield className="w-3.5 h-3.5" />
            <span>Threshold Policy: 2-of-3 Required</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            By creating this proposal, Alice automatically pre-signs Round 1 &amp; Round 2. The proposal will sync directly to Supabase and await co-signer approval.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? (
            <span>Submitting to Supabase...</span>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Spend Proposal</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
