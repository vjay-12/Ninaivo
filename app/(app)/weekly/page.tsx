import { getWeeklyViewData } from "@/app/actions/weekly";
import WeeklyView from "@/components/WeeklyView";

export const dynamic = "force-dynamic";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const data = await getWeeklyViewData(searchParams?.date);

  return (
    <WeeklyView
      initialSelectedDate={data.selectedDate}
      initialWeekDays={data.weekDays}
      initialTasks={data.tasksForSelectedDay}
      allWeeklyTasks={data.allWeeklyTasks}
    />
  );
}

