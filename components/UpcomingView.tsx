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
  Briefcase,
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

interface UpcomingViewProps {
  initialData: UpcomingGroupedData;
}

const TYPE_CONFIG = {
  work: {
    label: "Work",
    icon: Briefcase,
    color: "#4FA3FF", // Light Blue
    borderClass: "border-l-[#4FA3FF]",
    bgClass: "bg-[#4FA3FF]/10 text-[#4FA3FF]",
  },
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
  const [typeFilters, setTypeFilters] = useState<UpcomingType[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Sheet / Modal state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormattedUpcomingItem | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<UpcomingType>("todo");
  const [dateStr, setDateStr] = useState(getTodayDateString());
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
    setDateStr(item.dateStr);
    setHasTime(item.hasTime);

    const d = new Date(item.dueAt);
    setStartTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    );

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

    if (hasTime) {
      maybeRequestNotificationPermission();
    }

    setIsSaving(true);
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dueDate = new Date();
      dueDate.setFullYear(y, m - 1, d);

      if (hasTime) {
        const [sh, sm] = startTime.split(":").map(Number);
        dueDate.setHours(sh || 9, sm || 0, 0, 0);
      } else {
        dueDate.setHours(9, 0, 0, 0); // All day standard morning time
      }

      let endDate: Date | null = null;
      if (hasTime && type === "meeting") {
        const [eh, em] = endTime.split(":").map(Number);
        endDate = new Date(dueDate);
        endDate.setHours(eh || 9, em || 30, 0, 0);
      }

      if (editingItem) {
        await updateUpcomingItem(editingItem.id, {
          title,
          type,
          dueAt: dueDate.toISOString(),
          endAt: endDate ? endDate.toISOString() : null,
          hasTime,
          repeat,
          notes: notes || null,
        });
      } else {
        await createUpcomingItem({
          title,
          type,
          dueAt: dueDate.toISOString(),
          endAt: endDate ? endDate.toISOString() : null,
          hasTime,
          repeat,
          notes: notes || null,
        });
      }

      window.location.reload();
    } finally {
      setIsSaving(false);
    }
  };

  // Optimistic Toggle Checkbox
  const handleToggle = async (item: FormattedUpcomingItem) => {
    const nextDone = !item.isDone;
    setPendingToggles((prev) => ({ ...prev, [item.id]: nextDone }));

    try {
      if (item.isDone) {
        await undoUpcomingCompletion(item.id, item.completionId);
      } else {
        await toggleUpcomingDone(item.id);
      }
      window.location.reload();
    } catch {
      // Revert on error
      setPendingToggles((prev) => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
    }
  };

  // Snooze
  const handleSnooze = async (id: number, option: "1hour" | "tomorrow" | "next_week") => {
    await snoozeUpcomingItem(id, option);
    window.location.reload();
  };

  // Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this item? Its history will also be removed")) return;
    await deleteUpcomingItem(id);
    window.location.reload();
  };

  // Toggle Type Filter Chip
  const toggleTypeFilter = (t: UpcomingType) => {
    setTypeFilters((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  // Filter items based on active time filter and multi-select type filters
  const filterList = (items: FormattedUpcomingItem[]) => {
    if (typeFilters.length === 0) return items;
    return items.filter((i) => typeFilters.includes(i.type));
  };

  const overdueItems = useMemo(() => filterList(data.overdue), [data.overdue, typeFilters]);
  const todayItems = useMemo(() => filterList(data.today), [data.today, typeFilters]);
  const tomorrowItems = useMemo(() => filterList(data.tomorrow), [data.tomorrow, typeFilters]);
  const thisWeekItems = useMemo(() => filterList(data.thisWeek), [data.thisWeek, typeFilters]);
  const laterItems = useMemo(() => filterList(data.later), [data.later, typeFilters]);
  const doneItems = useMemo(() => filterList(data.done), [data.done, typeFilters]);

  const isEmpty =
    timeFilter === "done"
      ? doneItems.length === 0
      : overdueItems.length === 0 &&
        todayItems.length === 0 &&
        tomorrowItems.length === 0 &&
        thisWeekItems.length === 0 &&
        laterItems.length === 0;

  return (
    <div className="space-y-5">
      {/* 1. Header: "Upcoming" Title + "+ Add" Button */}
      <div className="flex items-center justify-between gap-3 min-h-[40px]">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase leading-none">
          Upcoming
        </h1>
        <button
          type="button"
          onClick={openAddSheet}
          className="shrink-0 h-10 px-4 rounded-lg bg-[#4FA3FF] hover:bg-[#3fa0ff] text-[#08080A] font-semibold text-xs whitespace-nowrap active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
          <span>+ Add</span>
        </button>
      </div>

      {/* 2. Filter Row 1 (Time Filters: All, Today, This week, Later, Done) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
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
              className={`h-8 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
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

      {/* 3. Filter Row 2 (Type Filters: Work, Meeting, Reminder, Todo - Multi-select) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
        {(["work", "meeting", "reminder", "todo"] as UpcomingType[]).map((t) => {
          const isSelected = typeFilters.includes(t);
          const config = TYPE_CONFIG[t];
          const Icon = config.icon;

          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTypeFilter(t)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
                isSelected
                  ? "bg-[#1C1F28] text-white border-white/20"
                  : "bg-transparent text-[#8A92A3] border-white/5 hover:border-white/10"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <Icon className="w-3 h-3" />
              <span>{config.label}</span>
            </button>
          );
        })}
        {typeFilters.length > 0 && (
          <button
            type="button"
            onClick={() => setTypeFilters([])}
            className="text-[11px] text-[#8A92A3] hover:text-white px-1 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. List Sections */}
      {isEmpty ? (
        <div className="p-8 rounded-xl bg-[#111216] border border-white/5 text-center space-y-3">
          <p className="text-xs text-[#8A92A3]">
            {timeFilter === "done" ? "No completed items in the last 30 days." : "No upcoming items."}
          </p>
          {timeFilter !== "done" && (
            <button
              type="button"
              onClick={openAddSheet}
              className="text-xs text-[#4FA3FF] hover:underline font-medium"
            >
              + Add an item
            </button>
          )}
        </div>
      ) : timeFilter === "done" ? (
        /* Done Section */
        <SectionBlock
          title="Completed (Last 30 days)"
          items={doneItems}
          expandedId={expandedId}
          pendingToggles={pendingToggles}
          onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          onToggleDone={handleToggle}
          onEdit={openEditSheet}
          onSnooze={handleSnooze}
          onDelete={handleDelete}
        />
      ) : (
        /* Active Sections: Overdue, Today, Tomorrow, This week, Later */
        <div className="space-y-5">
          {(timeFilter === "all" || timeFilter === "today") && overdueItems.length > 0 && (
            <SectionBlock
              title={`Overdue (${overdueItems.length})`}
              titleColor="#E4101E"
              items={overdueItems}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggleDone={handleToggle}
              onEdit={openEditSheet}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          )}

          {(timeFilter === "all" || timeFilter === "today") && todayItems.length > 0 && (
            <SectionBlock
              title="Today"
              items={todayItems}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggleDone={handleToggle}
              onEdit={openEditSheet}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          )}

          {(timeFilter === "all" || timeFilter === "this_week") && tomorrowItems.length > 0 && (
            <SectionBlock
              title="Tomorrow"
              items={tomorrowItems}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggleDone={handleToggle}
              onEdit={openEditSheet}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          )}

          {(timeFilter === "all" || timeFilter === "this_week") && thisWeekItems.length > 0 && (
            <SectionBlock
              title="This week"
              items={thisWeekItems}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggleDone={handleToggle}
              onEdit={openEditSheet}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          )}

          {(timeFilter === "all" || timeFilter === "later") && laterItems.length > 0 && (
            <SectionBlock
              title="Later"
              items={laterItems}
              expandedId={expandedId}
              pendingToggles={pendingToggles}
              onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onToggleDone={handleToggle}
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSheetOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg bg-[#111216] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">
                {editingItem ? "Edit item" : "Add item"}
              </h2>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="p-1 text-[#8A92A3] hover:text-white rounded-lg transition-colors"
                aria-label="Close sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-left">
              {/* Title Input with Quick-Add parsing */}
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Design review tomorrow 4pm, Client meeting fri"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              {/* Type Selector (4 segmented options) */}
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1">
                  Type
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#14151B] border border-white/10 rounded-lg">
                  {(["work", "meeting", "reminder", "todo"] as UpcomingType[]).map((t) => {
                    const isSelected = type === t;
                    const config = TYPE_CONFIG[t];
                    const Icon = config.icon;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          isSelected
                            ? "bg-[#1E222D] text-white shadow-sm font-semibold"
                            : "text-[#8A92A3] hover:text-white"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                        <span className="capitalize">{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              {/* Time Section with All-Day Switch */}
              <div className="space-y-2 p-3 bg-[#14151B] border border-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">All day</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!hasTime}
                    onClick={() => setHasTime(!hasTime)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      !hasTime ? "bg-[#4FA3FF]" : "bg-[#232630]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        !hasTime ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {hasTime && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-[11px] text-[#8A92A3] mb-1">
                        Start time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#1C1F28] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
                      />
                    </div>

                    {type === "meeting" && (
                      <div>
                        <label className="block text-[11px] text-[#8A92A3] mb-1">
                          End time
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#1C1F28] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Repeat Selector (None / Daily / Weekly / Monthly) */}
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1">
                  Repeat
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#14151B] border border-white/10 rounded-lg">
                  {[
                    { val: null, label: "None" },
                    { val: "daily" as const, label: "Daily" },
                    { val: "weekly" as const, label: "Weekly" },
                    { val: "monthly" as const, label: "Monthly" },
                  ].map((r) => {
                    const isSelected = repeat === r.val;
                    return (
                      <button
                        key={String(r.val)}
                        type="button"
                        onClick={() => setRepeat(r.val)}
                        className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-[#1E222D] text-white shadow-sm font-semibold"
                            : "text-[#8A92A3] hover:text-white"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Meeting link, context, details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF] resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-[#14151B] hover:bg-white/5 border border-white/10 text-[#8A92A3] hover:text-white font-medium text-xs transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[#4FA3FF] hover:bg-[#3fa0ff] text-[#08080A] font-semibold text-xs transition-colors min-h-[40px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : editingItem ? "Update item" : "Save item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Section Block for Grouped Lists
 */
interface SectionBlockProps {
  title: string;
  titleColor?: string;
  items: FormattedUpcomingItem[];
  expandedId: number | null;
  pendingToggles: Record<number, boolean>;
  onToggleExpand: (id: number) => void;
  onToggleDone: (item: FormattedUpcomingItem) => void;
  onEdit: (item: FormattedUpcomingItem) => void;
  onSnooze: (id: number, option: "1hour" | "tomorrow" | "next_week") => void;
  onDelete: (id: number) => void;
}

function SectionBlock({
  title,
  titleColor,
  items,
  expandedId,
  pendingToggles,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onSnooze,
  onDelete,
}: SectionBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider pl-1"
        style={{ color: titleColor || "#8A92A3" }}
      >
        {title}
      </h2>

      <div className="space-y-2">
        {items.map((item) => {
          const config = TYPE_CONFIG[item.type];
          const TypeIcon = config.icon;
          const isExpanded = expandedId === item.id;
          const isDone = pendingToggles[item.id] !== undefined ? pendingToggles[item.id] : item.isDone;

          return (
            <div
              key={`${item.id}-${item.completionId || "main"}`}
              className={`rounded-xl bg-[#111216] border transition-all duration-200 overflow-hidden relative ${
                isExpanded ? "border-white/20" : "border-white/10 hover:border-white/15"
              } ${isDone ? "opacity-60 bg-[#0B0C10]" : ""}`}
            >
              {/* Thin 3px Left Edge Stripe in Type Colour */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: config.color }}
              />

              {/* Row Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(item.id)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 min-h-[56px] cursor-pointer select-none text-left pl-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  {/* Round Checkbox (28px visual, 44px tap target area) */}
                  <div
                    role="checkbox"
                    aria-checked={isDone}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone(item);
                    }}
                    className="w-11 h-11 -ml-2 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-150 ${
                        isDone
                          ? "bg-[#4FA3FF] border-[#4FA3FF] text-[#08080A]"
                          : "border-white/20 hover:border-white/40 bg-[#16181F]"
                      }`}
                    >
                      {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Title & Secondary Line */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium text-sm sm:text-base leading-snug break-words line-clamp-2 transition-all ${
                        isDone ? "line-through text-[#8A92A3]" : "text-white"
                      }`}
                    >
                      {item.title}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-[#8A92A3] mt-0.5 flex-wrap">
                      {/* Type Icon & Label */}
                      <span className="flex items-center gap-1 shrink-0">
                        <TypeIcon className="w-3 h-3" style={{ color: config.color }} />
                        <span>{config.label}</span>
                      </span>

                      <span>•</span>

                      {/* Time display */}
                      <span className="shrink-0">{item.timeDisplay}</span>

                      {/* Relative Label */}
                      <span className="shrink-0 text-[#8A92A3]/80">({item.relativeLabel})</span>

                      {/* Repeat Icon */}
                      {item.repeat && (
                        <span className="flex items-center gap-1 text-[11px] text-[#4FA3FF] shrink-0" title={`Repeats ${item.repeat}`}>
                          <RotateCw className="w-3 h-3" />
                          <span className="capitalize">{item.repeat}</span>
                        </span>
                      )}

                      {/* Nearest Meeting Label ("Next, in 45 min") */}
                      {item.nearestMeetingLabel && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3D7EFF]/20 text-[#6BA0FF] border border-[#3D7EFF]/30 shrink-0">
                          {item.nearestMeetingLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                  className={`w-4 h-4 text-[#8A92A3] shrink-0 transition-transform duration-200 ${
                    isExpanded ? "rotate-180 text-white" : ""
                  }`}
                />
              </div>

              {/* Inline Accordion Details */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-[#0D0E12] p-4 space-y-3.5 transition-all duration-200 pl-4">
                  {/* Full Date & Time */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#14151B] border border-white/5 rounded-lg p-2.5">
                      <span className="text-[#8A92A3] block text-[11px]">Date</span>
                      <span className="text-white font-medium mt-0.5 block">
                        {item.dateStr}
                      </span>
                    </div>
                    <div className="bg-[#14151B] border border-white/5 rounded-lg p-2.5">
                      <span className="text-[#8A92A3] block text-[11px]">Time</span>
                      <span className="text-white font-medium mt-0.5 block">
                        {item.timeDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                    <div className="bg-[#14151B] border border-white/5 rounded-lg p-2.5 text-xs">
                      <span className="text-[#8A92A3] block text-[11px] mb-0.5">Notes</span>
                      <p className="text-white whitespace-pre-wrap">{item.notes}</p>
                    </div>
                  )}

                  {/* Bottom Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Edit Button */}
                      {!isDone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] hover:bg-white/5 border border-white/10 text-white text-xs font-medium transition-colors min-h-[34px]"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#8A92A3]" />
                          <span>Edit</span>
                        </button>
                      )}

                      {/* Snooze Options */}
                      {!isDone && (
                        <div className="flex items-center bg-[#14151B] border border-white/10 rounded-lg overflow-hidden text-xs">
                          <span className="px-2 text-[11px] text-[#8A92A3]">Snooze:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSnooze(item.id, "1hour");
                            }}
                            className="px-2 py-1.5 hover:bg-white/5 text-white transition-colors"
                            title="Snooze 1 hour"
                          >
                            1h
                          </button>
                          <div className="w-[1px] h-3.5 bg-white/10" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSnooze(item.id, "tomorrow");
                            }}
                            className="px-2 py-1.5 hover:bg-white/5 text-white transition-colors"
                            title="Snooze to tomorrow"
                          >
                            Tmrw
                          </button>
                          <div className="w-[1px] h-3.5 bg-white/10" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSnooze(item.id, "next_week");
                            }}
                            className="px-2 py-1.5 hover:bg-white/5 text-white transition-colors"
                            title="Snooze 1 week"
                          >
                            1w
                          </button>
                        </div>
                      )}

                      {/* Undo Completed Button */}
                      {isDone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleDone(item);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] hover:bg-white/5 border border-white/10 text-white text-xs font-medium transition-colors min-h-[34px]"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#4FA3FF]" />
                          <span>Undo complete</span>
                        </button>
                      )}
                    </div>

                    {/* Delete Quiet Red Text Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#E4101E]/80 hover:text-[#E4101E] hover:bg-[#E4101E]/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

