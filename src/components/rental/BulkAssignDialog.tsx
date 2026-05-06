"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { useAuthStore } from "@/store/authStore";
import { UserProfile } from "@/types";
import { toast } from "sonner";

interface BulkAssignDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  rentalNo: string;
  empNo: string;
}

interface PreviewRow extends ParsedRow {
  user: UserProfile | null;
  status: "ok" | "not_found" | "no_empno";
}

export function BulkAssignDialog({ open, onClose }: BulkAssignDialogProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    setResolving(true);

    try {
      // Excel 파싱 — 첫 번째 시트, A열=렌탈번호, B열=사번
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // 헤더 행 스킵 (첫 셀이 문자열이고 숫자가 아니면 헤더로 판단)
      const dataRows = rows.filter((row, idx) => {
        if (idx === 0) {
          const first = String(row[0] ?? "").trim();
          return /^[A-Z0-9\-]+$/i.test(first) && first !== "" && !/렌탈|번호|no/i.test(first);
        }
        return true;
      });

      const parsed: ParsedRow[] = dataRows
        .filter((row) => row[0] && row[1])
        .map((row) => ({
          rentalNo: String(row[0]).trim(),
          empNo: String(row[1]).trim(),
        }));

      if (parsed.length === 0) {
        toast.error("유효한 데이터가 없습니다. A열: 렌탈번호, B열: 사번 형식인지 확인하세요.");
        setResolving(false);
        return;
      }

      // BFF에서 전체 유저 로드 후 empNo 매핑
      const empNos = [...new Set(parsed.map((r) => r.empNo))];
      const userMap = new Map<string, UserProfile>();

      // 각 고유 empNo에 대해 검색 (BFF 캐시 덕분에 빠름)
      await Promise.all(
        empNos.map(async (empNo) => {
          try {
            const results = await userApi.searchUsers(empNo, undefined, 5);
            const match = results.find((u) => u.empNo === empNo);
            if (match) userMap.set(empNo, match);
          } catch {
            // 개별 실패는 무시
          }
        })
      );

      const previewRows: PreviewRow[] = parsed.map((row) => {
        if (!row.empNo) return { ...row, user: null, status: "no_empno" };
        const user = userMap.get(row.empNo) ?? null;
        return { ...row, user, status: user ? "ok" : "not_found" };
      });

      setPreview(previewRows);
    } catch {
      toast.error("파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setResolving(false);
    }
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => {
      const assignedBy = currentUser
        ? (currentUser.familyName && currentUser.givenName
            ? `${currentUser.familyName}${currentUser.givenName}`
            : currentUser.name)
        : "시스템";

      const items = (preview ?? [])
        .filter((r) => r.status === "ok" && r.user)
        .map((r) => ({
          rentalNo: r.rentalNo,
          assignmentType: "PERSONAL" as const,
          empNo: r.user!.empNo ?? r.user!.username,
          userName: r.user!.name,
          department: r.user!.departmentName ?? r.user!.department ?? null,
          companyCode: r.user!.companyCode ?? null,
          businessSiteCode: r.user!.businessSiteCode ?? null,
        }));

      return rentalApi.batchAssign({ items, assignedBy });
    },
    onSuccess: async (result) => {
      toast.success(`${result.length}건 배정이 완료되었습니다.`);
      await queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["expiringPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      handleClose();
    },
    onError: () => toast.error("일괄 배정 중 오류가 발생했습니다."),
  });

  function handleClose() {
    setPreview(null);
    setFileName("");
    onClose();
  }

  const okCount = preview?.filter((r) => r.status === "ok").length ?? 0;
  const failCount = preview?.filter((r) => r.status !== "ok").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            사용자 일괄 배정
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Excel A열: 렌탈번호 &nbsp;·&nbsp; B열: 사번 (헤더 행 포함 가능)
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 파일 선택 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            <Upload className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-500 flex-1">
              {fileName || "Excel 파일을 클릭해 선택하세요 (.xlsx, .xls)"}
            </span>
            <Button variant="outline" size="sm" className="shrink-0" tabIndex={-1}>파일 선택</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>

          {/* 로딩 */}
          {resolving && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          )}

          {/* 미리보기 */}
          {preview && !resolving && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-medium">{okCount}건 배정 가능</span>
                {failCount > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600 font-medium">{failCount}건 매핑 실패</span>
                  </>
                )}
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-xs">
                      <TableHead className="text-center w-8">#</TableHead>
                      <TableHead className="w-36">렌탈번호</TableHead>
                      <TableHead className="w-24">사번</TableHead>
                      <TableHead className="w-28">이름</TableHead>
                      <TableHead>부서</TableHead>
                      <TableHead className="text-center w-20">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx} className={row.status !== "ok" ? "bg-red-50/50" : ""}>
                        <TableCell className="text-center text-xs text-gray-400">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{row.rentalNo}</TableCell>
                        <TableCell className="text-sm">{row.empNo || "-"}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {row.user?.name ?? <span className="text-gray-300">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {row.user?.departmentName ?? row.user?.department ?? <span className="text-gray-300">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.status === "ok" ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">매핑됨</Badge>
                          ) : row.status === "not_found" ? (
                            <Badge variant="destructive" className="text-xs">미발견</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-400">사번없음</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {failCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  미발견 항목은 배정에서 제외됩니다. 사번을 확인 후 재시도하세요.
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t px-5 py-4 shrink-0 flex justify-end gap-2 bg-gray-50">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>취소</Button>
          <Button
            onClick={() => submit()}
            disabled={!preview || okCount === 0 || isPending}
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />처리 중...</>
              : `${okCount}건 일괄 배정`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
