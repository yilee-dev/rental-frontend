"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Monitor, TrendingUp, Undo2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer } from "@/components/ui/chart";
import { rentalApi } from "@/lib/rental-api";
import { getDefaultRoute, usePermissions } from "@/lib/permissions";
import { CompanySiteStatEntry, DashboardStats, YearlyTypeEntry } from "@/types";

const monthlyChartConfig = {
  fee: { label: "월 렌탈료", color: "#5B7DB1" },
};

const yearlyChartConfig = {
  notebookNormal: { label: "노트북 · 일반", color: "#F7E2E2" },
  notebookHigh:   { label: "노트북 · 설계", color: "#61A4BC" },
  desktopNormal:  { label: "데스크탑 · 일반", color: "#5B7DB1" },
  desktopHigh:    { label: "데스크탑 · 설계", color: "#1A132F" },
};

function StatCard({
  title, value, sub, icon: Icon, loading, highlight, onClick,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType;
  loading: boolean; highlight?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={`overflow-hidden transition-all duration-300 ease-out border-gray-100 dark:border-gray-800/60 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className={`text-2xl font-semibold tracking-tight ${highlight ? "text-red-500/90 dark:text-red-400/80" : "text-gray-800 dark:text-gray-100"}`}>{value}</p>
            )}
            {sub && !loading && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-2xl ${highlight ? "bg-red-50/60 dark:bg-red-950/30" : "bg-blue-50/60 dark:bg-blue-950/30"}`}>
            <Icon className={`w-5 h-5 ${highlight ? "text-red-400/80 dark:text-red-400/60" : "text-blue-500/70 dark:text-blue-400/60"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildYearlyChartData(data: DashboardStats, selectedYear: string) {
  const rows = selectedYear === "ALL"
    ? data.yearlyStats
    : data.yearlyStats.filter((s) => String(s.year) === selectedYear);
  return rows.map((s: YearlyTypeEntry) => ({
    year: `${String(s.year).padStart(2, "0")}년도`,
    notebookNormal: s.notebookNormal,
    notebookHigh: s.notebookHigh,
    desktopNormal: s.desktopNormal,
    desktopHigh: s.desktopHigh,
    total: s.total,
  }));
}

export default function DashboardPage() {
  const router = useRouter();
  const permissions = usePermissions();

  useEffect(() => {
    if (permissions.length > 0 && !permissions.includes("rental:read")) {
      router.replace(getDefaultRoute(permissions));
    }
  }, [permissions, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: rentalApi.getDashboard,
  });

  const [selectedYear, setSelectedYear] = useState("ALL");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-gray-800 dark:text-gray-100">대시보드</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="총 렌탈 PC"
          value={data ? `${data.totalCount.toLocaleString()}대` : ""}
          sub={data ? `노트북 ${data.notebookCount}대 / 데스크탑 ${data.desktopCount}대` : undefined}
          icon={Monitor}
          loading={isLoading}
          onClick={() => router.push("/rental")}
        />
        <StatCard
          title="월 렌탈료 총합"
          value={data ? `${data.totalMonthlyFee.toLocaleString()}원` : ""}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          title="30일 내 만료"
          value={data ? `${data.expiringWithin30Days.toLocaleString()}건` : ""}
          sub={data?.expiringWithin30Days ? "만료 예정 항목 확인" : "만료 예정 없음"}
          icon={AlertTriangle}
          loading={isLoading}
          highlight={!!data?.expiringWithin30Days && data.expiringWithin30Days > 0}
          onClick={() => router.push("/rental?filter=expiring")}
        />
        <StatCard
          title="분실 / 반납"
          value={data ? `${data.lostCount}건 / ${data.returnedCount}건` : ""}
          sub={data?.lostCount ? "분실 신고 항목 존재" : "분실 없음"}
          icon={Undo2}
          loading={isLoading}
          highlight={!!data?.lostCount && data.lostCount > 0}
          onClick={() => router.push("/returns?tab=lost")}
        />
      </div>

      {/* 년도별 집계 블록 */}
      {!isLoading && data && data.yearlyStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {data.yearlyStats.map((s) => {
            const isSelected = selectedYear === String(s.year);
            return (
              <div
                key={s.year}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border transition-all duration-200 cursor-pointer group ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 hover:shadow-sm hover:-translate-y-0.5"
                }`}
                onClick={() => setSelectedYear(isSelected ? "ALL" : String(s.year))}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider ${isSelected ? "text-blue-500" : "text-gray-400 group-hover:text-blue-400"} transition-colors`}>
                  렌탈 년도
                </span>
                <span className={`text-sm font-bold ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300 group-hover:text-blue-600"} transition-colors`}>
                  {String(s.year).padStart(2, "0")}년도
                </span>
                <span className={`text-xl font-extrabold tracking-tight ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-blue-600 dark:text-blue-400"}`}>
                  {s.total}
                  <span className="text-xs font-medium ml-0.5">대</span>
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    노트북 {s.notebookNormal + s.notebookHigh}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    데스크탑 {s.desktopNormal + s.desktopHigh}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      )}

      {/* 월별 렌탈료 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            월별 렌탈료 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ChartContainer config={monthlyChartConfig} className="h-72 w-full">
              <BarChart data={data.monthlyFeeByMonth} margin={{ top: 20, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={52}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                />
                <Bar dataKey="fee" fill="#5B7DB1" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="fee"
                    position="top"
                    style={{ fontSize: 10, fill: "#6b7280" }}
                    formatter={(v: unknown) =>
                      typeof v === "number" && v > 0 ? `${(v / 10000).toFixed(0)}만` : ""
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* 년도별 유형별 현황 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              년도별 렌탈 유형 현황
            </CardTitle>
            {!isLoading && data && (
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? "ALL")}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체 년도</SelectItem>
                  {data.yearlyStats.map((s) => (
                    <SelectItem key={s.year} value={String(s.year)}>
                      {String(s.year).padStart(2, "0")}년도
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (() => {
            const chartData = buildYearlyChartData(data, selectedYear);
            return (
              <>
                <ChartContainer config={yearlyChartConfig} className="h-72 w-full">
                  <BarChart data={chartData} margin={{ top: 20, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                    <Legend
                      formatter={(value) =>
                        yearlyChartConfig[value as keyof typeof yearlyChartConfig]?.label ?? value
                      }
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="notebookNormal" stackId="notebook" fill={yearlyChartConfig.notebookNormal.color} />
                    <Bar dataKey="notebookHigh" stackId="notebook" fill={yearlyChartConfig.notebookHigh.color} radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry.notebookNormal + entry.notebookHigh}
                        position="top"
                        style={{ fontSize: 10, fill: "#61A4BC" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                    <Bar dataKey="desktopNormal" stackId="desktop" fill={yearlyChartConfig.desktopNormal.color} />
                    <Bar dataKey="desktopHigh" stackId="desktop" fill={yearlyChartConfig.desktopHigh.color} radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry.desktopNormal + entry.desktopHigh}
                        position="top"
                        style={{ fontSize: 10, fill: "#1A132F" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>

                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-xs">
                        <TableHead className="text-center" rowSpan={2}>년도</TableHead>
                        <TableHead className="text-center text-emerald-700 border-b-0 pb-0" colSpan={2}>노트북</TableHead>
                        <TableHead className="text-center text-blue-700 border-b-0 pb-0" colSpan={2}>데스크탑</TableHead>
                        <TableHead className="text-center font-semibold" rowSpan={2}>합계</TableHead>
                      </TableRow>
                      <TableRow className="bg-gray-50 text-xs">
                        <TableHead className="text-center text-emerald-500 pt-0">일반</TableHead>
                        <TableHead className="text-center text-emerald-800 pt-0">설계</TableHead>
                        <TableHead className="text-center text-blue-500 pt-0">일반</TableHead>
                        <TableHead className="text-center text-blue-800 pt-0">설계</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartData.map((row) => (
                        <TableRow key={row.year} className="text-sm">
                          <TableCell className="text-center font-medium">{row.year}</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookHigh}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopHigh}대</TableCell>
                          <TableCell className="text-center font-semibold">{row.total}대</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* 입고 년도별 자산 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-600" />
            입고 년도별 자산 현황
            <span className="text-xs font-normal text-gray-400 ml-1">(렌탈번호 기준)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-48 w-full" />
          ) : !data.intakeYearStats?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다.</p>
          ) : (() => {
            const intakeChartData = data.intakeYearStats.map((s) => ({
              year: `${String(s.year).padStart(2, "0")}년`,
              notebookNormal: s.notebookNormal,
              notebookHigh: s.notebookHigh,
              desktopNormal: s.desktopNormal,
              desktopHigh: s.desktopHigh,
              total: s.total,
            }));
            return (
              <>
                <ChartContainer config={yearlyChartConfig} className="h-64 w-full">
                  <BarChart data={intakeChartData} margin={{ top: 20, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                    <Legend
                      formatter={(value) =>
                        yearlyChartConfig[value as keyof typeof yearlyChartConfig]?.label ?? value
                      }
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="notebookNormal" stackId="notebook" fill={yearlyChartConfig.notebookNormal.color} />
                    <Bar dataKey="notebookHigh" stackId="notebook" fill={yearlyChartConfig.notebookHigh.color} radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry.notebookNormal + entry.notebookHigh}
                        position="top"
                        style={{ fontSize: 10, fill: "#61A4BC" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                    <Bar dataKey="desktopNormal" stackId="desktop" fill={yearlyChartConfig.desktopNormal.color} />
                    <Bar dataKey="desktopHigh" stackId="desktop" fill={yearlyChartConfig.desktopHigh.color} radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry.desktopNormal + entry.desktopHigh}
                        position="top"
                        style={{ fontSize: 10, fill: "#1A132F" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>

                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-xs">
                        <TableHead className="text-center" rowSpan={2}>입고 년도</TableHead>
                        <TableHead className="text-center text-emerald-700 border-b-0 pb-0" colSpan={2}>노트북</TableHead>
                        <TableHead className="text-center text-blue-700 border-b-0 pb-0" colSpan={2}>데스크탑</TableHead>
                        <TableHead className="text-center font-semibold" rowSpan={2}>합계</TableHead>
                      </TableRow>
                      <TableRow className="bg-gray-50 text-xs">
                        <TableHead className="text-center text-emerald-500 pt-0">일반</TableHead>
                        <TableHead className="text-center text-emerald-800 pt-0">설계</TableHead>
                        <TableHead className="text-center text-blue-500 pt-0">일반</TableHead>
                        <TableHead className="text-center text-blue-800 pt-0">설계</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {intakeChartData.map((row) => (
                        <TableRow key={row.year} className="text-sm">
                          <TableCell className="text-center font-medium">{row.year}</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookHigh}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopHigh}대</TableCell>
                          <TableCell className="text-center font-semibold">{row.total}대</TableCell>
                        </TableRow>
                      ))}
                      {intakeChartData.length > 1 && (
                        <TableRow className="text-sm bg-gray-50 font-semibold">
                          <TableCell className="text-center">합계</TableCell>
                          <TableCell className="text-center">{intakeChartData.reduce((s, r) => s + r.notebookNormal, 0)}대</TableCell>
                          <TableCell className="text-center">{intakeChartData.reduce((s, r) => s + r.notebookHigh, 0)}대</TableCell>
                          <TableCell className="text-center">{intakeChartData.reduce((s, r) => s + r.desktopNormal, 0)}대</TableCell>
                          <TableCell className="text-center">{intakeChartData.reduce((s, r) => s + r.desktopHigh, 0)}대</TableCell>
                          <TableCell className="text-center">{intakeChartData.reduce((s, r) => s + r.total, 0)}대</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* 소속사 / 사업장별 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-600" />
            소속사 · 사업장별 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-48 w-full" />
          ) : !data.companySiteStats?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">배정된 PC가 없습니다.</p>
          ) : (() => {
            const siteChartData = data.companySiteStats.map((r) => ({
              name: r.businessSiteName,
              "노트북·일반": r.notebookNormal,
              "노트북·설계": r.notebookHigh,
              "데스크탑·일반": r.desktopNormal,
              "데스크탑·설계": r.desktopHigh,
            }));
            const siteChartConfig = {
              "노트북·일반":   { label: "노트북 · 일반",   color: "#F7E2E2" },
              "노트북·설계":   { label: "노트북 · 설계",   color: "#61A4BC" },
              "데스크탑·일반": { label: "데스크탑 · 일반", color: "#5B7DB1" },
              "데스크탑·설계": { label: "데스크탑 · 설계", color: "#1A132F" },
            };
            const filteredStats = data.companySiteStats;
            const companies = Array.from(new Set(filteredStats.map((r) => r.companyCode)));
            return (
              <>
                <ChartContainer config={siteChartConfig} className="h-64 w-full mb-6">
                  <BarChart data={siteChartData} margin={{ top: 20, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                    <Legend
                      formatter={(value) =>
                        siteChartConfig[value as keyof typeof siteChartConfig]?.label ?? value
                      }
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="노트북·일반"   stackId="nb" fill="#F7E2E2" />
                    <Bar dataKey="노트북·설계"   stackId="nb" fill="#61A4BC" radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry["노트북·일반"] + entry["노트북·설계"]}
                        position="top"
                        style={{ fontSize: 10, fill: "#61A4BC" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                    <Bar dataKey="데스크탑·일반" stackId="dt" fill="#5B7DB1" />
                    <Bar dataKey="데스크탑·설계" stackId="dt" fill="#1A132F" radius={[3, 3, 0, 0]}>
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        valueAccessor={(entry: any) => entry["데스크탑·일반"] + entry["데스크탑·설계"]}
                        position="top"
                        style={{ fontSize: 10, fill: "#1A132F" }}
                        formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}` : ""}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-xs">
                      <TableHead className="text-center" rowSpan={2}>소속사</TableHead>
                      <TableHead className="text-center" rowSpan={2}>사업장</TableHead>
                      <TableHead className="text-center text-emerald-700 border-b-0 pb-0" colSpan={2}>노트북</TableHead>
                      <TableHead className="text-center text-blue-700 border-b-0 pb-0" colSpan={2}>데스크탑</TableHead>
                      <TableHead className="text-center font-semibold" rowSpan={2}>합계</TableHead>
                    </TableRow>
                    <TableRow className="bg-gray-50 text-xs">
                      <TableHead className="text-center text-emerald-500 pt-0">일반</TableHead>
                      <TableHead className="text-center text-emerald-800 pt-0">설계</TableHead>
                      <TableHead className="text-center text-blue-500 pt-0">일반</TableHead>
                      <TableHead className="text-center text-blue-800 pt-0">설계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((companyCode) => {
                      const rows = filteredStats.filter((r) => r.companyCode === companyCode);
                      const companyName = rows[0].companyName;
                      const companyTotal = rows.reduce((s, r) => s + r.total, 0);
                      return rows.map((row: CompanySiteStatEntry, idx: number) => (
                        <TableRow key={`${row.companyCode}-${row.businessSiteCode}`} className="text-sm">
                          {idx === 0 && (
                            <TableCell className="text-center font-medium align-middle" rowSpan={rows.length}>
                              {companyName}
                            </TableCell>
                          )}
                          <TableCell className="text-center text-gray-700">{row.businessSiteName}</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.notebookHigh}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopNormal}대</TableCell>
                          <TableCell className="text-center text-gray-600">{row.desktopHigh}대</TableCell>
                          <TableCell className="text-center font-semibold">{row.total}대</TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

    </div>
  );
}
