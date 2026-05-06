"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, HardDrive, Loader2, Monitor, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { rentalApi } from "@/lib/rental-api";
import { useHasPermission } from "@/lib/permissions";
import { toast } from "sonner";

export default function ResetPage() {
  const canDelete = useHasPermission("rental:delete");
  const router = useRouter();

  useEffect(() => {
    if (canDelete === false) router.replace("/");
  }, [canDelete, router]);

  if (!canDelete) return null;

  return <ResetPageInner />;
}

function ResetPageInner() {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: rentalApi.getDashboard,
  });

  async function handleDeleteAll() {
    if (confirmInput !== "전체삭제") return;
    setDeleting(true);
    setConfirmInput("");
    try {
      await rentalApi.deleteAllRentalPcs();
      toast.success("모든 렌탈 PC 데이터가 삭제되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
      queryClient.invalidateQueries({ queryKey: ["expiringPcs"] });
    } catch {
      toast.error("전체 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const totalCount = dashboard?.totalCount ?? 0;
  const assignedCount = dashboard?.assignedCount ?? 0;
  const returnedCount = dashboard?.returnedCount ?? 0;

  return (
    <div className="max-w-lg mx-auto mt-8 space-y-6">
      {/* 경고 배너 */}
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-5 py-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-red-700 dark:text-red-400 text-sm">데이터가 영구적으로 삭제됩니다</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/70">
            배정 정보, 서약서 이력, 교체 이력이 모두 함께 삭제되며 복구할 수 없습니다.
            엑셀 데이터 재업로드 전 기존 데이터를 정리할 때만 사용하세요.
          </p>
        </div>
      </div>

      {/* 현황 카드 */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Monitor className="w-4 h-4" /> 전체 렌탈 PC
          </span>
          {isLoading
            ? <Skeleton className="h-5 w-12" />
            : <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount.toLocaleString()}대</span>}
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UserCheck className="w-4 h-4" /> 배정된 PC
          </span>
          {isLoading
            ? <Skeleton className="h-5 w-12" />
            : <span className="font-semibold text-blue-600">{assignedCount.toLocaleString()}대</span>}
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <HardDrive className="w-4 h-4" /> 반납된 PC
          </span>
          {isLoading
            ? <Skeleton className="h-5 w-12" />
            : <span className="font-semibold text-gray-500">{returnedCount.toLocaleString()}대</span>}
        </div>
      </div>

      {/* 전체 삭제 확인 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-5 space-y-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">전체 삭제 확인</p>
          <p className="text-xs text-gray-500 mt-1">
            아래 입력창에 <span className="font-mono font-semibold text-red-600">전체삭제</span>를 입력하고 버튼을 누르세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="전체삭제"
            className="flex-1"
            disabled={deleting || totalCount === 0}
            onKeyDown={(e) => { if (e.key === "Enter") handleDeleteAll(); }}
          />
          <Button
            variant="destructive"
            disabled={confirmInput !== "전체삭제" || deleting || totalCount === 0}
            onClick={handleDeleteAll}
            className="gap-1.5 shrink-0"
          >
            {deleting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 삭제 중...</>
              : <><Trash2 className="w-4 h-4" /> 전체 삭제</>}
          </Button>
        </div>
        {totalCount === 0 && !isLoading && (
          <p className="text-xs text-emerald-600">삭제할 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
