"use client";

import { useState } from "react";
import { FutureReminder } from "@/db/schema";
import {
  FutureGroupsData,
  toggleFutureDoneAction,
  createFutureReminder,
  updateFutureReminder,
  deleteFutureReminder,
} from "@/app/actions/future";
import {
  Clock,
  Plus,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  FileText,
} from "lucide-react";

export default function FutureView({ initialData }: { initialData: FutureGroupsData }) {
  const [groups, setGroups] = useState<FutureGroupsData>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FutureReminder | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDateTime, setDueDateTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingItem(null);
    setTitle("");
    setNotes("");
    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDueDateTime(localIso);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FutureReminder) => {
    setEditingItem(item);
    setTitle(item.title);
    setNotes(item.notes || "");
    const d = new Date(item.dueAt);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDueDateTime(localIso);
    setIsModalOpen(true);
  };

  const handleToggleDone = async (id: number) => {
    // Optimistic toggle
    await toggleFutureDoneAction(id);
    window.location.reload();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    await deleteFutureReminder(id);
    window.location.reload();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDateTime) return;

    setIsSaving(true);
    try {
      const dueAtIso = new Date(dueDateTime).toISOString();
      if (editingItem) {
        await updateFutureReminder(editingItem.id, {
          title,
          notes,
          dueAt: dueAtIso,
        });
      } else {
        await createFutureReminder({
          title,
          notes,
          dueAt: dueAtIso,
        });
      }
      window.location.reload();
    } finally {
      setIsSaving(false);
    }
  };

  const formatReminderDate = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
            Future Reminders
          </h1>
          <p className="text-xs text-[#8A92A3] mt-1">
            One-off reminders, scheduled deadlines and future to-dos
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4FA3FF] via-[#0B3A82] to-[#E4101E] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </button>
      </div>

      {/* 1. Overdue Group */}
      {groups.overdue.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#E4101E]/30">
            <div className="flex items-center gap-2 text-[#E4101E]">
              <AlertTriangle className="w-4 h-4" />
              <h2 className="font-heading font-bold text-base uppercase tracking-wider">
                Overdue ({groups.overdue.length})
              </h2>
            </div>
          </div>

          <div className="grid gap-2.5">
            {groups.overdue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#111216] border border-[#E4101E]/40 shadow-[0_0_12px_rgba(228,16,30,0.1)] transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(item.id)}
                    className="w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center border border-[#E4101E]/50 bg-[#1A1C22] hover:bg-[#E4101E]/20 transition-colors shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#E4101E]" />
                  </button>
                  <div className="truncate">
                    <p className="font-medium text-white text-sm sm:text-base truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#E4101E] mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>Due: {formatReminderDate(item.dueAt)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-[#8A92A3] mt-1 truncate">{item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-[#8A92A3] hover:text-[#E4101E] rounded-lg hover:bg-[#E4101E]/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Today Group */}
      {groups.today.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div className="flex items-center gap-2 text-[#4FA3FF]">
              <div className="w-2 h-4 bg-[#4FA3FF] rounded-sm -skew-x-12" />
              <h2 className="font-heading font-bold text-base uppercase tracking-wider text-white">
                Due Today ({groups.today.length})
              </h2>
            </div>
          </div>

          <div className="grid gap-2.5">
            {groups.today.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#111216] border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(item.id)}
                    className="w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center border border-white/20 bg-[#1A1C22] hover:bg-[#4FA3FF]/20 hover:border-[#4FA3FF] transition-colors shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#4FA3FF]" />
                  </button>
                  <div className="truncate">
                    <p className="font-medium text-white text-sm sm:text-base truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#4FA3FF] mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatReminderDate(item.dueAt)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-[#8A92A3] mt-1 truncate">{item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-[#8A92A3] hover:text-[#E4101E] rounded-lg hover:bg-[#E4101E]/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Upcoming Group */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-4 bg-[#0B3A82] rounded-sm -skew-x-12" />
            <h2 className="font-heading font-bold text-base uppercase tracking-wider text-white">
              Upcoming ({groups.upcoming.length})
            </h2>
          </div>
        </div>

        {groups.upcoming.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#111216]/50 border border-white/5 text-center text-xs text-[#8A92A3]">
            No upcoming reminders. Click "New Reminder" to schedule one.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {groups.upcoming.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#111216] border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(item.id)}
                    className="w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center border border-white/20 bg-[#1A1C22] hover:bg-white/10 transition-colors shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#8A92A3]" />
                  </button>
                  <div className="truncate">
                    <p className="font-medium text-white text-sm sm:text-base truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#8A92A3] mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>{formatReminderDate(item.dueAt)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-[#8A92A3] mt-1 truncate">{item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 text-[#8A92A3] hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-[#8A92A3] hover:text-[#E4101E] rounded-lg hover:bg-[#E4101E]/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Done Group */}
      {groups.done.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <h2 className="font-heading font-bold text-base uppercase tracking-wider text-[#8A92A3]">
              Completed ({groups.done.length})
            </h2>
          </div>

          <div className="grid gap-2.5">
            {groups.done.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#08080A] border border-white/5 opacity-70 hover:opacity-100 transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(item.id)}
                    className="w-6 h-6 rounded-lg -skew-x-6 flex items-center justify-center bg-[#4FA3FF] text-white shrink-0"
                    title="Click to mark incomplete"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="truncate">
                    <p className="font-medium text-sm text-[#8A92A3] line-through truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#8A92A3]/60">
                      Completed {formatReminderDate(item.doneAt!)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-[#8A92A3]/50 hover:text-[#E4101E] rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add / Edit Reminder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111216] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 m-stripe-horizontal" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-wider text-white">
                {editingItem ? "Edit Reminder" : "New Future Reminder"}
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
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Car service, Dentist appointment, Renew passport"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Due Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dueDateTime}
                  onChange={(e) => setDueDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Notes / Details (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional context, location, checklist..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF] resize-none"
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
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center shadow-lg"
                >
                  {isSaving ? "Saving..." : editingItem ? "Update" : "Create Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

