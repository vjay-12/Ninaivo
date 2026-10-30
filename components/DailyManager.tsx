"use client";

import { useState } from "react";
import { Item } from "@/db/schema";
import { createItem, updateItem, deleteItem, reorderItems } from "@/app/actions/daily";
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Clock, Check, Apple, Sparkles, X } from "lucide-react";
import { formatTimeDisplay } from "@/lib/date";

export default function DailyManager({ initialItems }: { initialItems: Item[] }) {
  const [itemsList, setItemsList] = useState<Item[]>(initialItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"checklist" | "diet">("checklist");
  const [targetCount, setTargetCount] = useState(1);
  const [reminderTime, setReminderTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingItem(null);
    setName("");
    setType("checklist");
    setTargetCount(1);
    setReminderTime("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setName(item.name);
    setType(item.type as "checklist" | "diet");
    setTargetCount(item.targetCount);
    setReminderTime(item.reminderTime ? item.reminderTime.slice(0, 5) : "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          name,
          type,
          targetCount: type === "checklist" ? 1 : targetCount,
          reminderTime: reminderTime ? `${reminderTime}:00` : null,
        });
        setItemsList((prev) =>
          prev.map((i) =>
            i.id === editingItem.id
              ? {
                  ...i,
                  name,
                  type,
                  targetCount: type === "checklist" ? 1 : targetCount,
                  reminderTime: reminderTime ? `${reminderTime}:00` : null,
                }
              : i
          )
        );
      } else {
        await createItem({
          name,
          type,
          targetCount: type === "checklist" ? 1 : targetCount,
          reminderTime: reminderTime ? `${reminderTime}:00` : null,
        });
        // Reload page to reflect new item
        window.location.reload();
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this routine item?")) return;
    setItemsList((prev) => prev.filter((i) => i.id !== id));
    await deleteItem(id);
  };

  const handleToggleActive = async (item: Item) => {
    const nextActive = !item.active;
    setItemsList((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, active: nextActive } : i))
    );
    await updateItem(item.id, { active: nextActive });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsList.length) return;

    const newList = [...itemsList];
    const [moved] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, moved);

    setItemsList(newList);
    await reorderItems(newList.map((i) => i.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
            Manage Daily Items
          </h1>
          <p className="text-xs text-[#8A92A3] mt-1">
            Configure checklist routines and diet targets that repeat daily
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Item</span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {itemsList.map((item, index) => {
          const isChecklist = item.type === "checklist";
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-xl bg-[#111216] border transition-all ${
                item.active
                  ? "border-white/10 hover:border-white/20"
                  : "border-white/5 opacity-50 bg-[#08080A]"
              }`}
            >
              {/* Left Details */}
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className={`w-7 h-7 rounded-lg -skew-x-6 flex items-center justify-center shrink-0 ${
                    isChecklist ? "bg-[#4FA3FF]/20 text-[#4FA3FF]" : "bg-[#E4101E]/20 text-[#E4101E]"
                  }`}
                >
                  <div className="skew-x-6">
                    {isChecklist ? <Check className="w-4 h-4" /> : <Apple className="w-4 h-4" />}
                  </div>
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm sm:text-base truncate">
                      {item.name}
                    </p>
                    <span
                      className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isChecklist
                          ? "bg-[#4FA3FF]/10 text-[#4FA3FF] border border-[#4FA3FF]/20"
                          : "bg-[#E4101E]/10 text-[#E4101E] border border-[#E4101E]/20"
                      }`}
                    >
                      {isChecklist ? "Checklist" : `Diet (${item.targetCount})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#8A92A3] mt-1">
                    {item.reminderTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeDisplay(item.reminderTime)}
                      </span>
                    )}
                    <span>{item.active ? "Active" : "Disabled"}</span>
                  </div>
                </div>
              </div>

              {/* Actions & Reordering */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-heading font-semibold uppercase tracking-wider transition-colors min-h-[36px] ${
                    item.active
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-white/5 text-[#8A92A3] hover:text-white"
                  }`}
                >
                  {item.active ? "On" : "Off"}
                </button>

                {/* Move Up/Down */}
                <div className="flex items-center bg-[#1A1C22] rounded-lg border border-white/5">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 text-[#8A92A3] hover:text-white disabled:opacity-20 transition-colors"
                    aria-label="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === itemsList.length - 1}
                    className="p-1.5 text-[#8A92A3] hover:text-white disabled:opacity-20 transition-colors"
                    aria-label="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="p-2 text-[#8A92A3] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Edit item"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-[#8A92A3] hover:text-[#E4101E] hover:bg-[#E4101E]/10 rounded-lg transition-colors"
                  aria-label="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111216] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
            {/* Top Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 m-stripe-horizontal" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-wider text-white">
                {editingItem ? "Edit Routine Item" : "Create Routine Item"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#8A92A3] hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brush at night, Drink water"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                  Category Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType("checklist");
                      setTargetCount(1);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      type === "checklist"
                        ? "bg-[#4FA3FF]/20 border-[#4FA3FF] text-[#4FA3FF]"
                        : "bg-[#1A1C22] border-white/10 text-[#8A92A3]"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Checklist</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType("diet");
                      if (targetCount === 1) setTargetCount(3);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      type === "diet"
                        ? "bg-[#E4101E]/20 border-[#E4101E] text-[#E4101E]"
                        : "bg-[#1A1C22] border-white/10 text-[#8A92A3]"
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5" />
                    <span>Diet / Nutrition</span>
                  </button>
                </div>
              </div>

              {type === "diet" && (
                <div>
                  <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1.5">
                    Target Count per Day (1 for single tick, 3 for fruits)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#E4101E]"
                  />
                </div>
              )}

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
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center shadow-lg"
                >
                  {isSaving ? "Saving..." : editingItem ? "Update" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

