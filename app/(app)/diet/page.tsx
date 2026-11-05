import { getDailyDietItems, getFoodItems, getTodayFoodLogsWithItems } from "@/app/actions/diet";
import DietView from "@/components/DietView";

export const dynamic = "force-dynamic";

export default async function DietPage() {
  const [dailyItems, foodItemsList, todayLogs] = await Promise.all([
    getDailyDietItems(),
    getFoodItems(),
    getTodayFoodLogsWithItems(),
  ]);

  const todayCounts: Record<number, number> = {};
  for (const log of todayLogs) {
    if (log.foodId) {
      todayCounts[log.foodId] = (todayCounts[log.foodId] || 0) + log.count;
    }
  }

  return (
    <DietView
      initialDailyDiet={dailyItems}
      initialFoodItems={foodItemsList}
      initialTodayFoodCounts={todayCounts}
    />
  );
}

