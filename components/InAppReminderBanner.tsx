"use client";

import { useEffect, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import Link from "next/link";

interface DueNotice {
  id: string;
  title: string;
  time?: string;
  type: "weekly" | "future" | "item";
}

export default function InAppReminderBanner({ notices = [] }: { notices?: DueNotice[] }) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const activeNotices = notices.filter((n) => !dismissed[n.id]);

  if (activeNotices.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mb-4 space-y-2">
      {activeNotices.map((notice) => (
        <div
          key={notice.id}
          className="relative flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1A1C22] border-l-4 border-l-[#E4101E] border-y border-r border-white/10 shadow-lg text-sm animate-fade-in"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-[#E4101E]/20 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-[#E4101E]" />
            </div>
            <div className="truncate">
              <p className="font-medium text-white text-xs sm:text-sm truncate">
                {notice.title}
              </p>
              {notice.time && (
                <p className="text-[11px] text-[#8A92A3]">
                  Scheduled for {notice.time}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={notice.type === "item" ? "/today" : "/upcoming"}
              className="px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider font-semibold bg-[#4FA3FF]/20 text-[#4FA3FF] hover:bg-[#4FA3FF]/30 rounded-lg transition-colors"
            >
              View
            </Link>
            <button
              onClick={() => setDismissed((prev) => ({ ...prev, [notice.id]: true }))}
              className="p-1 text-[#8A92A3] hover:text-white rounded-lg transition-colors"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

