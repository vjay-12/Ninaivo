"use client";

import { useState } from "react";
import ProgressRing from "@/components/ProgressRing";
import CheckRow from "@/components/CheckRow";
import CounterPips from "@/components/CounterPips";
import InAppReminderBanner from "@/components/InAppReminderBanner";
import { setItemCount, toggleWeeklyLog, toggleFutureDone, TodayItemData, TodayWeeklyTaskData, TodayFutureReminderData } from "@/app/actions/today";
import { formatDateDisplay, formatTimeDisplay } from "@/lib/date";
import { Bell, Calendar, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { localDb } from "@/lib/db-local";
import { syncEngine } from "@/lib/sync";

interface TodayDashboardProps {
  initialDate: string;
  checklistItems: TodayItemData[];
  dietItems: TodayItemData[];
  weeklyToday: TodayWeeklyTaskData[];
  reminders: TodayFutureReminderData[];
}

export default function TodayDashboard({
  initialDate,
  checklistItems: initialChecklist,
  dietItems: initialDiet,
  weeklyToday: initialWeekly,
  reminders: initialReminders,
}: TodayDashboardProps) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [diet, setDiet] = useState(initialDiet);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [futureReminders, setFutureReminders] = useState(initialReminders);

  // Calculate totals
  const totalItems = checklist.length + diet.length + futureReminders.length;
  const completedItems =
    checklist.filter((i) => i.done).length +
    diet.filter((i) => i.done).length +
    futureReminders.filter((r) => r.doneAt).length;

  // Toggle checklist or diet item count
  const handleItemCountUpdate = async (id: number, count: number, targetCount: number, type: "checklist" | "diet") => {
    const isDone = count >= targetCount;
    if (type === "checklist") {
      setChecklist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, count, done: isDone } : item))
      );
    } else {
      setDiet((prev) =>
        prev.map((item) => (item.id === id ? { ...item, count, done: isDone } : item))
      );
    }

    const foundItem = (type === "checklist" ? checklist : diet).find((i) => i.id === id);
    const logUuid = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    if (localDb) {
      try {
        await localDb.dailyLogs.put({
          uuid: logUuid,
          itemId: id,
          itemUuid: foundItem?.uuid || "",
          logDate: initialDate,
          count,
          done: isDone,
          updatedAt: nowIso,
        });
      } catch {}
    }

    if (syncEngine) {
      syncEngine.queueLocalWrite("daily_logs", "insert", {
        uuid: logUuid,
        itemId: id,
        itemUuid: foundItem?.uuid || "",
        logDate: initialDate,
        count,
        done: isDone,
        updatedAt: nowIso,
      });
    }

    try {
      await setItemCount(id, count, targetCount, initialDate);
    } catch {
      // Offline mode: queued in outbox
    }
  };

  // Toggle weekly task
  const handleWeeklyToggle = async (taskId: number) => {
    setWeekly((prev) =>
      prev.map((w) => (w.id === taskId ? { ...w, done: !w.done } : w))
    );
    try {
      await toggleWeeklyLog(taskId, initialDate);
    } catch {}
  };

  // Toggle future reminder
  const handleFutureToggle = async (id: number) => {
    setFutureReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, doneAt: r.doneAt ? null : new Date() } : r))
    );

    const found = futureReminders.find((r) => r.id === id);
    const isCurrentlyDone = !!found?.doneAt;
    const nowIso = new Date().toISOString();

    if (localDb) {
      try {
        const localUp = await localDb.upcomingItems.where("id").equals(id).first();
        if (localUp) {
          await localDb.upcomingItems.update(localUp.uuid, {
            doneAt: isCurrentlyDone ? null : nowIso,
            updatedAt: nowIso,
          });
          syncEngine?.queueLocalWrite("upcoming_items", "update", {
            uuid: localUp.uuid,
            doneAt: isCurrentlyDone ? null : nowIso,
            updatedAt: nowIso,
          });
        }
      } catch {}
    }

    try {
      await toggleFutureDone(id);
    } catch {
      // Offline mode: queued in outbox
    }
  };

  // Build active in-app notices for banner
  const dueNotices = [
    ...weekly
      .filter((w) => !w.done && w.reminderTime)
      .map((w) => ({
        id: `weekly-${w.id}`,
        title: `Weekly reminder: ${w.name}`,
        time: formatTimeDisplay(w.reminderTime),
        type: "weekly" as const,
      })),
    ...futureReminders
      .filter((r) => !r.doneAt)
      .map((r) => ({
        id: `future-${r.id}`,
        title: r.title,
        time: new Date(r.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "future" as const,
      })),
  ];

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* In-App Reminder Banner */}
      <InAppReminderBanner notices={dueNotices} />

      {/* Top Hero Card with BMW M Stripe */}
      <div className="relative overflow-hidden rounded-2xl bg-[#111216] border border-white/10 p-5 sm:p-6 shadow-xl">
        {/* Slanted Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 m-stripe-horizontal" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pt-1">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-heading uppercase tracking-widest text-[#4FA3FF] mb-2 font-semibold">
              <Sparkles className="w-3 h-3 text-[#4FA3FF]" />
              <span>Routine Active</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
              {greeting}
            </h1>
            <p className="text-sm text-[#8A92A3] mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateDisplay(initialDate)}</span>
            </p>
          </div>

          <div className="flex items-center self-center sm:self-auto">
            <ProgressRing completed={completedItems} total={totalItems} />
          </div>
        </div>

        {/* 100% Day Celebration Notice */}
        {totalItems > 0 && completedItems === totalItems && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-[#4FA3FF]/15 via-[#0B3A82]/15 to-[#E4101E]/15 border border-[#4FA3FF]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#4FA3FF]" />
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-white">
                All daily routines completed today! 100% Score.
              </span>
            </div>
            <div className="w-12 h-1.5 m-stripe-horizontal rounded-full" />
          </div>
        )}
      </div>

      {/* Checklist Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-4 bg-[#4FA3FF] rounded-sm -skew-x-12" />
            <h2 className="font-heading font-bold text-lg tracking-wider text-white uppercase">
              Checklist
            </h2>
          </div>
          <span className="text-xs text-[#8A92A3] font-heading font-semibold">
            {checklist.filter((i) => i.done).length}/{checklist.length} DONE
          </span>
        </div>

        {checklist.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#111216]/50 border border-white/5 text-center text-xs text-[#8A92A3]">
            No checklist items configured. Add one in the Daily tab.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {checklist.map((item) => (
              <CheckRow
                key={item.id}
                id={item.id}
                name={item.name}
                type="checklist"
                targetCount={item.targetCount}
                currentCount={item.count}
                done={item.done}
                streak={item.streak}
                reminderTime={item.reminderTime}
                onToggle={async (id, nextCount) => {
                  await handleItemCountUpdate(id, nextCount, item.targetCount, "checklist");
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Diet Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-4 bg-[#E4101E] rounded-sm -skew-x-12" />
            <h2 className="font-heading font-bold text-lg tracking-wider text-white uppercase">
              Diet &amp; Nutrition
            </h2>
          </div>
          <span className="text-xs text-[#8A92A3] font-heading font-semibold">
            {diet.filter((i) => i.done).length}/{diet.length} DONE
          </span>
        </div>

        {diet.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#111216]/50 border border-white/5 text-center text-xs text-[#8A92A3]">
            No diet items configured. Add one in the Daily tab.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {diet.map((item) => {
              if (item.targetCount > 1) {
                return (
                  <CounterPips
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    targetCount={item.targetCount}
                    initialCount={item.count}
                    streak={item.streak}
                    onUpdate={async (id, count) => {
                      await handleItemCountUpdate(id, count, item.targetCount, "diet");
                    }}
                  />
                );
              }
              return (
                <CheckRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  type="diet"
                  targetCount={item.targetCount}
                  currentCount={item.count}
                  done={item.done}
                  streak={item.streak}
                  reminderTime={item.reminderTime}
                  onToggle={async (id, nextCount) => {
                    await handleItemCountUpdate(id, nextCount, item.targetCount, "diet");
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Reminders Due Today (Weekly Tasks & Future Reminders) */}
      {(weekly.length > 0 || futureReminders.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-4 bg-[#0B3A82] rounded-sm -skew-x-12" />
              <h2 className="font-heading font-bold text-lg tracking-wider text-white uppercase">
                Reminders Due Today
              </h2>
            </div>
            <span className="text-xs text-[#8A92A3] font-heading font-semibold">
              {weekly.filter((w) => w.done).length + futureReminders.filter((r) => r.doneAt).length}/
              {weekly.length + futureReminders.length}
            </span>
          </div>

          <div className="grid gap-2.5">
            {/* Weekly Tasks for Today */}
            {weekly.map((task) => (
              <div
                key={`weekly-${task.id}`}
                onClick={() => handleWeeklyToggle(task.id)}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#111216] border transition-all cursor-pointer select-none min-h-[52px] ${
                  task.done
                    ? "border-white/5 bg-[#111216]/60 opacity-80"
                    : "border-white/10 hover:border-white/20 hover:bg-[#1A1C22]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-md -skew-x-6 flex items-center justify-center border shrink-0 ${
                      task.done
                        ? "bg-[#4FA3FF] border-[#4FA3FF]"
                        : "border-white/20 bg-[#1A1C22]"
                    }`}
                  >
                    {task.done && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <span
                      className={`text-sm font-medium ${
                        task.done ? "line-through text-[#8A92A3]" : "text-white"
                      }`}
                    >
                      {task.name}
                    </span>
                    <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-white/5 text-[#8A92A3] uppercase tracking-wider font-semibold">
                      Weekly
                    </span>
                  </div>
                </div>

                {task.reminderTime && (
                  <span className="text-xs text-[#8A92A3] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeDisplay(task.reminderTime)}
                  </span>
                )}
              </div>
            ))}

            {/* Future Reminders Due Today */}
            {futureReminders.map((reminder) => {
              const isDone = !!reminder.doneAt;
              return (
                <div
                  key={`future-${reminder.id}`}
                  onClick={() => handleFutureToggle(reminder.id)}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#111216] border transition-all cursor-pointer select-none min-h-[52px] ${
                    isDone
                      ? "border-white/5 bg-[#111216]/60 opacity-80"
                      : "border-[#E4101E]/30 bg-[#1A1C22]/80 hover:border-[#E4101E]/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-md -skew-x-6 flex items-center justify-center border shrink-0 ${
                        isDone
                          ? "bg-[#E4101E] border-[#E4101E]"
                          : "border-white/20 bg-[#1A1C22]"
                      }`}
                    >
                      {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          isDone ? "line-through text-[#8A92A3]" : "text-white"
                        }`}
                      >
                        {reminder.title}
                      </span>
                      {reminder.notes && (
                        <p className="text-xs text-[#8A92A3] truncate max-w-xs">
                          {reminder.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-[#E4101E] font-medium flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {new Date(reminder.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

