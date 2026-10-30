"use client";

import { useState } from "react";
import { ReportData, ReportRange } from "@/lib/report";
import { exportDatabaseBackup, exportDailyLogsCsv } from "@/app/actions/report";
import {
  Flame,
  Award,
  CheckCircle,
  TrendingUp,
  Apple,
  Egg,
  Lightbulb,
  Download,
  Calendar,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";

export default function ReportView({ initialData }: { initialData: ReportData }) {
  const [data, setData] = useState<ReportData>(initialData);
  const [isExporting, setIsExporting] = useState(false);

  const handleRangeChange = (newRange: ReportRange) => {
    const url = new URL(window.location.href);
    url.searchParams.set("range", newRange);
    window.location.href = url.toString();
  };

  const handleDownloadJson = async () => {
    setIsExporting(true);
    try {
      const backup = await exportDatabaseBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `m-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await exportDailyLogsCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `m-routine-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Range Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">
            Performance Report
          </h1>
          <p className="text-xs text-[#8A92A3] mt-1">
            Aggregated habit consistency, streaks and nutrition statistics
          </p>
        </div>

        {/* Range switch: Week / Month / All Time */}
        <div className="inline-flex p-1 rounded-xl bg-[#111216] border border-white/10 self-start sm:self-auto">
          {(["week", "month", "all"] as ReportRange[]).map((r) => {
            const isSelected = data.range === r;
            const label = r === "week" ? "7 Days" : r === "month" ? "30 Days" : "All Time";
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleRangeChange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all min-h-[36px] ${
                  isSelected
                    ? "bg-[#4FA3FF] text-white shadow-md"
                    : "text-[#8A92A3] hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Overall Completion */}
        <div className="p-4 rounded-xl bg-[#111216] border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4FA3FF]" />
          <div className="flex items-center justify-between text-[#8A92A3] mb-2">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider">
              Completion Rate
            </span>
            <TrendingUp className="w-4 h-4 text-[#4FA3FF]" />
          </div>
          <div className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            {data.overallCompletion}%
          </div>
          <span className="text-[11px] text-[#8A92A3] mt-1 block">Average over period</span>
        </div>

        {/* Current Streak */}
        <div className="p-4 rounded-xl bg-[#111216] border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#E4101E]" />
          <div className="flex items-center justify-between text-[#8A92A3] mb-2">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider">
              Current Streak
            </span>
            <Flame className="w-4 h-4 text-[#E4101E]" />
          </div>
          <div className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            {data.currentStreak}
            <span className="text-base font-normal text-[#8A92A3] ml-1">days</span>
          </div>
          <span className="text-[11px] text-[#8A92A3] mt-1 block">Active unbroken streak</span>
        </div>

        {/* Best Streak */}
        <div className="p-4 rounded-xl bg-[#111216] border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0B3A82]" />
          <div className="flex items-center justify-between text-[#8A92A3] mb-2">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider">
              Best Streak
            </span>
            <Award className="w-4 h-4 text-[#4FA3FF]" />
          </div>
          <div className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            {data.bestStreak}
            <span className="text-base font-normal text-[#8A92A3] ml-1">days</span>
          </div>
          <span className="text-[11px] text-[#8A92A3] mt-1 block">All-time record</span>
        </div>

        {/* Perfect Days */}
        <div className="p-4 rounded-xl bg-[#111216] border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 m-stripe-horizontal" />
          <div className="flex items-center justify-between text-[#8A92A3] mb-2">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider">
              Perfect Days
            </span>
            <CheckCircle className="w-4 h-4 text-[#4FA3FF]" />
          </div>
          <div className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            {data.perfectDaysCount}
            <span className="text-base font-normal text-[#8A92A3] ml-1">days</span>
          </div>
          <span className="text-[11px] text-[#8A92A3] mt-1 block">100% completed</span>
        </div>
      </div>

      {/* Daily Completion Trend Bar Chart */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
            Daily Completion %
          </h2>
          <span className="text-xs text-[#8A92A3]">Last {data.trend.length} Days</span>
        </div>

        {/* Responsive SVG Bar Chart */}
        <div className="h-44 sm:h-52 w-full flex items-end gap-1 sm:gap-2 pt-6 pb-2 border-b border-white/10 overflow-x-auto">
          {data.trend.map((point) => {
            const barHeight = Math.max(4, Math.round((point.percentage / 100) * 100));
            const is100 = point.percentage === 100;
            return (
              <div
                key={point.date}
                className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[14px]"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 bg-[#1A1C22] border border-white/20 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg transition-opacity">
                  <p className="font-bold">{point.date}</p>
                  <p>
                    {point.percentage}% ({point.completed}/{point.total})
                  </p>
                </div>

                {/* Bar */}
                <div
                  style={{ height: `${barHeight}%` }}
                  className={`w-full rounded-t transition-all duration-300 ${
                    is100
                      ? "bg-gradient-to-t from-[#0B3A82] via-[#4FA3FF] to-[#E4101E]"
                      : point.percentage >= 50
                      ? "bg-[#4FA3FF]/80 group-hover:bg-[#4FA3FF]"
                      : point.percentage > 0
                      ? "bg-[#0B3A82]/80 group-hover:bg-[#0B3A82]"
                      : "bg-white/5"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] text-[#8A92A3] pt-1">
          <span>{data.trend[0]?.date}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4FA3FF]" />
              Normal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#E4101E]" />
              100% Day
            </span>
          </div>
          <span>{data.trend[data.trend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Heatmap Calendar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#4FA3FF]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Habit Heatmap
            </h2>
          </div>
          <span className="text-xs text-[#8A92A3]">Darker/Red = More Done</span>
        </div>

        {/* Heatmap Grid */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {data.heatmap.map((d) => {
            const levelClass =
              d.level === 4
                ? "bg-[#E4101E] shadow-[0_0_8px_rgba(228,16,30,0.6)] border border-[#E4101E]"
                : d.level === 3
                ? "bg-[#4FA3FF] border border-[#4FA3FF]"
                : d.level === 2
                ? "bg-[#0B3A82] border border-[#0B3A82]"
                : d.level === 1
                ? "bg-[#1A1C22] border border-white/10"
                : "bg-[#08080A] border border-white/5";

            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.percentage}% completed (${d.completed}/${d.total})`}
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md -skew-x-6 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${levelClass}`}
              />
            );
          })}
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center gap-2 text-xs text-[#8A92A3] pt-2">
          <span>Less</span>
          <span className="w-4 h-4 rounded bg-[#08080A] border border-white/10 -skew-x-6" />
          <span className="w-4 h-4 rounded bg-[#1A1C22] border border-white/10 -skew-x-6" />
          <span className="w-4 h-4 rounded bg-[#0B3A82] -skew-x-6" />
          <span className="w-4 h-4 rounded bg-[#4FA3FF] -skew-x-6" />
          <span className="w-4 h-4 rounded bg-[#E4101E] -skew-x-6" />
          <span>100%</span>
        </div>
      </div>

      {/* Per-Item Performance Bars */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
          Item Breakdown
        </h2>

        <div className="space-y-3.5">
          {data.itemsPerformance.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-white flex items-center gap-2">
                  {item.name}
                  <span className="text-[10px] font-heading uppercase text-[#8A92A3] px-1.5 py-0.2 rounded bg-white/5">
                    {item.type}
                  </span>
                </span>
                <span className="font-heading font-bold text-white">
                  {item.percentage}% ({item.daysCompleted}/{item.totalDays} days)
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#1A1C22] rounded-full overflow-hidden border border-white/5">
                <div
                  style={{ width: `${item.percentage}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.type === "checklist"
                      ? "bg-[#4FA3FF]"
                      : "bg-[#E4101E]"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Diet Stats & Weekday Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Diet Card */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Apple className="w-5 h-5 text-[#E4101E]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Nutrition Stats
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#1A1C22] border border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-[#8A92A3] mb-1">
                <Apple className="w-3.5 h-3.5 text-[#E4101E]" />
                <span>Fruits / Day</span>
              </div>
              <div className="font-heading font-bold text-2xl text-white">
                {data.diet.fruitsAvg}
                <span className="text-xs text-[#8A92A3] font-normal ml-1">
                  / {data.diet.fruitsTarget} target
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1A1C22] border border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-[#8A92A3] mb-1">
                <Egg className="w-3.5 h-3.5 text-[#4FA3FF]" />
                <span>Eggs Done</span>
              </div>
              <div className="font-heading font-bold text-2xl text-white">
                {data.diet.eggDaysDone}
                <span className="text-xs text-[#8A92A3] font-normal ml-1">
                  / {data.diet.eggDaysTotal} days ({data.diet.eggRate}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekday Analysis */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#4FA3FF]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Weekday Analysis
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#1A1C22] border border-white/5">
              <span className="text-[11px] font-heading uppercase text-[#4FA3FF] block mb-1 font-semibold">
                Best Day
              </span>
              <p className="font-heading font-bold text-lg text-white">
                {data.bestWeekday}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1A1C22] border border-white/5">
              <span className="text-[11px] font-heading uppercase text-[#E4101E] block mb-1 font-semibold">
                Needs Focus
              </span>
              <p className="font-heading font-bold text-lg text-white">
                {data.worstWeekday}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Insights */}
      {data.insights.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-[#4FA3FF]">
            <Lightbulb className="w-5 h-5 text-[#4FA3FF]" />
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Automated Insights
            </h2>
          </div>

          <div className="space-y-2">
            {data.insights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1A1C22] border border-white/5 text-xs sm:text-sm text-[#F3F5F8]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#4FA3FF] mt-2 shrink-0" />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export & Backup */}
      <div className="p-5 rounded-2xl bg-[#111216] border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg uppercase tracking-wider text-white">
              Data Backup &amp; Export
            </h2>
            <p className="text-xs text-[#8A92A3]">
              Download your complete routine logs or database backup
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1C22] hover:bg-white/10 border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#4FA3FF]" />
            <span>Export CSV Logs</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1C22] hover:bg-white/10 border border-white/10 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
          >
            <FileCode className="w-4 h-4 text-[#E4101E]" />
            <span>Export JSON Backup</span>
          </button>
        </div>
      </div>
    </div>
  );
}

