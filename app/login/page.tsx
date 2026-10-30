"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import { ShieldCheck, KeyRound, AlertCircle, ArrowRight, Delete } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleKeyPress = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError("Please enter your PIN");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("pin", pin);
      const res = await loginAction(null, formData);
      if (res?.error) {
        setError(res.error);
        setPin("");
      }
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="relative bg-[#111216] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
          {/* Top M-stripe accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 m-stripe-horizontal" />

          {/* Header */}
          <div className="text-center mb-6 pt-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1A1C22] border border-white/10 mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-[#4FA3FF]" />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-wider uppercase text-white">
              M ROUTINE
            </h1>
            <p className="text-xs text-[#8A92A3] mt-1 tracking-wide">
              DAILY PERFORMANCE &amp; DISCIPLINE TRACKER
            </p>
          </div>

          {/* PIN Dots Display */}
          <div className="flex justify-center items-center gap-3 my-6 py-2 bg-[#08080A]/80 border border-white/5 rounded-xl">
            {[0, 1, 2, 3].map((index) => {
              const filled = pin.length > index;
              return (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    filled
                      ? "bg-[#4FA3FF] shadow-[0_0_8px_#4FA3FF]"
                      : "bg-[#232630] border border-white/10"
                  }`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#E4101E]/10 border border-[#E4101E]/30 text-[#E4101E] text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Hidden form for accessibility / enter key */}
          <form onSubmit={handleSubmit} className="mb-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              className="sr-only"
              autoFocus
              id="pin-input"
            />
          </form>

          {/* Numeric Keypad for Mobile / Quick entry */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={isPending}
                className="h-13 py-3 rounded-xl bg-[#1A1C22] hover:bg-[#232630] active:scale-95 border border-white/5 text-lg font-heading font-semibold text-white transition-all select-none min-h-[48px]"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending || pin.length === 0}
              className="h-13 py-3 rounded-xl bg-[#1A1C22]/60 hover:bg-[#1A1C22] active:scale-95 border border-white/5 text-xs font-semibold text-[#8A92A3] transition-all select-none min-h-[48px] uppercase tracking-wider disabled:opacity-30"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress("0")}
              disabled={isPending}
              className="h-13 py-3 rounded-xl bg-[#1A1C22] hover:bg-[#232630] active:scale-95 border border-white/5 text-lg font-heading font-semibold text-white transition-all select-none min-h-[48px]"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending || pin.length === 0}
              className="h-13 py-3 rounded-xl bg-[#1A1C22]/60 hover:bg-[#1A1C22] active:scale-95 border border-white/5 flex items-center justify-center text-[#8A92A3] transition-all select-none min-h-[48px] disabled:opacity-30"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Unlock Action Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPending || pin.length === 0}
            className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4FA3FF] via-[#0B3A82] to-[#E4101E] text-white font-heading font-bold text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#0B3A82]/30 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Unlock Tracker</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-[#8A92A3]/70 mt-4">
            Default PIN: <code className="text-white/80 bg-white/5 px-1.5 py-0.5 rounded">1234</code> (Configured in .env)
          </p>
        </div>
      </div>
    </main>
  );
}

