"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  ListTodo,
  CalendarDays,
  Clock,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

const navItems = [
  { href: "/today", label: "Today", icon: CalendarCheck2 },
  { href: "/daily", label: "Daily", icon: ListTodo },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/future", label: "Future", icon: Clock },
  { href: "/report", label: "Report", icon: BarChart3 },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#08080A]/95 backdrop-blur-md border-t border-white/10 pb-safe">
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all select-none ${
                isActive ? "text-[#4FA3FF]" : "text-[#8A92A3] hover:text-white"
              }`}
            >
              {/* Active Stripe Accent Underline on top of icon */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 m-stripe-horizontal rounded-full" />
              )}
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive ? "scale-110" : ""
                }`}
              />
              <span
                className={`text-[10px] font-heading font-medium tracking-wide mt-1 uppercase ${
                  isActive ? "font-bold text-white" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[#111216] border-r border-white/10 p-5 min-h-screen sticky top-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-white/10">
        {/* Slanted 3-stripe logo */}
        <div className="w-8 h-8 rounded-lg bg-[#1A1C22] flex items-center justify-center p-1.5 border border-white/10 overflow-hidden relative">
          <div className="w-full h-full m-stripe-diagonal -skew-x-12" />
        </div>
        <div>
          <span className="font-heading font-bold text-xl tracking-wider text-white block">
            NINAIVO
          </span>
          <span className="text-[10px] text-[#8A92A3] uppercase tracking-widest block -mt-1 font-semibold">
            Daily Tracker
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-heading tracking-wide transition-all min-h-[44px] ${
                isActive
                  ? "bg-[#1A1C22] text-white font-bold border-l-4 border-l-[#4FA3FF] shadow-inner"
                  : "text-[#8A92A3] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "text-[#4FA3FF]" : "text-[#8A92A3]"
                }`}
              />
              <span className="text-base">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 border-t border-white/10">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-heading tracking-wide transition-all min-h-[44px] ${
              pathname === "/settings"
                ? "bg-[#1A1C22] text-white font-bold border-l-4 border-l-[#E4101E]"
                : "text-[#8A92A3] hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="w-5 h-5 text-[#8A92A3]" />
            <span className="text-base">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Footer / Logout */}
      <div className="pt-4 border-t border-white/10">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-heading font-semibold uppercase tracking-wider text-[#8A92A3] hover:text-[#E4101E] hover:bg-[#E4101E]/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Lock &amp; Exit</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileTopHeader() {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-[#08080A]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-[#1A1C22] flex items-center justify-center p-1 border border-white/10 overflow-hidden">
          <div className="w-full h-full m-stripe-diagonal -skew-x-12" />
        </div>
        <span className="font-heading font-bold text-lg tracking-wider text-white">
          NINAIVO
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}

