"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck, PlusCircle, Check, Copy, ExternalLink, ArrowDownLeft } from "lucide-react";
import type { OnchainWalletBalance } from "@/lib/onchain-balance";
import { Button } from "@/components/ui/Button";

interface LiveBalanceCardProps {
  initialData?: OnchainWalletBalance;
}

const DEFAULT_WALLET_BALANCE: OnchainWalletBalance = {
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
  timestamp: 0,
};

export function LiveBalanceCard({ initialData }: LiveBalanceCardProps) {
  const [data, setData] = useState<OnchainWalletBalance>(
    initialData || DEFAULT_WALLET_BALANCE
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(data.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetOrTopup = async (action: "reset" | "topup") => {
    setIsResetting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount: 0.1, syncChain: true }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback(json.message);
        await handleRefresh();
      } else {
        setFeedback(json.error || "Gagal memperbarui saldo.");
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs relative overflow-hidden group flex flex-col justify-between">
        <div>
          {/* Header Row: Label & Refresh */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">Saldo Tersedia</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-subtle)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh On-Chain Balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </div>

          {/* Balance & Top Up Action Row */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
                {data.ironwood}
              </span>
              <span className="text-xs font-bold font-mono text-[var(--zcash-gold)]">TAZ</span>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Isi Saldo Dev Wallet / Top Up"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Isi Saldo</span>
            </button>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pool: <strong>{data.pool}</strong> (NU6.3)</span>
          </div>

          <div className="text-[var(--text-muted)] font-mono text-[10px]">
            Height #{data.height.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Modal / Dialog Isi Saldo & Panduan Dev Wallet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-primary)]">Isi Saldo Dev Wallet</h3>
                  <p className="text-xs text-[var(--text-muted)]">Kirim dana testnet ke alamat receiver dev wallet</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFeedback(null);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] text-sm font-semibold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Alamat Dev Wallet */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Alamat Receiver Unified Testnet (Ironwood):
              </label>
              <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[var(--text-primary)] break-all select-all leading-relaxed">
                  {data.address}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0 h-8 w-8 rounded-lg"
                  title="Salin Alamat"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Opsi 1: Reset / Pulihkan Saldo Dev */}
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Opsi Cepat: Pulihkan Saldo Penuh (0.1000 TAZ)
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    Mereset potongan dari transaksi broadcast sebelumnya dan men-sync ulang dev wallet.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleResetOrTopup("reset")}
                isLoading={isResetting}
                className="w-full text-xs font-semibold mt-1 rounded-xl"
              >
                Pulihkan Saldo Penuh Dev Wallet
              </Button>
            </div>

            {/* Opsi 2: Kirim Manual via CLI */}
            <div className="p-3.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl space-y-1.5 text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)] block">
                Opsi Manual (CLI zcash-devtool):
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                Jalankan perintah ini di terminal root untuk mengirim dari wallet lain:
              </p>
              <pre className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-[10px] overflow-x-auto text-emerald-600 dark:text-emerald-400">
                {`./tools/zcash-devtool/target/release/zcash-devtool wallet \\
  -w <WALLET_DIR> send \\
  -i <IDENTITY_FILE> \\
  --address "${data.address.substring(0, 25)}..." \\
  --value 10000000`}
              </pre>
            </div>

            {feedback && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium animate-fade-in">
                {feedback}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setIsModalOpen(false);
                  setFeedback(null);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
