"use client";

import { useState } from "react";
import { Item } from "@/db/schema";
import { createItem, updateItem, deleteItem, reorderItems } from "@/app/actions/daily";
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Apple,
  X,
  ChevronDown,
} from "lucide-react";
import { formatTimeDisplay } from "@/lib/date";
import { localDb } from "@/lib/db-local";
import { syncEngine } from "@/lib/sync";

export default function DailyManager({ initialItems }: { initialItems: Item[] }) {
  const [itemsList, setItemsList] = useState<Item[]>(initialItems);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"checklist" | "diet">("checklist");
  const [targetCount, setTargetCount] = useState(1);
  const [reminderTime, setReminderTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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
      const nowIso = new Date().toISOString();
      const finalTarget = type === "checklist" ? 1 : targetCount;
      const finalReminder = reminderTime ? `${reminderTime}:00` : null;

      if (editingItem) {
        setItemsList((prev) =>
          prev.map((i) =>
            i.id === editingItem.id
              ? {
                  ...i,
                  name,
                  type,
                  targetCount: finalTarget,
                  reminderTime: finalReminder,
                  updatedAt: new Date(),
                }
              : i
          )
        );

        if (localDb) {
          try {
            await localDb.items.update(editingItem.uuid, {
              name,
              type,
              targetCount: finalTarget,
              reminderTime: finalReminder,
              updatedAt: nowIso,
            });
          } catch {}
        }
        if (syncEngine) {
          syncEngine.queueLocalWrite("items", "update", {
            uuid: editingItem.uuid,
            name,
            type,
            targetCount: finalTarget,
            reminderTime: finalReminder,
            updatedAt: nowIso,
          });
        }

        try {
          await updateItem(editingItem.id, {
            name,
            type,
            targetCount: finalTarget,
            reminderTime: finalReminder,
          });
        } catch {}
      } else {
        const itemUuid = crypto.randomUUID();
        const fakeId = Date.now();
        const newItem: Item = {
          id: fakeId,
          uuid: itemUuid,
          name,
          type,
          targetCount: finalTarget,
          reminderTime: finalReminder,
          sortOrder: itemsList.length,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        setItemsList((prev) => [...prev, newItem]);

        if (localDb) {
          try {
            await localDb.items.put({
              id: fakeId,
              uuid: itemUuid,
              name,
              type,
              targetCount: finalTarget,
              reminderTime: finalReminder,
              sortOrder: itemsList.length,
              active: true,
              createdAt: nowIso,
              updatedAt: nowIso,
              deletedAt: null,
            });
          } catch {}
        }
        if (syncEngine) {
          syncEngine.queueLocalWrite("items", "insert", {
            uuid: itemUuid,
            name,
            type,
            targetCount: finalTarget,
            reminderTime: finalReminder,
            sortOrder: itemsList.length,
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        }

        try {
          await createItem({
            name,
            type,
            targetCount: finalTarget,
            reminderTime: finalReminder,
          });
        } catch {}
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this item? Its history will also be removed")) return;
    const targetItem = itemsList.find((i) => i.id === id);
    setItemsList((prev) => prev.filter((i) => i.id !== id));
    if (expandedId === id) setExpandedId(null);

    const nowIso = new Date().toISOString();
    if (targetItem?.uuid) {
      if (localDb) {
        try {
          await localDb.items.delete(targetItem.uuid);
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("items", "delete", {
          uuid: targetItem.uuid,
          deletedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    try {
      await deleteItem(id);
    } catch {}
  };

  const handleToggleActive = async (item: Item) => {
    const nextActive = !item.active;
    const nowIso = new Date().toISOString();

    setItemsList((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, active: nextActive } : i))
    );

    if (item.uuid) {
      if (localDb) {
        try {
          await localDb.items.update(item.uuid, {
            active: nextActive,
            updatedAt: nowIso,
          });
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("items", "update", {
          uuid: item.uuid,
          active: nextActive,
          updatedAt: nowIso,
        });
      }
    }

    try {
      await updateItem(item.id, { active: nextActive });
    } catch {}
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
      {/* Header with Title and Single-line '+ New item' button */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 min-h-[40px]">
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase leading-none">
            Manage Daily Items
          </h1>
          <button
            type="button"
            onClick={openAddModal}
            className="shrink-0 h-10 w-[134px] px-4 rounded-lg bg-[#4FA3FF] hover:bg-[#3fa0ff] text-[#08080A] font-medium text-xs whitespace-nowrap active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
            <span>New item</span>
          </button>
        </div>
        <p className="text-xs text-[#8A92A3] max-w-xs sm:max-w-md leading-relaxed">
          Configure checklist routines and diet targets that repeat daily
        </p>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {itemsList.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#111216] border border-white/5 text-center text-xs text-[#8A92A3]">
            No daily items configured yet. Tap "+ New item" to create one.
          </div>
        ) : (
          itemsList.map((item, index) => {
            const isChecklist = item.type === "checklist";
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl bg-[#111216] border transition-all duration-200 overflow-hidden ${
                  isExpanded ? "border-white/20" : "border-white/10 hover:border-white/15"
                } ${!item.active ? "opacity-50" : ""}`}
              >
                {/* Simplified Row Header (Tap to toggle expand) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(item.id);
                    }
                  }}
                  className="w-full flex items-center justify-between p-3.5 sm:p-4 min-h-[56px] cursor-pointer select-none text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    {/* Checkbox / Type Icon */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                        isChecklist
                          ? "bg-[#4FA3FF]/10 border-[#4FA3FF]/30 text-[#4FA3FF]"
                          : "bg-[#E4101E]/10 border-[#E4101E]/30 text-[#E4101E]"
                      }`}
                    >
                      {isChecklist ? (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : (
                        <Apple className="w-3.5 h-3.5 stroke-[2.2]" />
                      )}
                    </div>

                    {/* Item Name (wraps up to 2 lines) & Secondary info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm sm:text-base leading-snug break-words line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-xs text-[#8A92A3] mt-0.5 truncate">
                        {item.reminderTime && `${formatTimeDisplay(item.reminderTime)} • `}
                        {isChecklist ? "Checklist" : `Diet · ${item.targetCount} target`}
                      </p>
                    </div>
                  </div>

                  {/* Expand / Collapse Chevron */}
                  <ChevronDown
                    className={`w-4 h-4 text-[#8A92A3] shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180 text-white" : ""
                    }`}
                  />
                </div>

                {/* Inline Details Accordion (Only one open at a time) */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-[#0D0E12] p-4 space-y-3.5 transition-all duration-200">
                    {/* Meta info boxes */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#14151B] border border-white/5 rounded-lg p-2.5">
                        <span className="text-[#8A92A3] block text-[11px]">Category</span>
                        <span className="text-white font-medium capitalize mt-0.5 block">
                          {isChecklist
                            ? "Checklist (1 tick)"
                            : `Diet (${item.targetCount} portions)`}
                        </span>
                      </div>
                      <div className="bg-[#14151B] border border-white/5 rounded-lg p-2.5">
                        <span className="text-[#8A92A3] block text-[11px]">Reminder time</span>
                        <span className="text-white font-medium mt-0.5 block">
                          {item.reminderTime ? formatTimeDisplay(item.reminderTime) : "None"}
                        </span>
                      </div>
                    </div>

                    {/* Active on/off switch */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <span className="text-xs font-medium text-white block">Active</span>
                        <span className="text-[11px] text-[#8A92A3] block">
                          {item.active ? "Included in daily routine" : "Paused from daily routine"}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.active}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(item);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          item.active ? "bg-[#4FA3FF]" : "bg-[#232630]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            item.active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Bottom Actions: Reorder, Edit, and Quiet Delete */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        {/* Reorder Arrows */}
                        <div className="flex items-center bg-[#14151B] border border-white/10 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(index, "up");
                            }}
                            disabled={index === 0}
                            className="p-2 text-[#8A92A3] hover:text-white disabled:opacity-20 hover:bg-white/5 transition-colors"
                            aria-label="Move up"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-[1px] h-3.5 bg-white/10" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(index, "down");
                            }}
                            disabled={index === itemsList.length - 1}
                            className="p-2 text-[#8A92A3] hover:text-white disabled:opacity-20 hover:bg-white/5 transition-colors"
                            aria-label="Move down"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] hover:bg-white/5 border border-white/10 text-white text-xs font-medium transition-colors min-h-[34px]"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#8A92A3]" />
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* Delete Button (Quiet red text button) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
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
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111216] border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl overflow-hidden">
            {/* Restrained Accent Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 m-stripe-horizontal" />

            <div className="flex items-center justify-between mb-4 pt-1">
              <h2 className="text-base font-semibold text-white">
                {editingItem ? "Edit item" : "Create item"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#8A92A3] hover:text-white rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1.5">
                  Item name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brush at night, Drink water"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType("checklist");
                      setTargetCount(1);
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                      type === "checklist"
                        ? "bg-[#4FA3FF]/15 border-[#4FA3FF] text-[#4FA3FF]"
                        : "bg-[#14151B] border-white/10 text-[#8A92A3] hover:text-white"
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
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                      type === "diet"
                        ? "bg-[#E4101E]/15 border-[#E4101E] text-[#E4101E]"
                        : "bg-[#14151B] border-white/10 text-[#8A92A3] hover:text-white"
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5" />
                    <span>Diet / Nutrition</span>
                  </button>
                </div>
              </div>

              {type === "diet" && (
                <div>
                  <label className="block text-xs font-medium text-[#8A92A3] mb-1.5">
                    Target portions per day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-sm focus:outline-none focus:border-[#E4101E]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#8A92A3] mb-1.5">
                  Reminder time (optional)
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#14151B] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-[#14151B] hover:bg-white/5 border border-white/10 text-[#8A92A3] hover:text-white font-medium text-xs transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[#4FA3FF] hover:bg-[#3fa0ff] text-[#08080A] font-semibold text-xs transition-colors min-h-[40px] flex items-center justify-center disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editingItem ? "Update" : "Save item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
