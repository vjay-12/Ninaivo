"use client";

import { useState } from "react";
import { updateTimezoneSetting, importDatabaseBackup } from "@/app/actions/settings";
import { logoutAction } from "@/app/actions/auth";
import {
  Globe,
  Palette,
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
} from "lucide-react";

interface SettingsViewProps {
  initialSettings: Record<string, any>;
}

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function SettingsView({ initialSettings }: SettingsViewProps) {
  const currentTz = initialSettings.timezone?.tz || "Asia/Kolkata";
  const [selectedTz, setSelectedTz] = useState(currentTz);
  const [tzMessage, setTzMessage] = useState<string | null>(null);
  const [isUpdatingTz, setIsUpdatingTz] = useState(false);

  // Import state
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleSaveTimezone = async () => {
    setIsUpdatingTz(true);
    try {
      await updateTimezoneSetting(selectedTz);
      setTzMessage("Timezone successfully saved!");
      setTimeout(() => setTzMessage(null), 3000);
    } finally {
      setIsUpdatingTz(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportMessage(null);
    setImportError(null);
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        await importDatabaseBackup(json);
        setImportMessage("Backup data successfully restored into database!");
      } catch (err: any) {
        setImportError(err?.message || "Failed to parse or restore backup JSON.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
          Settings &amp; Preferences
        </h1>
        <p className="text-xs text-[#8A92A3] mt-1">
          Configure timezones, design system accents, and database backups
        </p>
      </div>

      {/* 1. Timezone Setting */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#4FA3FF]" />
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            Timezone Configuration
          </h2>
        </div>
        <p className="text-xs text-[#8A92A3]">
          All daily logs and &quot;today&quot; metrics are strictly calculated in this timezone,
          ensuring UTC server drift on Vercel never resets your day early.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedTz}
            onChange={(e) => setSelectedTz(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz} {tz === "Asia/Kolkata" ? "(Default)" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSaveTimezone}
            disabled={isUpdatingTz}
            className="px-5 py-2.5 rounded-xl bg-[#4FA3FF] hover:bg-[#4FA3FF]/90 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
          >
            {isUpdatingTz ? "Saving..." : "Save Timezone"}
          </button>
        </div>

        {tzMessage && (
          <div className="flex items-center gap-2 text-xs text-[#4FA3FF]">
            <CheckCircle2 className="w-4 h-4" />
            <span>{tzMessage}</span>
          </div>
        )}
      </div>

      {/* 2. BMW M Theme Specification */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#E4101E]" />
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            BMW M Color Theme
          </h2>
        </div>
        <p className="text-xs text-[#8A92A3]">
          Pure dark mode inspired by the iconic BMW M Motorsport tri-color livery on carbon black.
          High contrast, no car photos, subtle diagonal accents.
        </p>

        {/* 3 Stripe Showcase Bar */}
        <div className="h-4 rounded-xl m-stripe-diagonal -skew-x-12 shadow-md my-2" />

        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
          <div className="p-2.5 rounded-xl bg-[#1A1C22] border border-white/5">
            <span className="w-3 h-3 rounded-full bg-[#4FA3FF] inline-block mb-1" />
            <p className="font-heading font-bold text-white uppercase">M Light Blue</p>
            <p className="text-[10px] text-[#8A92A3]">#4FA3FF (Checklist)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1A1C22] border border-white/5">
            <span className="w-3 h-3 rounded-full bg-[#0B3A82] inline-block mb-1" />
            <p className="font-heading font-bold text-white uppercase">M Dark Blue</p>
            <p className="text-[10px] text-[#8A92A3]">#0B3A82 (Weekly)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1A1C22] border border-white/5">
            <span className="w-3 h-3 rounded-full bg-[#E4101E] inline-block mb-1" />
            <p className="font-heading font-bold text-white uppercase">M Red</p>
            <p className="text-[10px] text-[#8A92A3]">#E4101E (Diet &amp; Streaks)</p>
          </div>
        </div>
      </div>

      {/* 3. PIN Authentication Information */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#4FA3FF]" />
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            Security &amp; PIN Authentication
          </h2>
        </div>
        <p className="text-xs text-[#8A92A3] leading-relaxed">
          The app is secured using a single-user hashed PIN (<code className="text-white">APP_PIN_HASH</code>)
          and cryptographic JWT session cookies signed with <code className="text-white">SESSION_SECRET</code>.
        </p>
        <p className="text-xs text-[#8A92A3]">
          To change your master PIN, generate a new bcrypt hash (e.g. using <code className="text-white">bcrypt.hashSync(&quot;newPin&quot;, 10)</code>)
          and update the <code className="text-white">APP_PIN_HASH</code> in your <code className="text-white">.env.local</code> or Vercel Environment Variables.
        </p>
      </div>

      {/* 4. Restore / Import Database */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#0B3A82]" />
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            Restore Backup JSON
          </h2>
        </div>
        <p className="text-xs text-[#8A92A3]">
          Restore habit items, daily logs, and weekly tasks from a previously exported JSON backup.
        </p>

        <div>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1C22] hover:bg-white/10 border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors min-h-[44px]">
            <Upload className="w-4 h-4 text-[#4FA3FF]" />
            <span>Select JSON Backup File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="sr-only"
            />
          </label>
        </div>

        {importMessage && (
          <div className="flex items-center gap-2 text-xs text-[#4FA3FF]">
            <CheckCircle2 className="w-4 h-4" />
            <span>{importMessage}</span>
          </div>
        )}

        {importError && (
          <div className="flex items-center gap-2 text-xs text-[#E4101E]">
            <AlertCircle className="w-4 h-4" />
            <span>{importError}</span>
          </div>
        )}
      </div>

      {/* 5. Session / Sign out */}
      <div className="pt-2">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#E4101E]/10 hover:bg-[#E4101E]/20 text-[#E4101E] border border-[#E4101E]/30 font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Lock &amp; Exit Dashboard</span>
          </button>
        </form>
      </div>
    </div>
  );
}

