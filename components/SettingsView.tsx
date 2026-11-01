"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { updateTimezoneSetting, changePinAction } from "@/app/actions/settings";
import { previewBackup, executeRestore, type BackupPreviewResult } from "@/app/actions/backup";
import { logoutAction } from "@/app/actions/auth";
import {
  Globe,
  Palette,
  KeyRound,
  Eye,
  EyeOff,
  Database,
  Download,
  Upload,
  Share2,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const currentTz = initialSettings.timezone?.tz || "Asia/Kolkata";
  const [selectedTz, setSelectedTz] = useState(currentTz);
  const [tzMessage, setTzMessage] = useState<string | null>(null);
  const [isUpdatingTz, setIsUpdatingTz] = useState(false);

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Backup & Restore state
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(
    initialSettings.last_backup_at?.date || null
  );
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Web Share modal state
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [shareBlobUrl, setShareBlobUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Import flow state
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [parsedBackupData, setParsedBackupData] = useState<any | null>(null);
  const [previewResult, setPreviewResult] = useState<BackupPreviewResult["preview"] | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);

  // Format date helper
  const formatDateTime = useCallback(
    (isoString: string) => {
      try {
        const d = new Date(isoString);
        return new Intl.DateTimeFormat("en-US", {
          timeZone: selectedTz,
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(d);
      } catch {
        return isoString;
      }
    },
    [selectedTz]
  );

  // Calculate days since last backup
  const daysSinceBackup = lastBackupDate
    ? Math.floor((Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isBackupStale = daysSinceBackup === null || daysSinceBackup >= 30;

  // Handle keyboard ESC for dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPreviewOpen && !isRestoring) {
          setIsPreviewOpen(false);
        }
        if (isShareModalOpen) {
          setIsShareModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen, isRestoring, isShareModalOpen]);

  // 1. Timezone Handler
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

  // 2. PIN Change Handler
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);
    setPinError(null);

    if (!currentPin) {
      setPinError("Please enter your current PIN");
      return;
    }
    if (!newPin || newPin.length < 4) {
      setPinError("New PIN must be at least 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and Confirm PIN do not match");
      return;
    }

    setIsChangingPin(true);
    try {
      const res = await changePinAction(currentPin, newPin);
      if (!res.success) {
        setPinError(res.error || "Failed to change PIN");
      } else {
        setPinMessage(res.message || "PIN changed successfully!");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      }
    } catch (err: any) {
      setPinError(err?.message || "An unexpected error occurred");
    } finally {
      setIsChangingPin(false);
    }
  };

  // 3. Export Backup Handler
  const handleExportBackup = async () => {
    setBackupMessage(null);
    setBackupError(null);
    setIsExporting(true);

    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Export failed on server");
      }

      // Extract filename from header
      const disposition = res.headers.get("content-disposition");
      let filename = "ninaivo-backup.json";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const text = await blob.text();
      const parsed = JSON.parse(text);

      const counts = parsed.counts || {
        items: parsed.data?.items?.length || 0,
        dailyLogs: parsed.data?.dailyLogs?.length || 0,
        upcoming: parsed.data?.upcoming?.length || 0,
      };

      const file = new File([blob], filename, { type: "application/json" });
      const nowIso = new Date().toISOString();
      setLastBackupDate(nowIso);

      // Check for Web Share support with files
      const canShare =
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      if (canShare) {
        const blobUrl = URL.createObjectURL(blob);
        setShareFile(file);
        setShareBlobUrl(blobUrl);
        setIsShareModalOpen(true);
      } else {
        // Fallback: direct browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setBackupMessage(
        `Backup saved. ${counts.items} items, ${counts.dailyLogs} logs, ${counts.upcoming} upcoming.`
      );
    } catch (err: any) {
      setBackupError(err?.message || "Failed to export backup.");
    } finally {
      setIsExporting(false);
    }
  };

  // Share file via Web Share API
  const handleTriggerWebShare = async () => {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        title: shareFile.name,
        text: "Ninaivo backup file",
      });
      setIsShareModalOpen(false);
    } catch (err: any) {
      // AbortError is normal when user cancels sheet
      if (err.name !== "AbortError") {
        console.warn("Share error:", err);
      }
    }
  };

  // Direct download from share dialog
  const handleDownloadFromShareModal = () => {
    if (!shareBlobUrl || !shareFile) return;
    const a = document.createElement("a");
    a.href = shareBlobUrl;
    a.download = shareFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsShareModalOpen(false);
  };

  // 4. File Selection Handler for Import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file works
    e.target.value = "";

    setBackupMessage(null);
    setBackupError(null);

    // Reject files over 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setBackupError("File exceeds 10 MB limit. Please select a valid Ninaivo backup.");
      return;
    }

    setIsImportLoading(true);

    try {
      const text = await file.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }

      // Check app identifier
      if (json.app !== "ninaivo") {
        throw new Error("Invalid backup: file does not belong to Ninaivo.");
      }

      // Check version
      if (typeof json.version === "number" && json.version > 1) {
        throw new Error(
          `This backup was created by a newer version of Ninaivo (v${json.version}). Please update the app to import it.`
        );
      }

      // Call server preview
      const previewRes = await previewBackup(json);
      if (!previewRes.success || !previewRes.preview) {
        throw new Error(previewRes.error || "Failed to validate backup contents.");
      }

      setParsedBackupData(json);
      setPreviewResult(previewRes.preview);
      setImportMode("merge");
      setReplaceConfirmText("");
      setIsPreviewOpen(true);
    } catch (err: any) {
      setBackupError(err?.message || "Failed to read backup file. No data was changed.");
    } finally {
      setIsImportLoading(false);
    }
  };

  // 5. Execute Restore Handler
  const handleConfirmRestore = async () => {
    if (!parsedBackupData) return;

    if (importMode === "replace" && replaceConfirmText.trim() !== "REPLACE") {
      return;
    }

    setIsRestoring(true);
    setBackupError(null);
    setBackupMessage(null);

    try {
      const result = await executeRestore(parsedBackupData, importMode);
      if (!result.success) {
        throw new Error(result.error || "Restore failed. No data was changed.");
      }

      setIsPreviewOpen(false);
      setParsedBackupData(null);
      setPreviewResult(null);

      const counts = result.counts || { items: 0, dailyLogs: 0, upcoming: 0 };
      setBackupMessage(
        `Restored: ${counts.items} items, ${counts.dailyLogs} logs, ${counts.upcoming} upcoming.`
      );

      // Refresh app data
      router.refresh();
    } catch (err: any) {
      setBackupError(err?.message || "Restore failed. Existing data was not modified.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
          Settings &amp; Preferences
        </h1>
        <p className="text-xs text-[#8A92A3] mt-1">
          Configure timezones, change your security PIN, and manage backups
        </p>
      </div>

      {/* 1. Change Security PIN */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#E4101E]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Change Security PIN
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPins(!showPins)}
            className="flex items-center gap-1.5 text-xs text-[#8A92A3] hover:text-white transition-colors"
          >
            {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showPins ? "Hide" : "Show"} PINs</span>
          </button>
        </div>
        <p className="text-xs text-[#8A92A3]">
          Update your login PIN by entering your current PIN. The new PIN will be securely hashed and saved immediately.
        </p>

        <form onSubmit={handleChangePin} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
              Current PIN *
            </label>
            <input
              type={showPins ? "text" : "password"}
              inputMode="numeric"
              required
              placeholder="Enter your current PIN (e.g. 1234)"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                New PIN *
              </label>
              <input
                type={showPins ? "text" : "password"}
                inputMode="numeric"
                required
                placeholder="4-8 digits"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                Confirm New PIN *
              </label>
              <input
                type={showPins ? "text" : "password"}
                inputMode="numeric"
                required
                placeholder="Re-enter new PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
              />
            </div>
          </div>

          {pinError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E4101E]/15 border border-[#E4101E]/30 text-xs text-[#E4101E]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          {pinMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#4FA3FF]/15 border border-[#4FA3FF]/30 text-xs text-[#4FA3FF]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pinMessage}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isChangingPin}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] flex items-center justify-center disabled:opacity-40 cursor-pointer"
            >
              {isChangingPin ? "Updating PIN..." : "Update Security PIN"}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Timezone Setting */}
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
            className="px-5 py-2.5 rounded-xl bg-[#4FA3FF] hover:bg-[#4FA3FF]/90 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer disabled:opacity-50"
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

      {/* 3. Backup and Restore (Standardized Card) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#4FA3FF]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Backup and restore
            </h2>
          </div>
        </div>

        <p className="text-xs text-[#8A92A3]">
          Your data is stored in the cloud database. Keep a backup file in a safe place.
        </p>

        {/* Last backup info */}
        <div className="p-3.5 rounded-xl bg-[#1A1C22] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-[#8A92A3] uppercase tracking-wider text-[11px] font-heading font-medium">
              Last backup:
            </span>{" "}
            <span className="text-white font-medium">
              {lastBackupDate ? formatDateTime(lastBackupDate) : "No backup yet"}
            </span>
          </div>
          {isBackupStale && (
            <p className="text-[#8A92A3] text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E4101E]" />
              You haven&apos;t backed up your data recently. Consider exporting a copy.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#1A1C22] hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all min-h-[44px] cursor-pointer disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#4FA3FF]" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#4FA3FF]" />
                <span>Export backup</span>
              </>
            )}
          </button>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportLoading || isRestoring}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#1A1C22] hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all min-h-[44px] cursor-pointer disabled:opacity-40"
            >
              {isImportLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#3D7EFF]" />
                  <span>Checking file...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#3D7EFF]" />
                  <span>Import backup</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </div>
        </div>

        {/* Success message */}
        {backupMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#4FA3FF]/15 border border-[#4FA3FF]/30 text-xs text-[#4FA3FF]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{backupMessage}</span>
          </div>
        )}

        {/* Error message */}
        {backupError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E4101E]/15 border border-[#E4101E]/30 text-xs text-[#E4101E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{backupError}</span>
          </div>
        )}
      </div>

      {/* 4. BMW M Theme Specification */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#E4101E]" />
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            BMW M Color Theme
          </h2>
        </div>
        <p className="text-xs text-[#8A92A3]">
          Pure dark mode inspired by the iconic BMW M Motorsport tri-color livery on carbon black.
          High contrast, flat surfaces, 1px borders, subtle diagonal accents.
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
            <span className="w-3 h-3 rounded-full bg-[#3D7EFF] inline-block mb-1" />
            <p className="font-heading font-bold text-white uppercase">M Dark Blue</p>
            <p className="text-[10px] text-[#8A92A3]">#3D7EFF (Upcoming)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1A1C22] border border-white/5">
            <span className="w-3 h-3 rounded-full bg-[#E4101E] inline-block mb-1" />
            <p className="font-heading font-bold text-white uppercase">M Red</p>
            <p className="text-[10px] text-[#8A92A3]">#E4101E (Diet &amp; Streaks)</p>
          </div>
        </div>
      </div>

      {/* 5. Session / Sign out */}
      <div className="pt-2">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#E4101E]/10 hover:bg-[#E4101E]/20 text-[#E4101E] border border-[#E4101E]/30 font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Lock &amp; Exit Dashboard</span>
          </button>
        </form>
      </div>

      {/* Web Share Modal (for mobile sharing to WhatsApp, Drive, Files) */}
      {isShareModalOpen && shareFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111216] border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 id="share-modal-title" className="font-heading font-bold text-base uppercase text-white">
                Backup ready
              </h3>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#1A1C22] border border-white/5 text-xs text-[#8A92A3]">
              <p className="font-mono text-white text-[11px] truncate">{shareFile.name}</p>
              <p className="text-[10px] mt-0.5">{(shareFile.size / 1024).toFixed(1)} KB JSON file</p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleTriggerWebShare}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#4FA3FF] hover:bg-[#4FA3FF]/90 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share to WhatsApp / Drive / Files</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadFromShareModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1A1C22] hover:bg-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider border border-white/10 transition-colors min-h-[44px] cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#8A92A3]" />
                <span>Download to device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {isPreviewOpen && previewResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            ref={previewModalRef}
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl bg-[#111216] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto focus:outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#4FA3FF]" />
                <h3 id="preview-modal-title" className="font-heading font-bold text-lg uppercase text-white">
                  Restore backup preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isRestoring && setIsPreviewOpen(false)}
                disabled={isRestoring}
                className="p-1.5 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File info */}
            <div className="text-xs space-y-1">
              <p className="text-[#8A92A3]">
                Exported on:{" "}
                <span className="text-white font-medium">
                  {formatDateTime(previewResult.exportedAt)}
                </span>
              </p>
              <p className="text-[#8A92A3]">
                Format version: <span className="text-white font-medium">v{previewResult.version}</span> • Timezone:{" "}
                <span className="text-white font-medium">{previewResult.timezone}</span>
              </p>
            </div>

            {/* Counts Comparison Table */}
            <div className="rounded-xl border border-white/10 bg-[#1A1C22] overflow-hidden text-xs">
              <div className="grid grid-cols-4 p-2.5 bg-white/5 font-heading font-semibold uppercase tracking-wider text-[11px] text-[#8A92A3]">
                <span>Category</span>
                <span className="text-center">Total</span>
                <span className="text-center text-[#4FA3FF]">New</span>
                <span className="text-center text-[#8A92A3]">Existing</span>
              </div>
              <div className="divide-y divide-white/5">
                <div className="grid grid-cols-4 p-2.5 text-white">
                  <span className="font-medium">Daily Items</span>
                  <span className="text-center">{previewResult.counts.items}</span>
                  <span className="text-center text-[#4FA3FF]">
                    +{previewResult.comparison.items.new}
                  </span>
                  <span className="text-center text-[#8A92A3]">
                    {previewResult.comparison.items.existing}
                  </span>
                </div>
                <div className="grid grid-cols-4 p-2.5 text-white">
                  <span className="font-medium">Daily Logs</span>
                  <span className="text-center">{previewResult.counts.dailyLogs}</span>
                  <span className="text-center text-[#4FA3FF]">
                    +{previewResult.comparison.dailyLogs.new}
                  </span>
                  <span className="text-center text-[#8A92A3]">
                    {previewResult.comparison.dailyLogs.existing}
                  </span>
                </div>
                <div className="grid grid-cols-4 p-2.5 text-white">
                  <span className="font-medium">Upcoming</span>
                  <span className="text-center">{previewResult.counts.upcoming}</span>
                  <span className="text-center text-[#4FA3FF]">
                    +{previewResult.comparison.upcoming.new}
                  </span>
                  <span className="text-center text-[#8A92A3]">
                    {previewResult.comparison.upcoming.existing}
                  </span>
                </div>
                <div className="grid grid-cols-4 p-2.5 text-white">
                  <span className="font-medium">Completions</span>
                  <span className="text-center">{previewResult.counts.completions}</span>
                  <span className="text-center text-[#4FA3FF]">
                    +{previewResult.comparison.completions.new}
                  </span>
                  <span className="text-center text-[#8A92A3]">
                    {previewResult.comparison.completions.existing}
                  </span>
                </div>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3]">
                Choose restore mode:
              </label>

              {/* Merge Option (Default) */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  importMode === "merge"
                    ? "bg-[#1A1C22] border-[#4FA3FF]"
                    : "bg-[#1A1C22]/40 border-white/5 hover:border-white/10"
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="mt-0.5 accent-[#4FA3FF]"
                />
                <div className="text-xs">
                  <span className="font-heading font-bold text-white uppercase tracking-wide block">
                    Merge (Recommended)
                  </span>
                  <span className="text-[#8A92A3] block mt-0.5">
                    Add missing records and update matching ones. Existing data is never deleted.
                  </span>
                </div>
              </label>

              {/* Replace Option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  importMode === "replace"
                    ? "bg-[#1A1C22] border-[#E4101E]"
                    : "bg-[#1A1C22]/40 border-white/5 hover:border-white/10"
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-0.5 accent-[#E4101E]"
                />
                <div className="text-xs">
                  <span className="font-heading font-bold text-white uppercase tracking-wide block">
                    Replace everything
                  </span>
                  <span className="text-[#8A92A3] block mt-0.5">
                    Wipe current data and restore cleanly from this backup file.
                  </span>
                </div>
              </label>
            </div>

            {/* Extra confirmation for Replace mode */}
            {importMode === "replace" && (
              <div className="p-3.5 rounded-xl bg-[#E4101E]/10 border border-[#E4101E]/30 space-y-3">
                <div className="flex items-start gap-2 text-xs text-[#E4101E]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    This action will wipe all existing checklist items, logs, and upcoming reminders before restoring.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-[#8A92A3]">Recommended before proceeding:</span>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-heading font-semibold border border-white/10 cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5 text-[#4FA3FF]" />
                    <span>Export current data first</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                    Type <strong className="text-white font-mono">REPLACE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={replaceConfirmText}
                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                    placeholder="REPLACE"
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1C22] border border-[#E4101E]/40 text-white text-xs font-mono focus:outline-none focus:border-[#E4101E]"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => !isRestoring && setIsPreviewOpen(false)}
                disabled={isRestoring}
                className="px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-[#8A92A3] hover:text-white font-heading font-semibold text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={
                  isRestoring ||
                  (importMode === "replace" && replaceConfirmText.trim() !== "REPLACE")
                }
                className={`px-5 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 ${
                  importMode === "replace"
                    ? "bg-[#E4101E]/20 text-[#E4101E] border border-[#E4101E]/40 hover:bg-[#E4101E]/30"
                    : "bg-[#4FA3FF] text-white hover:bg-[#4FA3FF]/90"
                }`}
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restoring data...</span>
                  </>
                ) : importMode === "replace" ? (
                  <span>Replace and restore</span>
                ) : (
                  <span>Confirm and merge</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
