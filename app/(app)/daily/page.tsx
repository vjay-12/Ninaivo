import { getDailyItems } from "@/app/actions/daily";
import DailyManager from "@/components/DailyManager";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const items = await getDailyItems();
  return <DailyManager initialItems={items} />;
}

