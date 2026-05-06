"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditCreateDialog } from "@/components/audit/AuditCreateDialog";
import { auditApi } from "@/lib/audit-api";
import { Audit, AuditStatus } from "@/types";
import { P, useHasPermission } from "@/lib/permissions";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<AuditStatus, string> = {
  PLANNED: "예정",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

const STATUS_COLOR: Record<AuditStatus, string> = {
  PLANNED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

export default function AuditPage() {
  return (
    <Suspense>
      <AuditPageInner />
    </Suspense>
  );
}

function AuditPageInner() {
  const canManage = useHasPermission(P.AUDIT_MANAGE);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: auditApi.getAll,
  });

  async function handleDelete(audit: Audit) {
    if (!confirm(`"${audit.title}" 실사를 삭제하시겠습니까? 모든 실사 항목도 함께 삭제됩니다.`)) return;
    try {
      await auditApi.delete(audit.id);
      toast.success("실사가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  }

  const audits: Audit[] = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">자산 실사 관리</h1>
          {!isLoading && <p className="text-sm text-gray-500">전체 {audits.length}건</p>}
        </div>
        {canManage && <AuditCreateDialog />}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <Table className="min-w-[750px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center w-16">No.</TableHead>
              <TableHead>실사 제목</TableHead>
              <TableHead className="text-center w-24">사업장</TableHead>
              <TableHead className="text-center w-28">기간</TableHead>
              <TableHead className="text-center w-24">상태</TableHead>
              <TableHead className="text-center w-32">진행률</TableHead>
              <TableHead className="text-center w-20">불일치</TableHead>
              <TableHead className="text-center w-24">등록자</TableHead>
              <TableHead className="text-center w-16">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : audits.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                      등록된 실사가 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : audits.map((audit, idx) => {
                  const progress = audit.totalCount > 0
                    ? Math.round((audit.verifiedCount / audit.totalCount) * 100)
                    : 0;

                  return (
                    <TableRow key={audit.id} className="hover:bg-gray-50">
                      <TableCell className="text-center text-sm text-gray-400">{idx + 1}</TableCell>
                      <TableCell>
                        <Link href={`/audit/${audit.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {audit.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm">{audit.businessSiteCode}</TableCell>
                      <TableCell className="text-center text-xs text-gray-500">
                        {audit.startDate} ~ {audit.endDate}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${STATUS_COLOR[audit.status]}`}>
                          {STATUS_LABEL[audit.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {audit.verifiedCount}/{audit.totalCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {audit.mismatchCount > 0 ? (
                          <span className="text-sm font-semibold text-red-600">{audit.mismatchCount}</span>
                        ) : (
                          <span className="text-sm text-gray-300">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm text-gray-500">{audit.createdBy}</TableCell>
                      <TableCell className="text-center">
                        {canManage && (
                          <button
                            onClick={() => handleDelete(audit)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
