"use client";

import { useState } from "react";
import { WeeklyTask } from "@/db/schema";
import {
  WeeklyDayData,
  toggleWeeklyTaskForDate,
  createWeeklyTask,
  updateWeeklyTask,
  deleteWeeklyTask,
} from "@/app/actions/weekly";
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  ListTodo,
} from "lucide-react";
import { formatDateDisplay, formatTimeDisplay, addDaysToDate } from "@/lib/date";

interface WeeklyViewProps {
  initialSelectedDate: string;
  initialWeekDays: WeeklyDayData[];
  initialTasks: (WeeklyTask & { done: boolean })[];
  allWeeklyTasks: WeeklyTask[];
}

const WEEKDAY_LABELS = [
  { val: 1, label: "Mon" },
  { val: 2, label: "Tue" },
  { val: 3, label: "Wed" },
  { val: 4, label: "Thu" },
  { val: 5, label: "Fri" },
  { val: 6, label: "Sat" },
  { val: 0, label: "Sun" },
];

export default function WeeklyView({
  initialSelectedDate,
  initialWeekDays,
  initialTasks,
  allWeeklyTasks,
}: WeeklyViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [tasks, setTasks] = useState(initialTasks);
  const [allTasks, setAllTasks] = useState(allWeeklyTasks);
  const [activeTab, setActiveTab] = useState<"schedule" | "manage">("schedule");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WeeklyTask | null>(null);
  const [taskName, setTaskName] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);
  const [reminderTime, setReminderTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Toggle tick for selected date
  const handleToggleTask = async (taskId: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
    await toggleWeeklyTaskForDate(taskId, selectedDate);
  };

  // Change selected date
  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    // Reload with query param to fetch clean data
    const url = new URL(window.location.href);
    url.searchParams.set("date", dateStr);
    window.location.href = url.toString();
  };

  const handlePrevWeek = () => {
    const prevDate = addDaysToDate(selectedDate, -7);
    handleSelectDay(prevDate);
  };

  const handleNextWeek = () => {
    const nextDate = addDaysToDate(selectedDate, 7);
    handleSelectDay(nextDate);
  };

  const openAddModal = () => {
    setEditingTask(null);
    setTaskName("");
    setSelectedWeekdays([1, 2, 3, 4, 5]); // default weekdays
    setReminderTime("");
    setIsModalOpen(true);
  };

  const openEditModal = (task: WeeklyTask) => {
    setEditingTask(task);
    setTaskName(task.name);
    setSelectedWeekdays(task.weekdays);
    setReminderTime(task.reminderTime ? task.reminderTime.slice(0, 5) : "");
    setIsModalOpen(true);
  };

  const handleWeekdayToggle = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || selectedWeekdays.length === 0) return;

    setIsSaving(true);
    try {
      if (editingTask) {
        await updateWeeklyTask(editingTask.id, {
          name: taskName,
          weekdays: selectedWeekdays,
          reminderTime: reminderTime ? `${reminderTime}:00` : null,
        });
      } else {
        await createWeeklyTask({
          name: taskName,
          weekdays: selectedWeekdays,
          reminderTime: reminderTime ? `${reminderTime}:00` : null,
        });
      }
      window.location.reload();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this weekly recurring task?")) return;
    setAllTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteWeeklyTask(id);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
            Weekly Schedule
          </h1>
          <p className="text-xs text-[#8A92A3] mt-1">
            Tasks tied to weekdays that repeat every week
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === "schedule" ? "manage" : "schedule")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1C22] border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition-all min-h-[44px]"
          >
            <ListTodo className="w-4 h-4 text-[#4FA3FF]" />
            <span className="hidden sm:inline">
              {activeTab === "schedule" ? "Manage Tasks" : "View Schedule"}
            </span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0B3A82] to-[#4FA3FF] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {activeTab === "schedule" ? (
        <>
          {/* Week Navigator & Strip */}
          <div className="rounded-2xl bg-[#111216] border border-white/10 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading font-bold text-sm tracking-wider text-[#8A92A3] uppercase">
                Week View
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevWeek}
                  className="p-1.5 rounded-lg text-[#8A92A3] hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-white px-2">
                  {formatDateDisplay(selectedDate, { month: "short", day: "numeric" })}
                </span>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 rounded-lg text-[#8A92A3] hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Week Strip Mon to Sun */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {initialWeekDays.map((day) => {
                const isSelected = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    onClick={() => handleSelectDay(day.date)}
                    className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 rounded-xl transition-all cursor-pointer select-none min-h-[64px] ${
                      isSelected
                        ? "bg-[#1A1C22] border-2 border-[#4FA3FF] shadow-lg shadow-[#0B3A82]/20"
                        : "bg-[#08080A]/60 border border-white/5 hover:border-white/20 hover:bg-[#1A1C22]"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-heading font-semibold uppercase tracking-wider ${
                        isSelected ? "text-[#4FA3FF]" : "text-[#8A92A3]"
                      }`}
                    >
                      {day.dayShort}
                    </span>
                    <span
                      className={`text-base sm:text-lg font-heading font-extrabold mt-0.5 ${
                        isSelected ? "text-white" : day.isToday ? "text-[#4FA3FF]" : "text-[#F3F5F8]"
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {/* Dot on days that have tasks */}
                    {day.hasTasks && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          isSelected ? "bg-[#E4101E]" : "bg-[#4FA3FF]"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tasks for the Selected Day */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-[#0B3A82] rounded-sm -skew-x-12" />
                <h2 className="font-heading font-bold text-lg tracking-wider text-white uppercase">
                  Tasks for {formatDateDisplay(selectedDate, { weekday: "long", month: "short", day: "numeric" })}
                </h2>
              </div>
              <span className="text-xs text-[#8A92A3] font-heading font-semibold">
                {tasks.filter((t) => t.done).length}/{tasks.length} DONE
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#111216]/50 border border-white/5 text-center text-xs text-[#8A92A3]">
                No weekly tasks scheduled for this day. You can add one with "New Task".
              </div>
            ) : (
              <div className="grid gap-2.5">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`group flex items-center justify-between p-4 rounded-xl bg-[#111216] border transition-all cursor-pointer select-none min-h-[56px] active:scale-[0.99] ${
                      task.done
                        ? "border-white/5 bg-[#111216]/60 opacity-80"
                        : "border-white/10 hover:border-white/20 hover:bg-[#1A1C22]"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center border shrink-0 transition-colors ${
                          task.done
                            ? "bg-[#4FA3FF] border-[#4FA3FF] shadow-[0_0_10px_rgba(79,163,255,0.4)]"
                            : "border-white/20 bg-[#1A1C22] group-hover:border-white/40"
                        }`}
                      >
                        <div className="skew-x-6 flex items-center justify-center">
                          {task.done && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </div>

                      <div>
                        <p
                          className={`font-medium text-sm sm:text-base tracking-wide ${
                            task.done ? "line-through text-[#8A92A3]" : "text-white"
                          }`}
                        >
                          {task.name}
                        </p>
                        {task.reminderTime && (
                          <div className="flex items-center gap-1 text-[11px] text-[#8A92A3] mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeDisplay(task.reminderTime)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Manage All Recurring Tasks */
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <h2 className="font-heading font-bold text-lg tracking-wider text-white uppercase">
              All Recurring Tasks
            </h2>
            <span className="text-xs text-[#8A92A3]">{allTasks.length} Total</span>
          </div>

          {allTasks.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#111216]/50 border border-white/5 text-center text-xs text-[#8A92A3]">
              No weekly tasks yet. Click "New Task" above to add your first one.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {allTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#111216] border border-white/10 hover:border-white/20"
                >
                  <div>
                    <p className="font-medium text-white text-base">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {WEEKDAY_LABELS.map((w) => {
                        const active = t.weekdays.includes(w.val);
                        return (
                          <span
                            key={w.val}
                            className={`text-[10px] font-heading font-bold px-1.5 py-0.5 rounded ${
                              active
                                ? "bg-[#4FA3FF]/20 text-[#4FA3FF] border border-[#4FA3FF]/40"
                                : "bg-white/5 text-[#8A92A3]/50"
                            }`}
                          >
                            {w.label}
                          </span>
                        );
                      })}
                      {t.reminderTime && (
                        <span className="text-xs text-[#8A92A3] ml-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeDisplay(t.reminderTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="p-2 text-[#8A92A3] hover:text-[#E4101E] rounded-lg hover:bg-[#E4101E]/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111216] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 m-stripe-horizontal" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-wider text-white">
                {editingTask ? "Edit Weekly Task" : "New Weekly Task"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#8A92A3] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean car, Review finances, Laundry"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Repeat On Weekdays *
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((d) => {
                    const isSelected = selectedWeekdays.includes(d.val);
                    return (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => handleWeekdayToggle(d.val)}
                        className={`py-2 rounded-lg text-xs font-heading font-bold uppercase tracking-wider border transition-all ${
                          isSelected
                            ? "bg-[#4FA3FF] text-white border-[#4FA3FF]"
                            : "bg-[#1A1C22] text-[#8A92A3] border-white/10 hover:border-white/30"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Reminder Time (Optional)
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-[#1A1C22] hover:bg-white/10 text-[#8A92A3] font-heading font-semibold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || selectedWeekdays.length === 0}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center shadow-lg disabled:opacity-40"
                >
                  {isSaving ? "Saving..." : editingTask ? "Update" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

