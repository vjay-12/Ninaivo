import { getSettingsData } from "@/app/actions/settings";
import SettingsView from "@/components/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettingsData();
  return <SettingsView initialSettings={settings} />;
}

