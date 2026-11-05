"use client";

import { useState, useMemo } from "react";
import { Item, FoodItem } from "@/db/schema";
import {
  createDailyDietItem,
  updateDailyDietItem,
  deleteDailyDietItem,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  logFoodToday,
  promoteFoodToDaily,
} from "@/app/actions/diet";
import { restoreBinItem } from "@/app/actions/bin";
import { triggerUndoSnackbar } from "@/components/UndoSnackbar";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  Apple,
  Search,
  Check,
  CalendarPlus,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatTimeDisplay } from "@/lib/date";
import { localDb } from "@/lib/db-local";
import { syncEngine } from "@/lib/sync";

interface DietViewProps {
  initialDailyDiet: Item[];
  initialFoodItems: FoodItem[];
  initialTodayFoodCounts?: Record<number, number>;
}

type FoodCategory = "all" | "fruit" | "protein" | "grain" | "snack" | "drink" | "other";

const CATEGORIES: { id: FoodCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fruit", label: "Fruit" },
  { id: "protein", label: "Protein" },
  { id: "grain", label: "Grain" },
  { id: "snack", label: "Snack" },
  { id: "drink", label: "Drink" },
  { id: "other", label: "Other" },
];

export default function DietView({
  initialDailyDiet,
  initialFoodItems,
  initialTodayFoodCounts = {},
}: DietViewProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "foodlist">("daily");

  // Daily Diet state
  const [dailyItems, setDailyItems] = useState<Item[]>(initialDailyDiet);
  const [expandedDailyId, setExpandedDailyId] = useState<number | null>(null);
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [editingDaily, setEditingDaily] = useState<Item | null>(null);
  const [dailyName, setDailyName] = useState("");
  const [dailyTarget, setDailyTarget] = useState(1);
  const [dailyReminder, setDailyReminder] = useState("");
  const [isDailySaving, setIsDailySaving] = useState(false);

  // Food List state
  const [foods, setFoods] = useState<FoodItem[]>(initialFoodItems);
  const [todayCounts, setTodayCounts] = useState<Record<number, number>>(initialTodayFoodCounts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>("all");
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState<"fruit" | "protein" | "grain" | "snack" | "drink" | "other">("protein");
  const [foodNote, setFoodNote] = useState("");
  const [isFoodSaving, setIsFoodSaving] = useState(false);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);

  // Filtered Food List
  const filteredFoods = useMemo(() => {
    return foods.filter((f) => {
      const matchesCategory = selectedCategory === "all" || f.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (f.note && f.note.toLowerCase().includes(searchQuery.trim().toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [foods, selectedCategory, searchQuery]);

  // Daily Diet handlers
  const openAddDailyModal = () => {
    setEditingDaily(null);
    setDailyName("");
    setDailyTarget(1);
    setDailyReminder("");
    setIsDailyModalOpen(true);
  };

  const openEditDailyModal = (item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDaily(item);
    setDailyName(item.name);
    setDailyTarget(item.targetCount);
    setDailyReminder(item.reminderTime || "");
    setIsDailyModalOpen(true);
  };

  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyName.trim() || isDailySaving) return;

    setIsDailySaving(true);
    const nowIso = new Date().toISOString();
    const finalTarget = Math.max(1, Number(dailyTarget) || 1);
    const finalReminder = dailyReminder ? dailyReminder : null;

    try {
      if (editingDaily) {
        setDailyItems((prev) =>
          prev.map((i) =>
            i.id === editingDaily.id
              ? { ...i, name: dailyName.trim(), targetCount: finalTarget, reminderTime: finalReminder }
              : i
          )
        );

        if (editingDaily.uuid) {
          if (localDb) {
            try {
              await localDb.items.update(editingDaily.uuid, {
                name: dailyName.trim(),
                targetCount: finalTarget,
                reminderTime: finalReminder,
                updatedAt: nowIso,
              });
            } catch {}
          }
          if (syncEngine) {
            syncEngine.queueLocalWrite("items", "update", {
              uuid: editingDaily.uuid,
              name: dailyName.trim(),
              targetCount: finalTarget,
              reminderTime: finalReminder,
              updatedAt: nowIso,
            });
          }
        }

        try {
          await updateDailyDietItem(editingDaily.id, {
            name: dailyName.trim(),
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
          name: dailyName.trim(),
          type: "diet",
          targetCount: finalTarget,
          reminderTime: finalReminder,
          sortOrder: dailyItems.length,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        setDailyItems((prev) => [...prev, newItem]);

        if (localDb) {
          try {
            await localDb.items.put({
              id: fakeId,
              uuid: itemUuid,
              name: dailyName.trim(),
              type: "diet",
              targetCount: finalTarget,
              reminderTime: finalReminder,
              sortOrder: dailyItems.length,
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
            name: dailyName.trim(),
            type: "diet",
            targetCount: finalTarget,
            reminderTime: finalReminder,
            sortOrder: dailyItems.length,
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        }

        try {
          await createDailyDietItem({
            uuid: itemUuid,
            name: dailyName.trim(),
            targetCount: finalTarget,
            reminderTime: finalReminder,
          });
        } catch {}
      }
      setIsDailyModalOpen(false);
    } finally {
      setIsDailySaving(false);
    }
  };

  const handleDeleteDaily = async (id: number) => {
    const targetItem = dailyItems.find((i) => i.id === id);
    if (!targetItem) return;

    const originalIndex = dailyItems.findIndex((i) => i.id === id);
    setDailyItems((prev) => prev.filter((i) => i.id !== id));
    if (expandedDailyId === id) setExpandedDailyId(null);

    const nowIso = new Date().toISOString();
    if (targetItem.uuid) {
      if (localDb) {
        try {
          await localDb.items.update(targetItem.uuid, {
            deletedAt: nowIso,
            updatedAt: nowIso,
          });
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("items", "update", {
          uuid: targetItem.uuid,
          deletedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    try {
      await deleteDailyDietItem(id);
    } catch {}

    triggerUndoSnackbar({
      message: `Deleted "${targetItem.name}".`,
      onUndo: async () => {
        setDailyItems((prev) => {
          const next = [...prev];
          next.splice(originalIndex, 0, targetItem);
          return next;
        });

        if (targetItem.uuid) {
          if (localDb) {
            try {
              await localDb.items.update(targetItem.uuid, {
                deletedAt: null,
                updatedAt: new Date().toISOString(),
              });
            } catch {}
          }
          if (syncEngine) {
            syncEngine.queueLocalWrite("items", "update", {
              uuid: targetItem.uuid,
              deletedAt: null,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        try {
          await restoreBinItem("items", targetItem.id);
        } catch {}
      },
    });
  };

  const handleToggleDailyActive = async (item: Item) => {
    const nextActive = !item.active;
    const nowIso = new Date().toISOString();

    setDailyItems((prev) =>
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
      await updateDailyDietItem(item.id, { active: nextActive });
    } catch {}
  };

  // Food List handlers
  const openAddFoodModal = () => {
    setEditingFood(null);
    setFoodName("");
    setFoodCategory("protein");
    setFoodNote("");
    setIsFoodModalOpen(true);
  };

  const openEditFoodModal = (food: FoodItem) => {
    setEditingFood(food);
    setFoodName(food.name);
    setFoodCategory(food.category as any);
    setFoodNote(food.note || "");
    setIsFoodModalOpen(true);
  };

  const handleSaveFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim() || isFoodSaving) return;

    setIsFoodSaving(true);
    const nowIso = new Date().toISOString();

    try {
      if (editingFood) {
        setFoods((prev) =>
          prev.map((f) =>
            f.id === editingFood.id
              ? { ...f, name: foodName.trim(), category: foodCategory, note: foodNote.trim() || null }
              : f
          )
        );

        if (editingFood.uuid) {
          if (localDb) {
            try {
              await localDb.foodItems.update(editingFood.uuid, {
                name: foodName.trim(),
                category: foodCategory,
                note: foodNote.trim() || null,
                updatedAt: nowIso,
              });
            } catch {}
          }
          if (syncEngine) {
            syncEngine.queueLocalWrite("food_items", "update", {
              uuid: editingFood.uuid,
              name: foodName.trim(),
              category: foodCategory,
              note: foodNote.trim() || null,
              updatedAt: nowIso,
            });
          }
        }

        try {
          await updateFoodItem(editingFood.id, {
            name: foodName.trim(),
            category: foodCategory,
            note: foodNote.trim() || null,
          });
        } catch {}
      } else {
        const foodUuid = crypto.randomUUID();
        const fakeId = Date.now();
        const newFood: FoodItem = {
          id: fakeId,
          uuid: foodUuid,
          name: foodName.trim(),
          category: foodCategory,
          note: foodNote.trim() || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        setFoods((prev) => [newFood, ...prev]);

        if (localDb) {
          try {
            await localDb.foodItems.put({
              id: fakeId,
              uuid: foodUuid,
              name: foodName.trim(),
              category: foodCategory,
              note: foodNote.trim() || null,
              createdAt: nowIso,
              updatedAt: nowIso,
              deletedAt: null,
            });
          } catch {}
        }
        if (syncEngine) {
          syncEngine.queueLocalWrite("food_items", "insert", {
            uuid: foodUuid,
            name: foodName.trim(),
            category: foodCategory,
            note: foodNote.trim() || null,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        }

        try {
          await createFoodItem({
            uuid: foodUuid,
            name: foodName.trim(),
            category: foodCategory,
            note: foodNote.trim() || null,
          });
        } catch {}
      }
      setIsFoodModalOpen(false);
    } finally {
      setIsFoodSaving(false);
    }
  };

  const handleDeleteFood = async (id: number) => {
    const targetFood = foods.find((f) => f.id === id);
    if (!targetFood) return;

    const originalIndex = foods.findIndex((f) => f.id === id);
    setFoods((prev) => prev.filter((f) => f.id !== id));

    const nowIso = new Date().toISOString();
    if (targetFood.uuid) {
      if (localDb) {
        try {
          await localDb.foodItems.update(targetFood.uuid, {
            deletedAt: nowIso,
            updatedAt: nowIso,
          });
        } catch {}
      }
      if (syncEngine) {
        syncEngine.queueLocalWrite("food_items", "update", {
          uuid: targetFood.uuid,
          deletedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    try {
      await deleteFoodItem(id);
    } catch {}

    triggerUndoSnackbar({
      message: `Deleted "${targetFood.name}".`,
      onUndo: async () => {
        setFoods((prev) => {
          const next = [...prev];
          next.splice(originalIndex, 0, targetFood);
          return next;
        });

        if (targetFood.uuid) {
          if (localDb) {
            try {
              await localDb.foodItems.update(targetFood.uuid, {
                deletedAt: null,
                updatedAt: new Date().toISOString(),
              });
            } catch {}
          }
          if (syncEngine) {
            syncEngine.queueLocalWrite("food_items", "update", {
              uuid: targetFood.uuid,
              deletedAt: null,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        try {
          await restoreBinItem("food_items", targetFood.id);
        } catch {}
      },
    });
  };

  const handleHadToday = async (food: FoodItem) => {
    setLoggingId(food.id);
    const prevCount = todayCounts[food.id] || 0;
    const nextCount = prevCount + 1;
    setTodayCounts((prev) => ({ ...prev, [food.id]: nextCount }));

    try {
      await logFoodToday(food.id, food.uuid);
    } catch {}
    setLoggingId(null);
  };

  const handleMakeDaily = async (food: FoodItem) => {
    setPromotingId(food.id);
    try {
      await promoteFoodToDaily(food.id);
      // Optimistically add to daily
      const newItem: Item = {
        id: Date.now(),
        uuid: crypto.randomUUID(),
        name: food.name,
        type: "diet",
        targetCount: 1,
        reminderTime: null,
        sortOrder: dailyItems.length,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      setDailyItems((prev) => [...prev, newItem]);
      setActiveTab("daily");
    } catch {}
    setPromotingId(null);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header & Main Add Button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
            Diet
          </h1>
          <p className="text-xs text-[#8A92A3] mt-0.5">
            Track daily nutrition targets and log everyday meals
          </p>
        </div>

        <button
          type="button"
          onClick={activeTab === "daily" ? openAddDailyModal : openAddFoodModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#4FA3FF] to-[#0B3A82] text-white font-heading font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg shrink-0 cursor-pointer min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>{activeTab === "daily" ? "Add" : "Add food"}</span>
        </button>
      </div>

      {/* Segmented Control */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-[#14151B] border border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === "daily"
              ? "bg-[#1A1C22] text-white border border-white/10 shadow"
              : "text-[#8A92A3] hover:text-white"
          }`}
        >
          Daily diet ({dailyItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("foodlist")}
          className={`py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === "foodlist"
              ? "bg-[#1A1C22] text-white border border-white/10 shadow"
              : "text-[#8A92A3] hover:text-white"
          }`}
        >
          Food list ({foods.length})
        </button>
      </div>

      {/* VIEW 1: DAILY DIET */}
      {activeTab === "daily" && (
        <div className="space-y-3">
          {dailyItems.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-[#111216] border border-white/5 space-y-2">
              <Apple className="w-8 h-8 text-[#8A92A3] mx-auto opacity-40" />
              <p className="text-sm font-medium text-white">No daily diet targets yet</p>
              <p className="text-xs text-[#8A92A3] max-w-xs mx-auto">
                Tap + Add to set recurring daily nutrition goals like water intake, protein, or fruit portions.
              </p>
            </div>
          ) : (
            dailyItems.map((item) => {
              const isExpanded = expandedDailyId === item.id;
              const isInactive = !item.active;

              return (
                <div
                  key={item.id}
                  onClick={() => setExpandedDailyId(isExpanded ? null : item.id)}
                  className={`rounded-2xl border transition-all cursor-pointer select-none overflow-hidden ${
                    isExpanded
                      ? "bg-[#14151B] border-white/20 shadow-xl"
                      : "bg-[#111216] hover:bg-[#14151B] border-white/5"
                  } ${isInactive ? "opacity-60" : ""}`}
                >
                  <div className="p-4 flex items-center justify-between gap-3 min-h-[56px]">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm break-words leading-tight">
                          {item.name}
                        </span>
                        {isInactive && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/5 text-[#8A92A3]">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#8A92A3]">
                        <span>Target: {item.targetCount} / day</span>
                        {item.reminderTime && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-[#4FA3FF]">
                              <Clock className="w-3 h-3" />
                              {formatTimeDisplay(item.reminderTime)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ChevronDown
                        className={`w-4 h-4 text-[#8A92A3] transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-3 bg-[#0D0E12] border-t border-white/5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleDailyActive(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          item.active
                            ? "bg-white/5 text-[#8A92A3] hover:text-white"
                            : "bg-[#4FA3FF]/15 text-[#4FA3FF]"
                        }`}
                      >
                        {item.active ? "Pause target" : "Activate target"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => openEditDailyModal(item, e)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#4FA3FF]" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDaily(item.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E4101E]/10 hover:bg-[#E4101E]/20 text-[#FF4D5A] text-xs font-medium transition-colors cursor-pointer"
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
      )}

      {/* VIEW 2: FOOD LIST */}
      {activeTab === "foodlist" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8A92A3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search foods or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#14151B] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4FA3FF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A92A3] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips (Horizontal Scroll, No visible scrollbar) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#4FA3FF] text-[#08080A] font-bold"
                    : "bg-[#14151B] text-[#8A92A3] hover:text-white border border-white/10"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Food Cards */}
          {filteredFoods.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-[#111216] border border-white/5 space-y-2">
              <Apple className="w-8 h-8 text-[#8A92A3] mx-auto opacity-40" />
              <p className="text-sm font-medium text-white">Food list is empty</p>
              <p className="text-xs text-[#8A92A3] max-w-xs mx-auto">
                {searchQuery || selectedCategory !== "all"
                  ? "No foods match your search or filter."
                  : "Add foods you frequently eat to quickly log them anytime."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFoods.map((food) => {
                const loggedCount = todayCounts[food.id] || 0;
                const isLogging = loggingId === food.id;
                const isPromoting = promotingId === food.id;

                return (
                  <div
                    key={food.id}
                    className="p-4 rounded-2xl bg-[#111216] border border-white/5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm break-words">
                            {food.name}
                          </span>
                          <span className="text-[10px] font-heading uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-[#8A92A3] border border-white/5">
                            {food.category}
                          </span>
                        </div>
                        {food.note && (
                          <p className="text-xs text-[#8A92A3] italic">{food.note}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditFoodModal(food)}
                          className="p-1.5 rounded-lg text-[#8A92A3] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          aria-label="Edit food"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFood(food.id)}
                          className="p-1.5 rounded-lg text-[#8A92A3] hover:text-[#E4101E] hover:bg-[#E4101E]/10 transition-colors cursor-pointer"
                          aria-label="Delete food"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleMakeDaily(food)}
                        disabled={isPromoting}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-[#4FA3FF]" />
                        <span>{isPromoting ? "Adding..." : "Make daily"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleHadToday(food)}
                        disabled={isLogging}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          loggedCount > 0
                            ? "bg-[#4FA3FF] text-[#08080A] hover:bg-[#3fa0ff]"
                            : "bg-[#1A1C22] text-white hover:bg-white/10 border border-white/10"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{loggedCount > 0 ? `Had today (${loggedCount})` : "Had today"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT DAILY DIET TARGET */}
      {isDailyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111216] border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 id="daily-modal-title" className="font-heading font-bold text-base uppercase text-white">
                {editingDaily ? "Edit daily target" : "New daily target"}
              </h3>
              <button
                type="button"
                onClick={() => setIsDailyModalOpen(false)}
                className="text-[#8A92A3] hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDaily} className="space-y-3.5">
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Target name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water 3L, Protein shake"
                  value={dailyName}
                  onChange={(e) => setDailyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Target count per day
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Reminder time (optional)
                </label>
                <input
                  type="time"
                  value={dailyReminder}
                  onChange={(e) => setDailyReminder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDailyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-transparent text-[#8A92A3] hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDailySaving || !dailyName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#4FA3FF] text-[#08080A] font-heading font-bold text-xs uppercase tracking-wider hover:bg-[#3fa0ff] transition-all cursor-pointer disabled:opacity-40"
                >
                  {isDailySaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT FOOD ITEM */}
      {isFoodModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="food-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111216] border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 id="food-modal-title" className="font-heading font-bold text-base uppercase text-white">
                {editingFood ? "Edit food" : "New food"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFoodModalOpen(false)}
                className="text-[#8A92A3] hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFood} className="space-y-3.5">
              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Food name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boiled eggs, Green smoothie"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Category
                </label>
                <select
                  value={foodCategory}
                  onChange={(e) => setFoodCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                >
                  <option value="protein">Protein</option>
                  <option value="fruit">Fruit</option>
                  <option value="grain">Grain</option>
                  <option value="snack">Snack</option>
                  <option value="drink">Drink</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-heading uppercase tracking-wider text-[#8A92A3] mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 scoops after workout"
                  value={foodNote}
                  onChange={(e) => setFoodNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1C22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#4FA3FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFoodModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-transparent text-[#8A92A3] hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFoodSaving || !foodName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#4FA3FF] text-[#08080A] font-heading font-bold text-xs uppercase tracking-wider hover:bg-[#3fa0ff] transition-all cursor-pointer disabled:opacity-40"
                >
                  {isFoodSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

