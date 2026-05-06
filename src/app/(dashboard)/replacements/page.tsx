"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rentalApi } from "@/lib/rental-api";
import { Replacement } from "@/types";

const EMPTY = "ALL";

function formatDateTime(dt: string) {
  if (!dt) return "-";
  return dt.replace("T", " ").slice(0, 16);
}

export default function ReplacementsPage() {
  return (
    <Suspense>
      <ReplacementsPageInner />
    </Suspense>
  );
}

function ReplacementsPageInner() {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["replacements"],
    queryFn: rentalApi.getAllReplacements,
  });

  const items: Replacement[] = data ?? [];

  const reasons = Array.from(new Set(items.map((r) => r.reason))).sort();

  const filtered = items.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.oldRentalNo.toLowerCase().includes(q) &&
        !r.newRentalNo.toLowerCase().includes(q) &&
        !r.replacedBy.toLowerCase().includes(q)
      ) return false;
    }
    if (reasonFilter !== EMPTY && r.reason !== reasonFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">교체 이력 관리</h1>
        {!isLoading && (
          <p className="text-sm text-gray-500">전체 {filtered.length}건</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="렌탈번호 또는 처리자 검색"
          className="h-8 text-sm w-full sm:w-64"
        />
        <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(v ?? EMPTY)}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-40">
            <SelectValue placeholder="사유 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>사유 전체</SelectItem>
            {reasons.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center w-16">No.</TableHead>
              <TableHead className="text-center">기존 렌탈번호</TableHead>
              <TableHead className="text-center w-12">→</TableHead>
              <TableHead className="text-center">교체 렌탈번호</TableHead>
              <TableHead className="text-center">교체 사유</TableHead>
              <TableHead className="text-center">처리자</TableHead>
              <TableHead className="text-center">교체일시</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      교체 이력이 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((r, idx) => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell className="text-center text-sm text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.oldRentalNo}</TableCell>
                    <TableCell className="text-center text-gray-400">→</TableCell>
                    <TableCell className="text-center font-mono text-sm font-semibold text-blue-600">{r.newRentalNo}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        {r.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.replacedBy}</TableCell>
                    <TableCell className="text-center text-sm text-gray-500">{formatDateTime(r.replacedAt)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
