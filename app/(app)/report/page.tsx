import { getReportData } from "@/app/actions/report";
import ReportView from "@/components/ReportView";
import { ReportRange } from "@/lib/report";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const range = (searchParams?.range as ReportRange) || "month";
  const data = await getReportData(range);

  return <ReportView initialData={data} />;
}

