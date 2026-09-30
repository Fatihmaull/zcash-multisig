"use client";

import { AlertOctagon, RotateCcw, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { f4RejectionMessage } from "@/lib/f4-message";

interface MisbehaviorAlertProps {
  participantName: string;
  recoverable: boolean;
  onExcludeCulprit?: () => void;
  onViewTrace?: () => void;
}

export function MisbehaviorAlert({
  participantName,
  recoverable,
  onExcludeCulprit,
  onViewTrace,
}: MisbehaviorAlertProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: "var(--danger-border)",
        background: "var(--danger-bg)",
      }}
    >
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          <AlertOctagon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded font-mono"
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger-text)",
              border: "1px solid var(--danger-border)",
            }}
          >
            Share rejected
          </span>

          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {f4RejectionMessage(participantName)}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            {recoverable && (
              <Button
                variant="primary"
                size="sm"
                onClick={onExcludeCulprit}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Resume with Carol (Simulated)
              </Button>
            )}

            {onViewTrace && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewTrace}
                icon={<FileText className="w-3.5 h-3.5" />}
              >
                View recorded events
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
