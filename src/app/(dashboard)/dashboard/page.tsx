"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Monitor, TrendingUp, Undo2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { rentalApi } from "@/lib/rental-api";
import { DashboardStats, YearlyTypeEntry } from "@/types";

const monthlyChartConfig = {
  fee: { label: "월 렌탈료", color: "#3b82f6" },
};

const yearlyChartConfig = {
  notebookNormal: { label: "노트북 · 일반", color: "#6ee7b7" },
  notebookHigh:   { label: "노트북 · 설계", color: "#065f46" },
  desktopNormal:  { label: "데스크탑 · 일반", color: "#93c5fd" },
  desktopHigh:    { label: "데스크탑 · 설계", color: "#1d4ed8" },
};

function StatCard({
  title, value, sub, icon: Icon, loading, highlight, onClick,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType;
  loading: boolean; highlight?: boolean; onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={onClick}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</p>
            )}
            {sub && !loading && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${highlight ? "bg-red-50" : "bg-blue-50"}`}>
            <Icon className={`w-5 h-5 ${highlight ? "text-red-500" : "text-blue-600"}`} />
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: rentalApi.getDashboard,
  });

  const [selectedYear, setSelectedYear] = useState("ALL");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">대시보드</h1>

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
          onClick={() => router.push("/returns")}
        />
      </div>

      {/* 년도별 집계 블록 */}
      {!isLoading && data && data.yearlyStats.length > 0 && (
        <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${data.yearlyStats.length}, minmax(0, 1fr))` }}>
          {data.yearlyStats.map((s) => (
            <div
              key={s.year}
              className="flex flex-col items-center justify-center gap-1 py-4 px-2 bg-white border rounded-lg hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => setSelectedYear(String(s.year))}
            >
              <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">
                렌탈 년도
              </span>
              <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">
                {String(s.year).padStart(2, "0")}년도
              </span>
              <span className="text-lg font-bold text-blue-600">{s.total}대</span>
              <span className="text-[10px] text-gray-400">
                노트북 {s.notebookNormal + s.notebookHigh} / 데스크탑 {s.desktopNormal + s.desktopHigh}
              </span>
            </div>
          ))}
        </div>
      )}
      {isLoading && (
        <div className="grid grid-cols-4 gap-3">
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
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => [`${Number(v).toLocaleString()}원`, "렌탈료"]} />}
                />
                <Bar dataKey="fee" fill="#3b82f6" radius={[4, 4, 0, 0]}>
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
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => [
                            `${value}대`,
                            yearlyChartConfig[name as keyof typeof yearlyChartConfig]?.label ?? name,
                          ]}
                        />
                      }
                    />
                    <Legend
                      formatter={(value) =>
                        yearlyChartConfig[value as keyof typeof yearlyChartConfig]?.label ?? value
                      }
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="notebookNormal" stackId="notebook" fill={yearlyChartConfig.notebookNormal.color} />
                    <Bar dataKey="notebookHigh" stackId="notebook" fill={yearlyChartConfig.notebookHigh.color} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="desktopNormal" stackId="desktop" fill={yearlyChartConfig.desktopNormal.color} />
                    <Bar dataKey="desktopHigh" stackId="desktop" fill={yearlyChartConfig.desktopHigh.color} radius={[3, 3, 0, 0]} />
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

      {/* 유형별 / 사양별 현황 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              유형별 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ChartContainer config={{ count: { label: "대수", color: "#3b82f6" } }} className="h-48 w-full">
                <BarChart
                  data={[
                    { name: "노트북", count: data.notebookCount },
                    { name: "데스크탑", count: data.desktopCount },
                  ]}
                  margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${v}대`, "대수"]} />} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: "#6b7280" }} formatter={(v: unknown) => `${v}대`} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              사양별 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ChartContainer config={{ count: { label: "대수", color: "#10b981" } }} className="h-48 w-full">
                <BarChart
                  data={[
                    { name: "일반", count: data.normalCount },
                    { name: "설계", count: data.highCount },
                  ]}
                  margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${v}대`, "대수"]} />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: "#6b7280" }} formatter={(v: unknown) => `${v}대`} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
