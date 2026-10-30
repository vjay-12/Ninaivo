import { getFutureRemindersGrouped } from "@/app/actions/future";
import FutureView from "@/components/FutureView";

export const dynamic = "force-dynamic";

export default async function FuturePage() {
  const data = await getFutureRemindersGrouped();
  return <FutureView initialData={data} />;
}

