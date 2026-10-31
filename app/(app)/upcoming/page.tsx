import { getUpcomingItems } from "@/app/actions/upcoming";
import UpcomingView from "@/components/UpcomingView";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const data = await getUpcomingItems();
  return <UpcomingView initialData={data} />;
}

