import { getSettingsData } from "@/app/actions/settings";
import { getRecycleBinCount } from "@/app/actions/bin";
import SettingsView from "@/components/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, binCount] = await Promise.all([
    getSettingsData(),
    getRecycleBinCount(),
  ]);
  return <SettingsView initialSettings={settings} initialBinCount={binCount} />;
}

