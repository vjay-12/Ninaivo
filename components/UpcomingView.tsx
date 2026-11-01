"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  FormattedUpcomingItem,
  UpcomingGroupedData,
  UpcomingType,
  UpcomingRepeat,
  TimeFilter,
  createUpcomingItem,
  updateUpcomingItem,
  toggleUpcomingDone,
  undoUpcomingCompletion,
  snoozeUpcomingItem,
  deleteUpcomingItem,
} from "@/app/actions/upcoming";
import {
  Plus,
  Check,
  ChevronDown,
  Users,
  Bell,
  CheckSquare,
  Clock,
  RotateCw,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { getTodayDateString, addDaysToDate, formatTimeDisplay } from "@/lib/date";
import { localDb } from "@/lib/db-local";
import { syncEngine } from "@/lib/sync";

interface UpcomingViewProps {
  initialData: UpcomingGroupedData;
}

const TYPE_CONFIG = {
  meeting: {
    label: "Meeting",
    icon: Users,
    color: "#3D7EFF", // Brightened Dark Blue for contrast >= 4.5:1
    borderClass: "border-l-[#3D7EFF]",
    bgClass: "bg-[#3D7EFF]/15 text-[#6BA0FF]",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    color: "#E4101E", // M Red
    borderClass: "border-l-[#E4101E]",
    bgClass: "bg-[#E4101E]/15 text-[#FF4D5A]",
  },
  todo: {
    label: "Todo",
    icon: CheckSquare,
    color: "#9CA3AF", // Neutral Grey-White
    borderClass: "border-l-[#9CA3AF]",
    bgClass: "bg-white/10 text-[#D1D5DB]",
  },
};

export default function UpcomingView({ initialData }: UpcomingViewProps) {
  const [data, setData] = useState<UpcomingGroupedData>(initialData);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedType, setSelectedType] = useState<UpcomingType | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Sheet / Modal state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormattedUpcomingItem | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<UpcomingType>("todo");
  const [dateStr, setDateStr] = useState<string>(getTodayDateString());
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [repeat, setRepeat] = useState<UpcomingRepeat>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic pending state
  const [pendingToggles, setPendingToggles] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Pulse overdue badge once on load
  const [pulseBadge, setPulseBadge] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setPulseBadge(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard navigation: Escape key closes bottom sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSheetOpen) {
        setIsSheetOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSheetOpen]);

  // Request browser notification permission only when user adds first timed item
  const maybeRequestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignore
        }
      }
    }
  };

  // Quick-Add natural language detection
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (editingItem) return; // Don't override existing dates when editing

    const lower = val.toLowerCase();
    const today = getTodayDateString();

    // 1. Detect relative dates
    if (lower.includes("tomorrow")) {
      setDateStr(addDaysToDate(today, 1));
    } else if (lower.includes("in 2 days")) {
      setDateStr(addDaysToDate(today, 2));
    } else if (lower.includes("in 3 days")) {
      setDateStr(addDaysToDate(today, 3));
    } else if (lower.includes("today")) {
      setDateStr(today);
    } else {
      // Weekdays: mon, tue, wed, thu, fri, sat, sun
      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      for (let i = 0; i < 7; i++) {
        const dName = days[i];
        if (new RegExp(`\\b${dName}\\b`, "i").test(lower)) {
          const currentDay = new Date().getDay();
          const diff = (i - currentDay + 7) % 7 || 7;
          setDateStr(addDaysToDate(today, diff));
          break;
        }
      }
    }

    // 2. Detect times: e.g. "4pm", "4:30pm", "10am", "at 3pm"
    const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3];
      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;

      const formattedH = String(h).padStart(2, "0");
      const formattedM = String(m).padStart(2, "0");
      setStartTime(`${formattedH}:${formattedM}`);
      setHasTime(true);

      // End time 30 mins later
      const endH = (h + Math.floor((m + 30) / 60)) % 24;
      const endM = (m + 30) % 60;
      setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setTitle("");
    setType("todo");
    setDateStr(getTodayDateString());
    setHasTime(false);
    setStartTime("09:00");
    setEndTime("09:30");
    setRepeat(null);
    setNotes("");
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: FormattedUpcomingItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setType(item.type);
    setDateStr(item.dateStr || "");
    setHasTime(item.hasTime);

    if (item.dueAt) {
      const d = new Date(item.dueAt);
      setStartTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    } else {
      setStartTime("09:00");
    }

    if (item.endAt) {
      const e = new Date(item.endAt);
      setEndTime(
        `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`
      );
    } else {
      setEndTime("09:30");
    }

    setRepeat(item.repeat || null);
    setNotes(item.notes || "");
    setIsSheetOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    if (hasTime && dateStr) {
      maybeRequestNotificationPermission();
    }

    setIsSaving(true);
    try {
      let dueIso: string | null = null;
      let endIso: string | null = null;

      if (dateStr) {
        const [y, m, d] = dateStr.split("-").map(Number);
        const dueDate = new Date();
        dueDate.setFullYear(y, m - 1, d);

        if (hasTime) {
          const [sh, sm] = startTime.split(":").map(Number);
          dueDate.setHours(sh || 9, sm || 0, 0, 0);
        } else {
          dueDate.setHours(9, 0, 0, 0);
        }
        dueIso = dueDate.toISOString();

        if (hasTime && type === "meeting") {
          const endDate = new Date(dueDate);
          const [eh, em] = endTime.split(":").map(Number);
          endDate.setHours(eh || 9, em || 30, 0, 0);
          endIso = endDate.toISOString();
        }
      }

      const nowIso = new Date().toISOString();

      if (editingItem) {
        const updatedFormatted: FormattedUpcomingItem = {
          ...editingItem,
          title,
          type,
          dueAt: dueIso,
          endAt: endIso,
          hasTime: dateStr ? hasTime : false,
          repeat: dateStr ? repeat : null,
          notes,
          dateStr: dateStr || null,
          timeDisplay: dueIso && hasTime ? (type === "meeting" ? formatTimeDisplay(startTime) : formatTimeDisplay(startTime)) : (dueIso ? "All day" : ""),
        };

        const updateSection = (list: FormattedUpcomingItem[]) =>
          list.map((i) => (i.id === editingItem.id ? updatedFormatted : i));

        setData((prev) => ({
          ...prev,
          overdue: updateSection(prev.overdue),
          today: updateSection(prev.today),
          tomorrow: updateSection(prev.tomorrow),
          thisWeek: updateSection(prev.thisWeek),
          later: updateSection(prev.later),
          noDate: updateSection(prev.noDate),
          done: updateSection(prev.done),
        }));

        if (editingItem.uuid && localDb) {
          try {
            await localDb.upcomingItems.update(editingItem.uuid, {
              title,
              type,
              dueAt: dueIso,
              endAt: endIso,
              hasTime: dateStr ? hasTime : false,
              repeat: dateStr ? repeat : null,
              notes,
              updatedAt: nowIso,
            });
          } catch {}
        }
        if (editingItem.uuid && syncEngine) {
          syncEngine.queueLocalWrite("upcoming_items", "update", {
            uuid: editingItem.uuid,
            title,
            type,
            dueAt: dueIso,
            endAt: endIso,
            hasTime: dateStr ? hasTime : false,
            repeat: dateStr ? repeat : null,
            notes,
            updatedAt: nowIso,
          });
        }

        try {
          await updateUpcomingItem(editingItem.id, {
            title,
            type,
            dueAt: dueIso,
            endAt: endIso,
            hasTime: dateStr ? hasTime : false,
            repeat: dateStr ? repeat : null,
            notes,
          });
        } catch {}
      } else {
        const itemUuid = crypto.randomUUID();
        const fakeId = Date.now();
        const newFormatted: FormattedUpcomingItem = {
          id: fakeId,
          uuid: itemUuid,
          title,
          type,
          dueAt: dueIso,
          endAt: endIso,
          hasTime: dateStr ? hasTime : false,
          repeat: dateStr ? repeat : null,
          notes,
          doneAt: null,
          snoozedUntil: null,
          createdAt: nowIso,
          dateStr: dateStr || null,
          relativeLabel: dateStr ? (dateStr === getTodayDateString() ? "Today" : dateStr) : "No date",
          timeDisplay: dueIso && hasTime ? (type === "meeting" ? formatTimeDisplay(startTime) : formatTimeDisplay(startTime)) : (dueIso ? "All day" : ""),
          isOverdue: false,
          isToday: dateStr === getTodayDateString(),
          isDone: false,
        };

        setData((prev) => {
          if (!dateStr) {
            return { ...prev, noDate: [newFormatted, ...prev.noDate] };
          } else if (dateStr === getTodayDateString()) {
            return { ...prev, today: [...prev.today, newFormatted] };
          } else {
            return { ...prev, later: [...prev.later, newFormatted] };
          }
        });

        if (localDb) {
          try {
            await localDb.upcomingItems.put({
              id: fakeId,
              uuid: itemUuid,
              title,
              type,
              dueAt: dueIso,
              endAt: endIso,
              hasTime: dateStr ? hasTime : false,
              repeat: dateStr ? repeat : null,
              notes,
              doneAt: null,
              snoozedUntil: null,
              createdAt: nowIso,
              updatedAt: nowIso,
              deletedAt: null,
            });
          } catch {}
        }
        if (syncEngine) {
          syncEngine.queueLocalWrite("upcoming_items", "insert", {
            uuid: itemUuid,
            title,
            type,
            dueAt: dueIso,
            endAt: endIso,
            hasTime: dateStr ? hasTime : false,
            repeat: dateStr ? repeat : null,
            notes,
            doneAt: null,
            snoozedUntil: null,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        }

        try {
          await createUpcomingItem({
            title,
            type,
            dueAt: dueIso,
            endAt: endIso,
            hasTime: dateStr ? hasTime : false,
            repeat: dateStr ? repeat : null,
            notes,
          });
        } catch {}
      }

      setIsSheetOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (item: FormattedUpcomingItem) => {
    // Optimistic toggle
    setPendingToggles((prev) => ({ ...prev, [item.id]: true }));

    const nowIso = new Date().toISOString();
    const nextDone = !item.isDone;

    setData((prev) => {
      const filterOut = (list: FormattedUpcomingItem[]) => list.filter((i) => i.id !== item.id);
      if (nextDone) {
        // Move to done
        return {
          ...prev,
          overdue: filterOut(prev.overdue),
          today: filterOut(prev.today),
          tomorrow: filterOut(prev.tomorrow),
          thisWeek: filterOut(prev.thisWeek),
          later: filterOut(prev.later),
          noDate: filterOut(prev.noDate),
          done: [{ ...item, isDone: true, doneAt: nowIso }, ...prev.done],
        };
      } else {
        // Move back to today or later
        return {
          ...prev,
          done: filterOut(prev.done),
          today: item.isToday ? [{ ...item, isDone: false, doneAt: null }, ...prev.today] : prev.today,
          later: !item.isToday && item.dateStr ? [{ ...item, isDone: false, doneAt: null }, ...prev.later] : prev.later,
          noDate: !item.dateStr ? [{ ...item, isDone: false, doneAt: null }, ...prev.noDate] : prev.noDate,
        };
      }
    });

    if (item.uuid) {
      if (localDb) {
        try {
          localDb.upcomingItems.update(item.uuid, {
            doneAt: nextDone ? nowIso : null,
            updatedAt: nowIso,
          });
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("upcoming_items", "update", {
          uuid: item.uuid,
          doneAt: nextDone ? nowIso : null,
          updatedAt: nowIso,
        });
      }
    }

    startTransition(async () => {
      try {
        if (item.isDone) {
          await undoUpcomingCompletion(item.id, item.completionId);
        } else {
          await toggleUpcomingDone(item.id);
        }
      } catch {
        // Offline mode: handled in outbox
      } finally {
        setPendingToggles((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    });
  };

  const handleSnooze = async (id: number, duration: "1h" | "tomorrow" | "next_week") => {
    setExpandedId(null);
    setData((prev) => ({
      ...prev,
      overdue: prev.overdue.filter((i) => i.id !== id),
      today: prev.today.filter((i) => i.id !== id),
    }));

    try {
      await snoozeUpcomingItem(id, duration);
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this item? Its history will also be removed.")) return;
    setExpandedId(null);

    let targetUuid: string | undefined;
    for (const sec of [data.overdue, data.today, data.tomorrow, data.thisWeek, data.later, data.noDate, data.done]) {
      const found = sec.find((i) => i.id === id);
      if (found) {
        targetUuid = found.uuid;
        break;
      }
    }

    const nowIso = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      overdue: prev.overdue.filter((i) => i.id !== id),
      today: prev.today.filter((i) => i.id !== id),
      tomorrow: prev.tomorrow.filter((i) => i.id !== id),
      thisWeek: prev.thisWeek.filter((i) => i.id !== id),
      later: prev.later.filter((i) => i.id !== id),
      noDate: prev.noDate.filter((i) => i.id !== id),
      done: prev.done.filter((i) => i.id !== id),
    }));

    if (targetUuid) {
      if (localDb) {
        try {
          await localDb.upcomingItems.delete(targetUuid);
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("upcoming_items", "delete", {
          uuid: targetUuid,
          deletedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    try {
      await deleteUpcomingItem(id);
    } catch {}
  };

  const filterByType = (items: FormattedUpcomingItem[]) => {
    if (!selectedType) return items;
    return items.filter((i) => i.type === selectedType);
  };

  // Filter sections by selected type
  const filteredData = useMemo(() => {
    return {
      overdue: filterByType(data.overdue),
      today: filterByType(data.today),
      tomorrow: filterByType(data.tomorrow),
      thisWeek: filterByType(data.thisWeek),
      later: filterByType(data.later),
      noDate: filterByType(data.noDate || []),
      done: filterByType(data.done),
    };
  }, [data, selectedType]);

  // Determine if active view is empty
  const isEmpty = useMemo(() => {
    if (timeFilter === "done") {
      return filteredData.done.length === 0;
    }
    if (timeFilter === "today") {
      return filteredData.today.length === 0;
    }
    if (timeFilter === "this_week") {
      return filteredData.tomorrow.length === 0 && filteredData.thisWeek.length === 0;
    }
    if (timeFilter === "later") {
      return filteredData.later.length === 0 && filteredData.noDate.length === 0;
    }
    // "all"
    return (
      filteredData.overdue.length === 0 &&
      filteredData.today.length === 0 &&
      filteredData.tomorrow.length === 0 &&
      filteredData.thisWeek.length === 0 &&
      filteredData.later.length === 0 &&
      filteredData.noDate.length === 0
    );
  }, [filteredData, timeFilter]);

  // Empty state copy builder
  const getEmptyMessage = () => {
    const typeLabel = selectedType ? TYPE_CONFIG[selectedType].label.toLowerCase() + "s" : "items";
    if (timeFilter === "done") {
      return selectedType
        ? `No completed ${typeLabel} in the last 30 days.`
        : "No completed items in the last 30 days.";
    }
    if (timeFilter === "today") {
      return `No ${typeLabel} today.`;
    }
    if (timeFilter === "this_week") {
      return `No ${typeLabel} this week.`;
    }
    if (timeFilter === "later") {
      return `No ${typeLabel} scheduled for later.`;
    }
    return selectedType ? `No upcoming ${typeLabel}.` : "No upcoming items.";
  };

  return (
    <div className="space-y-4 max-w-2xl pb-16">
      {/* 1. Header (Title + Single "+ Add" button) */}
      <div className="flex items-center justify-between gap-3 min-h-[40px]">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase leading-none">
            Upcoming
          </h1>
        </div>

        <button
          type="button"
          onClick={openAddSheet}
          className="shrink-0 h-10 px-4 rounded-lg bg-[#4FA3FF] hover:bg-[#3fa0ff] text-[#08080A] font-medium text-xs whitespace-nowrap active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
          <span>Add</span>
        </button>
      </div>

      {/* 2. Filter Row 1 (Time Filters: All, Today, This week, Later, Done) */}
      <div className="relative">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap whitespace-nowrap pb-1 scrollbar-none no-scrollbar pr-6 select-none">
          {(["all", "today", "this_week", "later", "done"] as TimeFilter[]).map((f) => {
            const isSelected = timeFilter === f;
            const labels: Record<TimeFilter, string> = {
              all: "All",
              today: "Today",
              this_week: "This week",
              later: "Later",
              done: "Done",
            };

            return (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`shrink-0 h-8 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-white text-black font-semibold"
                    : "bg-[#14151B] text-[#8A92A3] hover:text-white border border-white/5"
                }`}
              >
                <span>{labels[f]}</span>
                {/* Overdue Badge next to All */}
                {f === "all" && data.totalOverdueCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? "bg-[#E4101E] text-white" : "bg-[#E4101E]/20 text-[#E4101E]"
                    } ${pulseBadge ? "animate-pulse" : ""}`}
                  >
                    {data.totalOverdueCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Filter Row 2 (Type Filters: Meeting, Reminder, Todo - Single Selection) */}
      <div className="relative">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap whitespace-nowrap pb-1 scrollbar-none no-scrollbar pr-6 select-none">
          {(["meeting", "reminder", "todo"] as UpcomingType[]).map((t) => {
            const isSelected = selectedType === t;
            const config = TYPE_CONFIG[t];
            const Icon = config.icon;

            return (
              <button
                key={t}
                type="button"
                role="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedType((prev) => (prev === t ? null : t))}
                className={`shrink-0 h-7 px-3 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 border select-none cursor-pointer ${
                  isSelected
                    ? "bg-[#232630] text-white border-[#4FA3FF]/60 shadow-sm"
                    : "bg-[#14151B] text-[#8A92A3] hover:text-white border-white/5 hover:border-white/10"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <Icon className="w-3 h-3 shrink-0" />
                <span>{config.label}</span>
              </button>
            );
          })}
          {selectedType && (
            <button
              type="button"
              onClick={() => setSelectedType(null)}
              className="shrink-0 text-[11px] text-[#8A92A3] hover:text-white px-1.5 underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 4. List Sections */}
      {isEmpty ? (
        <div className="p-8 rounded-xl bg-[#111216] border border-white/5 text-center space-y-3">
          <p className="text-xs text-[#8A92A3]">{getEmptyMessage()}</p>
          {timeFilter !== "done" && (
            <button
              type="button"
              onClick={openAddSheet}
              className="text-xs text-[#4FA3FF] hover:underline font-medium cursor-pointer"
            >
              + Add an item
            </button>
          )}
        </div>
      ) : timeFilter === "done" ? (
        /* Done Section */
        <SectionBlock
          title="Done (last 30 days)"
          items={filteredData.done}
          expandedId={expandedId}
          pendingToggles={pendingToggles}
          onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          onToggle={handleToggle}
          onEdit={openEditSheet}
          onSnooze={handleSnooze}
          onDelete={handleDelete}
        />
      ) : (
        <div className="space-y-5">
          {/* Overdue (always on top, shown in 'all') */}
          {timeFilter === "all" && filteredData.overdue.length > 0 && (
            <SectionBlock
              title="Overdue"
              titleColor="text-[#E4101E]"
              items={filteredData.overdue}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggle={handleToggle}
              onEdit={openEditSheet}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          )}

          {/* Today */}
          {(timeFilter === "all" || timeFilter === "today") &&
            filteredData.today.length > 0 && (
              <SectionBlock
                title="Today"
                items={filteredData.today}
                expandedId={expandedId}
                pendingToggles={pendingToggles}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onToggle={handleToggle}
                onEdit={openEditSheet}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            )}

          {/* Tomorrow */}
          {(timeFilter === "all" || timeFilter === "this_week") &&
            filteredData.tomorrow.length > 0 && (
              <SectionBlock
                title="Tomorrow"
                items={filteredData.tomorrow}
                expandedId={expandedId}
                pendingToggles={pendingToggles}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onToggle={handleToggle}
                onEdit={openEditSheet}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            )}

          {/* This week */}
          {(timeFilter === "all" || timeFilter === "this_week") &&
            filteredData.thisWeek.length > 0 && (
              <SectionBlock
                title="This week"
                items={filteredData.thisWeek}
                expandedId={expandedId}
                pendingToggles={pendingToggles}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onToggle={handleToggle}
                onEdit={openEditSheet}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            )}

          {/* Later */}
          {(timeFilter === "all" || timeFilter === "later") &&
            filteredData.later.length > 0 && (
              <SectionBlock
                title="Later"
                items={filteredData.later}
                expandedId={expandedId}
                pendingToggles={pendingToggles}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onToggle={handleToggle}
                onEdit={openEditSheet}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            )}

          {/* No date (shown after Later in 'all' and 'later') */}
          {(timeFilter === "all" || timeFilter === "later") &&
            filteredData.noDate.length > 0 && (
              <SectionBlock
                title="No date"
                items={filteredData.noDate}
                expandedId={expandedId}
                pendingToggles={pendingToggles}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onToggle={handleToggle}
                onEdit={openEditSheet}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            )}
        </div>
      )}

      {/* 5. Add / Edit Bottom Sheet */}
      {isSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#111216] border border-white/10 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 id="sheet-title" className="font-heading font-bold text-lg uppercase text-white">
                {editingItem ? "Edit item" : "New item"}
              </h2>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="p-1.5 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Doctor appointment tomorrow 3pm"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF] transition-colors"
                />
              </div>

              {/* Type selector (Meeting, Reminder, Todo) */}
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["meeting", "reminder", "todo"] as UpcomingType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    const isSel = type === t;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          isSel
                            ? "bg-[#1C1F28] text-white border-[#4FA3FF]"
                            : "bg-[#14151B] text-[#8A92A3] border-white/5 hover:border-white/10"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date (Optional with clear button) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-heading uppercase tracking-wider text-[#8A92A3]">
                    Date (optional)
                  </label>
                  {dateStr ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDateStr("");
                        setHasTime(false);
                        setRepeat(null);
                      }}
                      className="text-[11px] text-[#8A92A3] hover:text-[#E4101E] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear (No date)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDateStr(getTodayDateString())}
                      className="text-[11px] text-[#4FA3FF] hover:underline cursor-pointer"
                    >
                      Set to Today
                    </button>
                  )}
                </div>

                {dateStr ? (
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF] transition-colors"
                  />
                ) : (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#1A1C22]/60 border border-white/5 text-sm text-[#8A92A3]">
                    <span>No date</span>
                    <button
                      type="button"
                      onClick={() => setDateStr(getTodayDateString())}
                      className="text-xs text-[#4FA3FF] hover:underline font-medium cursor-pointer"
                    >
                      Add date
                    </button>
                  </div>
                )}

                {type === "meeting" && !dateStr && (
                  <p className="text-[11px] text-[#8A92A3] mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#3D7EFF]" />
                    <span>Add a date to get a reminder</span>
                  </p>
                )}
              </div>

              {/* Time Section (Only if date is set) */}
              {dateStr ? (
                <div className="space-y-2.5 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-heading uppercase tracking-wider text-[#8A92A3]">
                      Set exact time
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasTime}
                        onChange={(e) => setHasTime(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#232630] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4FA3FF]" />
                    </label>
                  </div>

                  {hasTime && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-[#8A92A3] mb-1">
                          {type === "meeting" ? "Start time" : "Time"}
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
                        />
                      </div>

                      {type === "meeting" && (
                        <div>
                          <label className="block text-[11px] text-[#8A92A3] mb-1">End time</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Repeat cadence (Disabled if dateStr is empty) */}
              <div className={!dateStr ? "opacity-40 pointer-events-none" : ""}>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Repeat {!dateStr && "(requires date)"}
                </label>
                <select
                  disabled={!dateStr}
                  value={repeat || ""}
                  onChange={(e) => setRepeat((e.target.value as UpcomingRepeat) || null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                >
                  <option value="">None (One-time)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-[#8A92A3] hover:text-white font-heading font-semibold text-xs uppercase tracking-wider transition-colors min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#4FA3FF] text-[#08080A] font-heading font-bold text-xs uppercase tracking-wider hover:bg-[#3fa0ff] transition-all min-h-[44px] cursor-pointer disabled:opacity-40"
                >
                  {isSaving ? "Saving..." : editingItem ? "Save changes" : "Create item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionBlockProps {
  title: string;
  titleColor?: string;
  items: FormattedUpcomingItem[];
  expandedId: number | null;
  pendingToggles: Record<number, boolean>;
  onToggleExpand: (id: number) => void;
  onToggle: (item: FormattedUpcomingItem) => void;
  onEdit: (item: FormattedUpcomingItem) => void;
  onSnooze: (id: number, duration: "1h" | "tomorrow" | "next_week") => void;
  onDelete: (id: number) => void;
}

function SectionBlock({
  title,
  titleColor = "text-[#8A92A3]",
  items,
  expandedId,
  pendingToggles,
  onToggleExpand,
  onToggle,
  onEdit,
  onSnooze,
  onDelete,
}: SectionBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className={`text-xs font-heading font-bold uppercase tracking-wider ${titleColor}`}>
          {title}
        </h3>
        <span className="text-[11px] text-[#8A92A3] font-mono">{items.length}</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const isPending = pendingToggles[item.id] || false;
          const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.todo;
          const Icon = config.icon;

          return (
            <div
              key={item.completionId ? `comp-${item.completionId}` : `item-${item.id}`}
              className={`rounded-xl bg-[#111216] border transition-all duration-200 overflow-hidden relative ${
                item.isDone
                  ? "border-white/5 opacity-60"
                  : isExpanded
                  ? "border-white/20"
                  : "border-white/10 hover:border-white/15"
              }`}
            >
              {/* Left 3px Type Stripe */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: config.color }}
              />

              {/* Main Row */}
              <div className="flex items-start gap-3 p-3 sm:p-3.5 pl-4 select-none min-h-[56px]">
                {/* 28px Round Checkbox with 44px Tap Target */}
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  disabled={isPending}
                  className="min-w-[44px] min-h-[44px] -ml-2 -mt-1 flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label={item.isDone ? "Mark as uncompleted" : "Mark as completed"}
                >
                  <div
                    className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
                      item.isDone
                        ? "bg-[#4FA3FF] border-[#4FA3FF] text-black"
                        : "border-white/20 hover:border-white/40 bg-[#1A1C22]"
                    }`}
                  >
                    {item.isDone && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </button>

                {/* Title & Metadata (Tap to toggle details) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleExpand(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleExpand(item.id);
                    }
                  }}
                  className="flex-1 min-w-0 pr-1 cursor-pointer"
                >
                  {/* Title (wraps to 2 lines, never cut off) */}
                  <h4
                    className={`text-sm font-medium leading-snug break-words ${
                      item.isDone ? "line-through text-[#8A92A3]" : "text-white"
                    }`}
                  >
                    {item.title}
                  </h4>

                  {/* Secondary info line */}
                  <div className="flex items-center flex-wrap gap-2 mt-1 text-[11px] text-[#8A92A3]">
                    {/* Type icon + label */}
                    <span className="flex items-center gap-1 font-medium">
                      <Icon className="w-3 h-3" style={{ color: config.color }} />
                      <span>{config.label}</span>
                    </span>

                    {/* Time display or relative label */}
                    {item.timeDisplay && (
                      <>
                        <span>•</span>
                        <span>{item.timeDisplay}</span>
                      </>
                    )}

                    {item.relativeLabel && (
                      <>
                        <span>•</span>
                        <span
                          className={
                            item.isOverdue
                              ? "text-[#E4101E] font-medium"
                              : item.isToday
                              ? "text-[#4FA3FF] font-medium"
                              : "text-[#8A92A3]"
                          }
                        >
                          {item.relativeLabel}
                        </span>
                      </>
                    )}

                    {/* Nearest Meeting today banner */}
                    {item.nearestMeetingLabel && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#3D7EFF]/20 text-[#6BA0FF] font-semibold text-[10px]">
                        {item.nearestMeetingLabel}
                      </span>
                    )}

                    {/* Repeat icon */}
                    {item.repeat && (
                      <span className="flex items-center gap-0.5 text-[#8A92A3] text-[10px]">
                        <RotateCw className="w-2.5 h-2.5" />
                        <span className="capitalize">{item.repeat}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <button
                  type="button"
                  onClick={() => onToggleExpand(item.id)}
                  className="p-1 text-[#8A92A3] hover:text-white transition-transform cursor-pointer"
                  aria-label="Toggle details"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Inline Accordion Details */}
              {isExpanded && (
                <div className="px-4 pb-3.5 pt-2 border-t border-white/5 bg-[#14151B] space-y-3">
                  {/* Notes */}
                  {item.notes && (
                    <div className="text-xs text-[#8A92A3] bg-[#1A1C22] p-2.5 rounded-lg border border-white/5">
                      <p className="whitespace-pre-wrap">{item.notes}</p>
                    </div>
                  )}

                  {/* Full Date & Time */}
                  <div className="text-xs text-[#8A92A3] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {item.dateStr
                        ? `${item.dateStr} ${item.timeDisplay ? `at ${item.timeDisplay}` : "(All day)"}`
                        : "No date set"}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-[#4FA3FF]" />
                        <span>Edit</span>
                      </button>

                      {/* Quick Snooze (Only if item has a date and not done) */}
                      {!item.isDone && item.dateStr && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-[#8A92A3] mr-0.5">Snooze:</span>
                          <button
                            type="button"
                            onClick={() => onSnooze(item.id, "1h")}
                            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[#8A92A3] hover:text-white cursor-pointer"
                          >
                            1h
                          </button>
                          <button
                            type="button"
                            onClick={() => onSnooze(item.id, "tomorrow")}
                            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[#8A92A3] hover:text-white cursor-pointer"
                          >
                            Tomorrow
                          </button>
                          <button
                            type="button"
                            onClick={() => onSnooze(item.id, "next_week")}
                            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[#8A92A3] hover:text-white cursor-pointer"
                          >
                            1w
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quiet Red Delete */}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="flex items-center gap-1 text-xs text-[#E4101E] hover:text-[#ff3b49] px-2 py-1 rounded-lg hover:bg-[#E4101E]/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
