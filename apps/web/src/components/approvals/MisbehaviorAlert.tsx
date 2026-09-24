"use client";

import { AlertOctagon, RotateCcw, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MisbehaviorAlertProps {
  participantName: string;
  errorMessage: string;
  recoverable: boolean;
  onExcludeCulprit?: () => void;
  onViewTrace?: () => void;
}

export function MisbehaviorAlert({
  participantName,
  errorMessage,
  recoverable,
  onExcludeCulprit,
  onViewTrace,
}: MisbehaviorAlertProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-rose-500/[0.06] dark:bg-gradient-to-r dark:from-rose-950/40 dark:via-[#130b10] dark:to-[#0d0912] p-5 sm:p-6 shadow-lg shadow-rose-950/10">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Warning Icon */}
        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-500 dark:text-rose-400">
          <AlertOctagon className="w-5 h-5 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-mono">
              Culprit Identified
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              F4 Verification Failed
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-rose-800 dark:text-rose-200">
            Signature share from <span className="underline font-bold decoration-rose-500/50">{participantName}</span> was rejected
          </h3>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {errorMessage}
          </p>

          {/* Safety Guarantee */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Funds 100% Secure: The transaction was stopped instantly before any funds could move.</span>
          </div>

          {/* Remediation Action */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            {recoverable && (
              <Button
                variant="primary"
                size="sm"
                onClick={onExcludeCulprit}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Resume with Carol (Standby)
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onViewTrace}
              icon={<FileText className="w-3.5 h-3.5" />}
            >
              View Verification Proof
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
