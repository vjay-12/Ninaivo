import { getTodayData } from "@/app/actions/today";
import { getTodayDateString } from "@/lib/date";
import TodayDashboard from "@/components/TodayDashboard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const todayStr = getTodayDateString();
  const data = await getTodayData(todayStr);

  return (
    <TodayDashboard
      initialDate={data.dateStr}
      checklistItems={data.checklistItems}
      dietItems={data.dietItems}
      weeklyToday={data.weeklyToday}
      reminders={data.reminders}
    />
  );
}

