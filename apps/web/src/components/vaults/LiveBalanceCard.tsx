"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { OnchainWalletBalance } from "@/lib/onchain-balance";

interface LiveBalanceCardProps {
  initialData?: OnchainWalletBalance | null;
  /** When set, a refresh is shown only if the wallet address is still this vault's. */
  vaultAddress?: string | null;
}

export function LiveBalanceCard({ initialData, vaultAddress }: LiveBalanceCardProps) {
  const [data, setData] = useState<OnchainWalletBalance | null>(initialData ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addressMismatch, setAddressMismatch] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/wallet/balance?refresh=true");
      const json = await res.json();
      if (json.success) {
        const next = (json.data ?? null) as OnchainWalletBalance | null;
        if (vaultAddress && next && next.address !== vaultAddress) {
          setData(null);
          setAddressMismatch(true);
        } else {
          setData(next);
          setAddressMismatch(false);
        }
      }
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium">Shielded Balance</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-subtle)] cursor-pointer disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
            {data?.ironwood ?? "—"}
          </span>
          {data?.ironwood && (
            <span className="text-xs font-bold font-mono text-[var(--zcash-gold)]">TAZ</span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
        {data ? (
          <span>
            {data.pool}
            {data.height != null ? ` · height ${data.height.toLocaleString("en-US")}` : ""}
          </span>
        ) : addressMismatch ? (
          <span>This wallet address is not this vault&apos;s address, so its balance is not shown.</span>
        ) : (
          <span>No viewing-key reading on this machine.</span>
        )}
      </div>
    </div>
  );
}
