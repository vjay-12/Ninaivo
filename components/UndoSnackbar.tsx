"use client";

import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";

export interface UndoNotice {
  id: string;
  message: string;
  onUndo: () => void;
  durationMs?: number;
}

let activeListener: ((notice: UndoNotice | null) => void) | null = null;

export function triggerUndoSnackbar(notice: Omit<UndoNotice, "id">) {
  if (activeListener) {
    activeListener({
      id: String(Date.now()),
      durationMs: notice.durationMs ?? 5000,
      ...notice,
    });
  }
}

export default function UndoSnackbar() {
  const [currentNotice, setCurrentNotice] = useState<UndoNotice | null>(null);

  useEffect(() => {
    activeListener = (notice) => {
      setCurrentNotice(notice);
    };
    return () => {
      activeListener = null;
    };
  }, []);

  useEffect(() => {
    if (!currentNotice) return;
    const timer = setTimeout(() => {
      setCurrentNotice(null);
    }, currentNotice.durationMs || 5000);

    return () => clearTimeout(timer);
  }, [currentNotice]);

  if (!currentNotice) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#14151B] border border-white/15 shadow-2xl text-white">
        <span className="text-xs font-medium text-white/90">{currentNotice.message}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              currentNotice.onUndo();
              setCurrentNotice(null);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4FA3FF] text-[#08080A] font-semibold text-xs hover:bg-[#3fa0ff] active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 stroke-[2.5]" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentNotice(null)}
            className="p-1 text-[#8A92A3] hover:text-white rounded-md cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

