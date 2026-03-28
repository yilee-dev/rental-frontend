"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, Download, FileSpreadsheet,
  Pencil, RotateCcw, Undo2, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RegisterDialog from "@/components/rental/RegisterDialog";
import { EditDialog } from "@/components/rental/EditDialog";
import { ReturnDialog } from "@/components/rental/ReturnDialog";
import { rentalApi } from "@/lib/rental-api";
import { RentalPc, RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };
const EMPTY = "ALL";

type SortKey = "rentalNo" | "rentalType" | "rentalSpec" | "rentalStartDate" | "rentalEndDate" | "monthlyFee";
type SortDir = "asc" | "desc";

function isExpiringSoon(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

function isNewThisMonth(startDate: string) {
  const now = new Date();
  const d = new Date(startDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isRecentlyUpdated(updatedAt: string | null, createdAt: string | null) {
  if (!updatedAt) return false;
  if (createdAt && Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) < 1000) return false;
  return Date.now() - new Date(updatedAt).getTime() <= 30 * 24 * 60 * 60 * 1000;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey?: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300 inline ml-1" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-blue-600 inline ml-1" />
    : <ChevronDown className="w-3 h-3 text-blue-600 inline ml-1" />;
}

export default function RentalPage() {
  return (
    <Suspense>
      <RentalPageInner />
    </Suspense>
  );
}

function RentalPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 필터 상태
  const [rentalNo, setRentalNo] = useState("");
  const [rentalType, setRentalType] = useState(EMPTY);
  const [rentalSpec, setRentalSpec] = useState(EMPTY);
  const [expiringOnly, setExpiringOnly] = useState(() => searchParams.get("filter") === "expiring");
  const [sortKey, setSortKey] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editTarget, setEditTarget] = useState<RentalPc | null>(null);
  const [returnTarget, setReturnTarget] = useState<RentalPc | null>(null);

  // 우클릭 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; rental: RentalPc } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    function handler(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) closeCtx();
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ctxMenu, closeCtx]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const hasFilter = !!rentalNo || rentalType !== EMPTY || rentalSpec !== EMPTY || expiringOnly;

  function resetFilters() {
    setRentalNo(""); setRentalType(EMPTY); setRentalSpec(EMPTY); setExpiringOnly(false);
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isLoadingAll } =
    useInfiniteQuery({
      queryKey: ["rentalPcs"],
      queryFn: ({ pageParam }) => rentalApi.getRentalPcs(pageParam as number | null, 20),
      initialPageParam: null as number | null,
      getNextPageParam: (last) => last.hasNext ? last.nextCursor : undefined,
      enabled: !expiringOnly,
    });

  const { data: expiringData, isLoading: isLoadingExpiring } =
    useQuery({
      queryKey: ["expiringPcs"],
      queryFn: rentalApi.getExpiringPcs,
      enabled: expiringOnly,
    });

  const isLoading = expiringOnly ? isLoadingExpiring : isLoadingAll;

  useEffect(() => {
    if (expiringOnly) return;
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [expiringOnly, fetchNextPage, hasNextPage, isFetchingNextPage]);

  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportResult(null);
    try {
      await rentalApi.uploadExcel(file);
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      setImportResult({ success: 1, errors: [] });
    } catch {
      setImportResult({ success: 0, errors: ["업로드 중 오류가 발생했습니다."] });
    }
  }, [queryClient]);

  const [isExporting, setIsExporting] = useState(false);
  async function handleExport() {
    setIsExporting(true);
    try { await rentalApi.exportExcel(); }
    catch { toast.error("내보내기에 실패했습니다."); }
    finally { setIsExporting(false); }
  }

  async function handleUndoReturn(rental: RentalPc) {
    try {
      await rentalApi.undoReturn(rental.id);
      toast.success("반납이 복구되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    } catch { toast.error("복구 중 오류가 발생했습니다."); }
  }

  async function handleReportLost(rental: RentalPc) {
    try {
      await rentalApi.reportLost(rental.id);
      toast.success("분실 신고가 접수되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
    } catch { toast.error("분실 신고 중 오류가 발생했습니다. 서버 연결을 확인해주세요."); }
  }

  async function handleUndoLost(rental: RentalPc) {
    try {
      await rentalApi.undoLost(rental.id);
      toast.success("분실 신고가 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
    } catch { toast.error("분실 신고 취소 중 오류가 발생했습니다."); }
  }

  const allItems: RentalPc[] = expiringOnly
    ? (expiringData ?? [])
    : (data?.pages.flatMap((p) => p.content) ?? []);

  let filtered = allItems.filter((pc) => {
    if (pc.isReturned) return false;
    if (rentalNo && !pc.rentalNo.toLowerCase().includes(rentalNo.toLowerCase())) return false;
    if (rentalType !== EMPTY && pc.rentalType !== rentalType) return false;
    if (rentalSpec !== EMPTY && pc.rentalSpec !== rentalSpec) return false;
    return true;
  });

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const cmp = String(a[sortKey]) < String(b[sortKey]) ? -1 : String(a[sortKey]) > String(b[sortKey]) ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  function SortTh({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) {
    return (
      <TableHead
        className={`text-center cursor-pointer select-none hover:bg-gray-100 ${className ?? ""}`}
        onClick={() => handleSort(col)}
      >
        {children}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </TableHead>
    );
  }

  return (
    <div className="space-y-4">
      <EditDialog rental={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />
      <ReturnDialog rental={returnTarget} open={!!returnTarget} onClose={() => setReturnTarget(null)} />

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 50 }}
          className="w-44 bg-white rounded-lg border shadow-lg py-1 text-sm"
        >
          <button
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
            onClick={() => { setEditTarget(ctxMenu.rental); closeCtx(); }}
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" /> 수정
          </button>
          {!ctxMenu.rental.isReturned ? (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-amber-700"
              onClick={() => { setReturnTarget(ctxMenu.rental); closeCtx(); }}
            >
              <Undo2 className="w-3.5 h-3.5" /> 반납 처리
            </button>
          ) : (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
              onClick={() => { handleUndoReturn(ctxMenu.rental); closeCtx(); }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> 반납 복구
            </button>
          )}
          <div className="border-t my-1" />
          {!ctxMenu.rental.isLost ? (
            <button
              className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
              onClick={() => { handleReportLost(ctxMenu.rental); closeCtx(); }}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> 분실 신고
            </button>
          ) : (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-500"
              onClick={() => { handleUndoLost(ctxMenu.rental); closeCtx(); }}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> 분실 신고 취소
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">렌탈 PC 목록</h1>
          {!isLoading && <p className="text-sm text-gray-500">전체 {allItems.length}건</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1 text-gray-500">
              <RotateCcw className="w-3.5 h-3.5" /> 필터 초기화
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm text-gray-600 hover:bg-accent hover:text-accent-foreground">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              내보내기
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExport} disabled={isExporting} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4 text-emerald-600" />
                {isExporting ? "추출 중..." : "엑셀 다운로드"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RegisterDialog />
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {expiringOnly && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm flex items-center justify-between gap-4 text-amber-800">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 30일 내 만료 예정 항목만 표시 중
          </p>
          <button onClick={() => setExpiringOnly(false)} className="hover:opacity-60 text-lg leading-none">×</button>
        </div>
      )}

      {importResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-4 ${importResult.errors.length === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <p className="font-medium">{importResult.errors.length === 0 ? "업로드 완료" : `${importResult.errors.length}건 오류`}</p>
          <button onClick={() => setImportResult(null)} className="hover:opacity-60 text-lg leading-none">×</button>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortTh col="rentalNo" className="w-48">렌탈번호</SortTh>
              <SortTh col="rentalType" className="w-28">유형</SortTh>
              <SortTh col="rentalSpec" className="w-24">사양</SortTh>
              <SortTh col="rentalStartDate" className="w-36">게시일</SortTh>
              <SortTh col="rentalEndDate" className="w-36">만료일</SortTh>
              <SortTh col="monthlyFee" className="w-32">월 렌탈료</SortTh>
              <TableHead className="text-center w-28">상태</TableHead>
              <TableHead className="text-center w-20">관리</TableHead>
            </TableRow>

            {/* 필터 행 */}
            <TableRow className="bg-gray-50 border-t">
              {/* 렌탈번호 검색 */}
              <TableHead className="py-1.5 px-2">
                <Input
                  value={rentalNo}
                  onChange={(e) => setRentalNo(e.target.value)}
                  placeholder="번호 검색"
                  className="h-7 text-xs w-full"
                />
              </TableHead>
              {/* 유형 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={rentalType} onValueChange={(v) => setRentalType(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    <SelectItem value="NOTEBOOK">노트북</SelectItem>
                    <SelectItem value="DESKTOP">데스크탑</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              {/* 사양 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={rentalSpec} onValueChange={(v) => setRentalSpec(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    <SelectItem value="NORMAL">일반</SelectItem>
                    <SelectItem value="HIGH">설계</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead /><TableHead /><TableHead /><TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
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
                      등록된 렌탈 PC가 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((pc) => {
                  const isNew = isNewThisMonth(pc.rentalStartDate);
                  const isUpdated = isRecentlyUpdated(pc.updatedAt, pc.createdAt);
                  const expiringSoon = isExpiringSoon(pc.rentalEndDate) && !pc.isReturned && !pc.isLost;

                  return (
                    <TableRow
                      key={pc.id}
                      className={[
                        "cursor-default",
                        pc.isLost ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50",
                        pc.isReturned && !pc.isLost ? "opacity-50" : "",
                      ].join(" ")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ x: e.clientX, y: e.clientY, rental: pc });
                      }}
                    >
                      {/* 렌탈번호 — 뱃지가 왼쪽 */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse shrink-0">
                              NEW
                            </span>
                          )}
                          {isUpdated && !isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-500 border border-sky-200 shrink-0">
                              UPD
                            </span>
                          )}
                          {pc.isLost && (
                            <span className="text-sm shrink-0" title="분실 신고됨">🚨</span>
                          )}
                          <span className="font-mono text-sm">{pc.rentalNo}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant={pc.rentalType === "NOTEBOOK" ? "default" : "secondary"} className="text-xs">
                          {RENTAL_TYPE_LABEL[pc.rentalType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={pc.rentalSpec === "HIGH" ? "default" : "outline"} className="text-xs">
                          {RENTAL_SPEC_LABEL[pc.rentalSpec]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{pc.rentalStartDate}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className={expiringSoon ? "text-red-500 font-semibold" : ""}>{pc.rentalEndDate}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{pc.monthlyFee.toLocaleString()}원</TableCell>

                      {/* 상태 */}
                      <TableCell className="text-center">
                        {pc.isLost ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">분실</span>
                        ) : pc.isReturned ? (
                          <span className="text-xs text-gray-400">반납완료</span>
                        ) : expiringSoon ? (
                          <span className="text-xs text-red-500 font-medium">만료임박</span>
                        ) : (
                          <span className="text-xs text-emerald-600">정상</span>
                        )}
                      </TableCell>

                      {/* 관리 버튼 */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => setEditTarget(pc)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                            title="수정"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!pc.isReturned && (
                            <button
                              onClick={() => setReturnTarget(pc)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600"
                              title="반납 처리"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => pc.isLost ? handleUndoLost(pc) : handleReportLost(pc)}
                            className={`p-1 rounded hover:bg-red-50 ${pc.isLost ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                            title={pc.isLost ? "분실 신고 취소" : "분실 신고"}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        <div ref={bottomRef} className="h-4" />
        {isFetchingNextPage && (
          <div className="py-3 text-center text-sm text-gray-400">불러오는 중...</div>
        )}
      </div>
    </div>
  );
}
