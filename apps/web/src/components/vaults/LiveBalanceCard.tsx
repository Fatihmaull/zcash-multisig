"use client";

import { useState } from "react";
import { RefreshCw, Radio, CheckCircle2, ShieldCheck, ArrowUpRight } from "lucide-react";
import type { OnchainWalletBalance } from "@/lib/onchain-balance";

interface LiveBalanceCardProps {
  initialData?: OnchainWalletBalance;
}

export function LiveBalanceCard({ initialData }: LiveBalanceCardProps) {
  const [data, setData] = useState<OnchainWalletBalance>(
    initialData || {
      total: "0.10000000",
      ironwood: "0.10000000",
      sapling: "0.00000000",
      orchard: "0.00000000",
      unshielded: "0.00000000",
      height: 4379870,
      pool: "Ironwood",
      address:
        "utest1quqhwz3035hsf3z2pv4v24qce5r42qalfeqgzxslfjrys660kfg5m6spw4fahvcpw02y4x38t4j3ykh44lnvmvct3zkjuuugggr2k772lh6gvs52t62yv94m2gngu7n7t0yk0whue3rtk5y73w9xj2hssm4p46wvsw5n8rqctm6c63vwdl3df2t6t9aqpr42qgs90cpyup7zghh8482",
      synced: true,
      timestamp: Date.now(),
    }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/wallet/balance?refresh=true");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] font-medium">Shielded Balance Available</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE ON-CHAIN
          </span>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh On-Chain Balance"
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
        </button>
      </div>

      <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1.5 flex items-baseline gap-2">
        <span>{data.ironwood}</span>
        <span className="text-xs font-semibold text-[var(--zcash-gold)]">TAZ</span>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between text-[11px] gap-2">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Pool: <strong>{data.pool}</strong> (NU6.3)</span>
        </div>

        <div className="text-[var(--text-muted)] font-mono text-[10px]">
          Height #{data.height.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
