"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditApi } from "@/lib/audit-api";
import { AuditItem, AuditItemStatus, AuditStatus } from "@/types";
import { P, useHasPermission } from "@/lib/permissions";
import { ArrowLeft, CheckCircle2, Play, QrCode, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const EMPTY = "ALL";

const ITEM_STATUS_LABEL: Record<AuditItemStatus, string> = {
  PENDING: "미확인",
  VERIFIED: "일치",
  MISMATCH: "불일치",
  MISSING: "미발견",
};
const ITEM_STATUS_COLOR: Record<AuditItemStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  VERIFIED: "bg-emerald-100 text-emerald-700",
  MISMATCH: "bg-red-100 text-red-700",
  MISSING: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<AuditStatus, string> = {
  PLANNED: "예정",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

function formatDateTime(dt: string | null) {
  if (!dt) return "-";
  return dt.replace("T", " ").slice(0, 16);
}

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auditId = Number(id);
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.AUDIT_MANAGE);
  const canVerify = useHasPermission(P.AUDIT_VERIFY);

  const [statusFilter, setStatusFilter] = useState(EMPTY);
  const [search, setSearch] = useState("");

  const { data: audit, isLoading: isLoadingAudit } = useQuery({
    queryKey: ["audit", auditId],
    queryFn: () => auditApi.get(auditId),
  });

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ["auditItems", auditId],
    queryFn: () => auditApi.getItems(auditId),
  });

  const allItems: AuditItem[] = items ?? [];

  const filtered = allItems.filter((item) => {
    if (statusFilter !== EMPTY && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !item.rentalNo.toLowerCase().includes(q) &&
        !(item.assignedUserName?.toLowerCase().includes(q)) &&
        !(item.assignedEmpNo?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  async function handleStart() {
    try {
      await auditApi.start(auditId);
      toast.success("실사가 시작되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    } catch { toast.error("실사 시작에 실패했습니다."); }
  }

  async function handleComplete() {
    try {
      await auditApi.complete(auditId);
      toast.success("실사가 완료되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    } catch { toast.error("실사 완료에 실패했습니다."); }
  }

  const progress = audit && audit.totalCount > 0
    ? Math.round((audit.verifiedCount / audit.totalCount) * 100)
    : 0;

  const isLoading = isLoadingAudit || isLoadingItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/audit" className="p-1 rounded hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{audit?.title ?? "실사 상세"}</h1>
          {audit && (
            <p className="text-sm text-gray-500">
              {audit.businessSiteCode} · {audit.startDate} ~ {audit.endDate} · {STATUS_LABEL[audit.status]}
            </p>
          )}
        </div>
        {audit?.status === "PLANNED" && canManage && (
          <Button onClick={handleStart} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Play className="w-4 h-4" /> 실사 시작
          </Button>
        )}
        {audit?.status === "IN_PROGRESS" && (
          <div className="flex items-center gap-2">
            {canVerify && (
              <Link href={`/scan?auditId=${auditId}`}>
                <Button variant="outline" className="gap-2">
                  <QrCode className="w-4 h-4" /> QR 스캔
                </Button>
              </Link>
            )}
            {canManage && (
              <Button onClick={handleComplete} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> 실사 완료
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 진행률 */}
      {audit && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{audit.totalCount}</div>
            <div className="text-xs text-gray-500">전체</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{audit.verifiedCount}</div>
            <div className="text-xs text-gray-500">검증 완료</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{audit.mismatchCount}</div>
            <div className="text-xs text-gray-500">불일치</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{progress}%</div>
            <div className="text-xs text-gray-500">진행률</div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="렌탈번호, 사용자명, 사번 검색"
          className="h-8 text-sm w-64"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? EMPTY)}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue placeholder="상태 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>상태 전체</SelectItem>
            <SelectItem value="PENDING">미확인</SelectItem>
            <SelectItem value="VERIFIED">일치</SelectItem>
            <SelectItem value="MISMATCH">불일치</SelectItem>
            <SelectItem value="MISSING">미발견</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center w-40">렌탈번호</TableHead>
              <TableHead className="text-center w-24">유형</TableHead>
              <TableHead className="text-center">배정 사용자</TableHead>
              <TableHead className="text-center">부서</TableHead>
              <TableHead className="text-center w-24">실사 상태</TableHead>
              <TableHead className="text-center w-24">실사자</TableHead>
              <TableHead className="text-center w-36">실사 일시</TableHead>
              <TableHead className="text-center">비고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                      실사 항목이 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((item) => (
                  <TableRow key={item.id} className={item.status === "MISMATCH" ? "bg-red-50" : "hover:bg-gray-50"}>
                    <TableCell className="text-center font-mono text-sm">{item.rentalNo}</TableCell>
                    <TableCell className="text-center text-xs">
                      {item.rentalType === "NOTEBOOK" ? "노트북" : "데스크탑"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {item.assignedUserName ? (
                        <span>{item.assignedUserName} <span className="text-gray-400 text-xs">({item.assignedEmpNo})</span></span>
                      ) : (
                        <span className="text-gray-300">미배정</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-500">
                      {item.assignedDepartment ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${ITEM_STATUS_COLOR[item.status]}`}>
                        {ITEM_STATUS_LABEL[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-500">{item.verifiedBy ?? "-"}</TableCell>
                    <TableCell className="text-center text-xs text-gray-500">{formatDateTime(item.verifiedAt)}</TableCell>
                    <TableCell className="text-center text-xs text-gray-500">{item.notes ?? "-"}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
