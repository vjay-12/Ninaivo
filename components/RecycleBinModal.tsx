"use client";

import { useState, useEffect } from "react";
import {
  RecycleBinItem,
  getRecycleBinItems,
  restoreBinItem,
  restoreAllBinItems,
  permanentDeleteBinItem,
  emptyBin,
  setAutoCleanSetting,
} from "@/app/actions/bin";
import { X, Trash2, RotateCcw, AlertTriangle, CheckSquare, Bell, Users, Apple } from "lucide-react";
import { localDb } from "@/lib/db-local";
import { syncEngine } from "@/lib/sync";

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
}

export default function RecycleBinModal({ isOpen, onClose, onItemRestored }: RecycleBinModalProps) {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoClean, setAutoClean] = useState<"off" | "30" | "90">("off");
  const [actionInProgress, setActionInProgress] = useState<number | string | null>(null);

  const loadBin = async () => {
    setLoading(true);
    try {
      const data = await getRecycleBinItems();
      setItems(data);
    } catch {
      // Offline fallback: load soft-deleted items from localDb
      if (localDb) {
        try {
          const localUp = await localDb.upcomingItems.filter((u: any) => !!u.deletedAt).toArray();
          const localIt = await localDb.items.filter((i: any) => !!i.deletedAt).toArray();
          const list: RecycleBinItem[] = [];

          localIt.forEach((i: any) => {
            list.push({
              id: i.id || 0,
              uuid: i.uuid,
              sourceTable: "items",
              typeLabel: i.type === "diet" ? "Daily diet" : "Daily checklist",
              name: i.name,
              deletedAt: i.deletedAt || new Date().toISOString(),
              daysAgo: 0,
              relativeTime: "Recently",
            });
          });

          localUp.forEach((u: any) => {
            list.push({
              id: u.id || 0,
              uuid: u.uuid,
              sourceTable: "upcoming_items",
              typeLabel: `Upcoming (${u.type})`,
              name: u.title,
              deletedAt: u.deletedAt || new Date().toISOString(),
              daysAgo: 0,
              relativeTime: "Recently",
            });
          });

          setItems(list);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBin();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (item: RecycleBinItem) => {
    setActionInProgress(item.id);
    // Optimistic remove from bin
    setItems((prev) => prev.filter((i) => !(i.sourceTable === item.sourceTable && i.id === item.id)));

    // Local Dexie update
    if (localDb && item.uuid) {
      try {
        const nowIso = new Date().toISOString();
        if (item.sourceTable === "items") {
          await localDb.items.update(item.uuid, { deletedAt: null, updatedAt: nowIso });
        } else if (item.sourceTable === "upcoming_items") {
          await localDb.upcomingItems.update(item.uuid, { deletedAt: null, updatedAt: nowIso });
        }
      } catch {}
    }

    if (syncEngine && item.uuid) {
      syncEngine.queueLocalWrite(item.sourceTable, "update", {
        uuid: item.uuid,
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      await restoreBinItem(item.sourceTable, item.id);
      onItemRestored?.();
    } catch {}
    setActionInProgress(null);
  };

  const handleRestoreAll = async () => {
    if (items.length === 0) return;
    setActionInProgress("all");
    const oldItems = [...items];
    setItems([]);

    if (localDb) {
      try {
        const nowIso = new Date().toISOString();
        for (const item of oldItems) {
          if (item.sourceTable === "items") {
            await localDb.items.update(item.uuid, { deletedAt: null, updatedAt: nowIso });
          } else if (item.sourceTable === "upcoming_items") {
            await localDb.upcomingItems.update(item.uuid, { deletedAt: null, updatedAt: nowIso });
          }
        }
      } catch {}
    }

    try {
      await restoreAllBinItems();
      onItemRestored?.();
    } catch {
      setItems(oldItems);
    }
    setActionInProgress(null);
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    if (!window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) {
      return;
    }

    setActionInProgress(item.id);
    setItems((prev) => prev.filter((i) => !(i.sourceTable === item.sourceTable && i.id === item.id)));

    if (localDb && item.uuid) {
      try {
        if (item.sourceTable === "items") {
          await localDb.items.delete(item.uuid);
        } else if (item.sourceTable === "upcoming_items") {
          await localDb.upcomingItems.delete(item.uuid);
        }
      } catch {}
    }

    try {
      await permanentDeleteBinItem(item.sourceTable, item.id);
    } catch {}
    setActionInProgress(null);
  };

  const handleEmptyBin = async () => {
    if (items.length === 0) return;
    if (
      !window.confirm(
        "Empty recycle bin? This cannot be undone and will permanently delete all items in the bin."
      )
    ) {
      return;
    }

    setActionInProgress("empty");
    const oldItems = [...items];
    setItems([]);

    if (localDb) {
      try {
        for (const item of oldItems) {
          if (item.sourceTable === "items") {
            await localDb.items.delete(item.uuid);
          } else if (item.sourceTable === "upcoming_items") {
            await localDb.upcomingItems.delete(item.uuid);
          }
        }
      } catch {}
    }

    try {
      await emptyBin();
    } catch {
      setItems(oldItems);
    }
    setActionInProgress(null);
  };

  const handleAutoCleanChange = async (val: "off" | "30" | "90") => {
    setAutoClean(val);
    try {
      await setAutoCleanSetting(val);
    } catch {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bin-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#111216] border border-white/10 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 id="bin-title" className="font-heading font-bold text-base sm:text-lg uppercase text-white">
              Recycle bin
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-white/80">
              {items.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Actions & Setting Bar */}
        <div className="px-4 py-2.5 bg-[#14151B] border-b border-white/5 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={items.length === 0 || actionInProgress !== null}
              onClick={handleRestoreAll}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
            >
              Restore all
            </button>
            <button
              type="button"
              disabled={items.length === 0 || actionInProgress !== null}
              onClick={handleEmptyBin}
              className="px-2.5 py-1.5 rounded-lg bg-[#E4101E]/15 hover:bg-[#E4101E]/25 text-[#FF4D5A] font-medium disabled:opacity-40 transition-colors cursor-pointer"
            >
              Empty bin
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#8A92A3]">
            <span>Auto-clean:</span>
            <select
              value={autoClean}
              onChange={(e) => handleAutoCleanChange(e.target.value as any)}
              className="bg-[#1A1C22] border border-white/10 rounded px-1.5 py-0.5 text-white text-[11px] focus:outline-none"
            >
              <option value="off">Off</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </div>

        {/* List of deleted items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-center text-xs text-[#8A92A3] py-8">Loading recycle bin...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-white font-medium">Recycle bin is empty</p>
              <p className="text-xs text-[#8A92A3]">Deleted items stay here indefinitely until deleted forever.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.sourceTable}-${item.id}`}
                className="p-3 rounded-xl bg-[#14151B] border border-white/5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white break-words">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-[#8A92A3] border border-white/5">
                      {item.typeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A92A3]">
                    Deleted {item.relativeTime}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-[#4FA3FF]" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(item)}
                    className="p-1.5 rounded-lg text-[#8A92A3] hover:text-[#E4101E] hover:bg-[#E4101E]/10 transition-colors cursor-pointer"
                    title="Delete forever"
                    aria-label="Delete forever"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

