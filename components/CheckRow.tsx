"use client";

import { useState } from "react";
import { Check, Flame, Clock } from "lucide-react";
import { formatTimeDisplay } from "@/lib/date";

interface CheckRowProps {
  id: number;
  name: string;
  type: "checklist" | "diet";
  targetCount: number;
  currentCount: number;
  done: boolean;
  streak: number;
  reminderTime: string | null;
  onToggle: (id: number, nextCount: number) => Promise<void>;
}

export default function CheckRow({
  id,
  name,
  type,
  currentCount,
  done: initialDone,
  streak,
  reminderTime,
  onToggle,
}: CheckRowProps) {
  const [done, setDone] = useState(initialDone);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    const nextDone = !done;
    const nextCount = nextDone ? 1 : 0;
    // Optimistic update
    setDone(nextDone);
    setIsUpdating(true);
    try {
      await onToggle(id, nextCount);
    } catch {
      // Revert on failure
      setDone(!nextDone);
    } finally {
      setIsUpdating(false);
    }
  };

  const isChecklist = type === "checklist";
  const accentColor = isChecklist ? "#4FA3FF" : "#E4101E";

  return (
    <div
      onClick={handleToggle}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#111216] border transition-all duration-150 cursor-pointer select-none min-h-[56px] active:scale-[0.99] ${
        done
          ? "border-white/5 bg-[#111216]/60 opacity-85"
          : "border-white/10 hover:border-white/20 hover:bg-[#1A1C22]"
      }`}
    >
      {/* Left section accent strip */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-r transition-colors ${
          done ? "bg-white/20" : isChecklist ? "bg-[#4FA3FF]" : "bg-[#E4101E]"
        }`}
      />

      <div className="flex items-center gap-3.5 pl-2 overflow-hidden">
        {/* Large 28px M-styled Checkbox */}
        <button
          type="button"
          aria-label={name}
          className={`relative w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center transition-all duration-150 border shrink-0 ${
            done
              ? isChecklist
                ? "bg-[#4FA3FF] border-[#4FA3FF] shadow-[0_0_10px_rgba(79,163,255,0.4)]"
                : "bg-[#E4101E] border-[#E4101E] shadow-[0_0_10px_rgba(228,16,30,0.4)]"
              : "border-white/20 bg-[#1A1C22] group-hover:border-white/40"
          }`}
        >
          <div className="skew-x-6 flex items-center justify-center">
            {done && <Check className="w-4 h-4 text-white stroke-[3]" />}
          </div>
        </button>

        {/* Item Info */}
        <div className="truncate">
          <p
            className={`font-medium text-sm sm:text-base tracking-wide transition-all ${
              done ? "line-through text-[#8A92A3]" : "text-white"
            }`}
          >
            {name}
          </p>
          {reminderTime && (
            <div className="flex items-center gap-1 text-[11px] text-[#8A92A3] mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{formatTimeDisplay(reminderTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Streak Badge */}
      <div className="flex items-center gap-2 shrink-0">
        {streak > 0 && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-heading font-bold tracking-wider ${
              done
                ? "bg-[#E4101E]/20 text-[#E4101E] border border-[#E4101E]/30"
                : "bg-white/5 text-[#8A92A3] border border-white/10"
            }`}
            title={`${streak} day streak`}
          >
            <Flame className="w-3.5 h-3.5 text-[#E4101E] fill-[#E4101E]" />
            <span>{streak}d</span>
          </div>
        )}
      </div>
    </div>
  );
}

