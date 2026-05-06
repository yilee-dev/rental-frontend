"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, RotateCcw, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReturnDialog } from "@/components/rental/ReturnDialog";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { RentalPc, RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };

export default function RecoveryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [returnTarget, setReturnTarget] = useState<RentalPc | null>(null);

  const { data: assignedPcs = [], isLoading: isLoadingPcs } = useQuery({
    queryKey: ["assignedPcs"],
    queryFn: rentalApi.getAssignedPcs,
  });

  const { data: retiredUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["retiredUsers"],
    queryFn: userApi.getRetiredUsers,
  });

  const isLoading = isLoadingPcs || isLoadingUsers;

  // 퇴직자 사번 Set — 빠른 조회용
  const retiredEmpNos = useMemo(
    () => new Set(retiredUsers.map((u) => u.empNo).filter(Boolean) as string[]),
    [retiredUsers]
  );

  // 퇴직자에게 배정된 PC만 필터링 (개인 배정이고 사번이 퇴직자 목록에 있는 경우)
  const recoveryList = useMemo(
    () =>
      assignedPcs.filter(
        (pc) =>
          pc.assignment?.assignmentType !== "DEPARTMENT" &&
          pc.assignment?.assignmentType !== "SITE" &&
          pc.assignment?.empNo &&
          retiredEmpNos.has(pc.assignment.empNo)
      ),
    [assignedPcs, retiredEmpNos]
  );

  const filtered = search
    ? recoveryList.filter(
        (pc) =>
          pc.rentalNo.toLowerCase().includes(search.toLowerCase()) ||
          pc.assignment?.userName?.includes(search) ||
          pc.assignment?.empNo?.includes(search) ||
          pc.assignment?.department?.includes(search)
      )
    : recoveryList;

  async function handleUndoAssign(pc: RentalPc) {
    try {
      await rentalApi.removeAssignment(pc.id);
      toast.success("배정이 해제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["assignedPcs"] });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("배정 해제 중 오류가 발생했습니다.");
    }
  }

  function handleExportCsv() {
    const headers = ["렌탈번호", "유형", "사양", "게시일", "만료일", "월 렌탈료", "사번", "이름", "부서", "소속사", "사업장"];
    const rows = filtered.map((pc) => [
      pc.rentalNo,
      RENTAL_TYPE_LABEL[pc.rentalType],
      RENTAL_SPEC_LABEL[pc.rentalSpec],
      pc.rentalStartDate,
      pc.rentalEndDate,
      pc.monthlyFee,
      pc.assignment?.empNo ?? "",
      pc.assignment?.userName ?? "",
      pc.assignment?.department ?? "",
      "", // 소속사 (assignment에 companyCode만 있어서 생략)
      pc.assignment?.businessSiteCode ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `회수대상_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <ReturnDialog
        rental={returnTarget}
        open={!!returnTarget}
        onClose={() => {
          setReturnTarget(null);
          queryClient.invalidateQueries({ queryKey: ["assignedPcs"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-500" />
            퇴직자 PC 회수 관리
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">
              회수 대상 <span className="font-semibold text-red-600">{recoveryList.length}건</span>
              {search && ` / 검색 결과 ${filtered.length}건`}
              {retiredUsers.length > 0 && (
                <span className="ml-2 text-gray-400">
                  (퇴직부서 임직원 {retiredUsers.length}명 기준)
                </span>
              )}
            </p>
          )}
        </div>
        {filtered.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            CSV 다운로드
          </Button>
        )}
      </div>

      {/* 안내 배너 */}
      {!isLoading && recoveryList.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm flex items-start gap-3 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            퇴직부서로 이동된 임직원에게 배정된 PC 목록입니다.
            오프라인 회수 후 <strong>반납 처리</strong> 또는 <strong>배정 해제</strong>를 진행해주세요.
          </p>
        </div>
      )}

      {/* 검색 */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="렌탈번호, 사번, 이름, 부서 검색..."
        className="w-full sm:max-w-sm"
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <Table className="min-w-[950px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center w-36">렌탈번호</TableHead>
              <TableHead className="text-center w-20">유형</TableHead>
              <TableHead className="text-center w-16">사양</TableHead>
              <TableHead className="text-center w-28">게시일</TableHead>
              <TableHead className="text-center w-28">만료일</TableHead>
              <TableHead className="text-center w-24">월 렌탈료</TableHead>
              <TableHead className="text-center w-24">사번</TableHead>
              <TableHead className="text-center w-24">이름</TableHead>
              <TableHead className="text-center w-36">부서</TableHead>
              <TableHead className="text-center w-20">사업장</TableHead>
              <TableHead className="text-center w-32">처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-16 text-gray-400">
                  {recoveryList.length === 0
                    ? (
                      <div className="flex flex-col items-center gap-2">
                        <UserX className="w-8 h-8 text-gray-300" />
                        <p>퇴직부서 임직원에게 배정된 PC가 없습니다.</p>
                      </div>
                    )
                    : "검색 결과가 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((pc) => (
                <TableRow key={pc.id} className="hover:bg-red-50/50">
                  <TableCell className="text-center font-mono text-sm font-medium">
                    {pc.rentalNo}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={pc.rentalType === "NOTEBOOK" ? "default" : "secondary"} className="text-xs">
                      {RENTAL_TYPE_LABEL[pc.rentalType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${pc.rentalSpec === "HIGH" ? "border-amber-400 bg-amber-50 text-amber-700" : ""}`}
                    >
                      {RENTAL_SPEC_LABEL[pc.rentalSpec]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{pc.rentalStartDate}</TableCell>
                  <TableCell className="text-center text-sm">{pc.rentalEndDate}</TableCell>
                  <TableCell className="text-center text-sm">{pc.monthlyFee.toLocaleString()}원</TableCell>
                  <TableCell className="text-center text-sm font-mono text-gray-600">
                    {pc.assignment?.empNo ?? "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {pc.assignment?.userName ?? "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm text-gray-600 w-40 max-w-[160px] truncate" title={pc.assignment?.department ?? ""}>
                    {pc.assignment?.department
                      ? pc.assignment.department.split("/").slice(-2).join(" / ")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-gray-600">
                    {pc.assignment?.businessSiteCode ?? "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => setReturnTarget(pc)}
                        title="반납 처리"
                      >
                        <RotateCcw className="w-3 h-3" />
                        반납
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 px-2 text-gray-500 hover:text-red-600"
                        onClick={() => handleUndoAssign(pc)}
                        title="배정만 해제 (재고로 전환)"
                      >
                        배정 해제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
