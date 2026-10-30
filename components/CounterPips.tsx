"use client";

import { useState } from "react";
import { Plus, Minus, Flame, Check, Apple } from "lucide-react";

interface CounterPipsProps {
  id: number;
  name: string;
  targetCount: number;
  initialCount: number;
  streak: number;
  onUpdate: (id: number, count: number) => Promise<void>;
}

export default function CounterPips({
  id,
  name,
  targetCount,
  initialCount,
  streak,
  onUpdate,
}: CounterPipsProps) {
  const [count, setCount] = useState(initialCount);
  const [isUpdating, setIsUpdating] = useState(false);

  const isComplete = count >= targetCount;

  const handleSetCount = async (newCount: number) => {
    const clamped = Math.max(0, Math.min(newCount, targetCount));
    if (clamped === count) return;

    const prev = count;
    setCount(clamped);
    setIsUpdating(true);
    try {
      await onUpdate(id, clamped);
    } catch {
      setCount(prev);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePipClick = (index: number) => {
    // If clicking on current count, toggle down by 1; otherwise set to index + 1
    if (count === index + 1) {
      handleSetCount(index);
    } else {
      handleSetCount(index + 1);
    }
  };

  return (
    <div
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#111216] border transition-all duration-150 select-none min-h-[56px] gap-3 ${
        isComplete
          ? "border-white/5 bg-[#111216]/60 opacity-85"
          : "border-white/10 hover:border-white/20 hover:bg-[#1A1C22]"
      }`}
    >
      {/* Left section accent strip */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-r transition-colors ${
          isComplete ? "bg-white/20" : "bg-[#E4101E]"
        }`}
      />

      {/* Header and Streak */}
      <div className="flex items-center justify-between sm:justify-start gap-3 pl-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center border shrink-0 transition-colors ${
              isComplete
                ? "bg-[#E4101E] border-[#E4101E] shadow-[0_0_10px_rgba(228,16,30,0.4)]"
                : "border-white/20 bg-[#1A1C22]"
            }`}
          >
            <div className="skew-x-6 flex items-center justify-center text-xs font-bold text-white">
              {isComplete ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                <Apple className="w-3.5 h-3.5 text-[#E4101E]" />
              )}
            </div>
          </div>
          <div>
            <p
              className={`font-medium text-sm sm:text-base tracking-wide transition-all ${
                isComplete ? "line-through text-[#8A92A3]" : "text-white"
              }`}
            >
              {name}
            </p>
            <p className="text-[11px] text-[#8A92A3]">
              Target: {count}/{targetCount} portions
            </p>
          </div>
        </div>

        {streak > 0 && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-heading font-bold tracking-wider sm:hidden ${
              isComplete
                ? "bg-[#E4101E]/20 text-[#E4101E] border border-[#E4101E]/30"
                : "bg-white/5 text-[#8A92A3] border border-white/10"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#E4101E] fill-[#E4101E]" />
            <span>{streak}d</span>
          </div>
        )}
      </div>

      {/* Counter Controls: Tappable Pips & Stepper */}
      <div className="flex items-center justify-end gap-2.5 pl-2 sm:pl-0">
        {/* Pips */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: targetCount }).map((_, index) => {
            const isFilled = index < count;
            return (
              <button
                key={index}
                type="button"
                onClick={() => handlePipClick(index)}
                aria-label={`${name} portion ${index + 1}`}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg -skew-x-6 flex items-center justify-center transition-all cursor-pointer min-w-[28px] min-h-[28px] ${
                  isFilled
                    ? "bg-[#E4101E] text-white shadow-[0_0_8px_rgba(228,16,30,0.5)] border border-[#E4101E]"
                    : "bg-[#1A1C22] text-[#8A92A3] border border-white/10 hover:border-white/30"
                }`}
              >
                <span className="skew-x-6 text-xs font-heading font-bold">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stepper buttons (+ / -) */}
        <div className="flex items-center bg-[#1A1C22] border border-white/10 rounded-lg overflow-hidden ml-1">
          <button
            type="button"
            onClick={() => handleSetCount(count - 1)}
            disabled={count <= 0}
            className="w-8 h-8 flex items-center justify-center text-[#8A92A3] hover:text-white disabled:opacity-20 active:bg-white/10 transition-colors"
            aria-label="Decrease count"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-xs font-heading font-bold text-white min-w-[20px] text-center">
            {count}
          </span>
          <button
            type="button"
            onClick={() => handleSetCount(count + 1)}
            disabled={count >= targetCount}
            className="w-8 h-8 flex items-center justify-center text-[#8A92A3] hover:text-white disabled:opacity-20 active:bg-white/10 transition-colors"
            aria-label="Increase count"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop Streak Badge */}
        {streak > 0 && (
          <div
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-heading font-bold tracking-wider shrink-0 ${
              isComplete
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

