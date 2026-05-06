"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, Download, FileSpreadsheet,
  Layers, MapPin, Monitor, Pencil, RotateCcw, Undo2, AlertTriangle, UserCheck, UserPlus, Package,
  QrCode, Printer, RefreshCw, Search, X,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DsignStatusBadge from "@/components/rental/DsignStatusBadge";
import { sendDsignPledge, triggerDsignPoll } from "@/lib/dsign-api";
import RegisterDialog from "@/components/rental/RegisterDialog";
import { EditDialog } from "@/components/rental/EditDialog";
import { ReturnDialog } from "@/components/rental/ReturnDialog";
import { AssignDialog } from "@/components/rental/AssignDialog";
import QrCodeDisplay from "@/components/rental/QrCodeDisplay";
import QrLabelPrintDialog from "@/components/rental/QrLabelPrintDialog";
import { ReplacementDialog } from "@/components/rental/ReplacementDialog";
import { SearchDialog } from "@/components/rental/SearchDialog";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { P, useHasPermission } from "@/lib/permissions";
import { DepartmentNode, RentalPc, RentalPcSearchParams, RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };
const EMPTY = "ALL";


type SortKey = "rentalNo" | "rentalType" | "rentalSpec" | "rentalStartDate" | "rentalEndDate" | "monthlyFee";
type SortDir = "asc" | "desc";

function getIntakeYear(rentalNo: string): string | null {
  if (rentalNo.length === 10) return rentalNo.substring(0, 2);
  if (rentalNo.length === 8) return rentalNo.substring(1, 3);
  return null;
}

function getExpiryStatus(endDate: string): "EXTENDED" | "EXPIRING" | null {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff < 0) return "EXTENDED";
  if (diff <= 30 * 24 * 60 * 60 * 1000) return "EXPIRING";
  return null;
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
  const canWrite = useHasPermission(P.RENTAL_WRITE);
  const canDelete = useHasPermission(P.RENTAL_DELETE);
  const canQr = useHasPermission(P.RENTAL_QR);
  const urlSearchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // 필터 상태
  const [rentalNo, setRentalNo] = useState("");
  const [intakeYear, setIntakeYear] = useState(EMPTY);
  const [rentalType, setRentalType] = useState(EMPTY);
  const [rentalSpec, setRentalSpec] = useState(EMPTY);
  const [businessSite, setBusinessSite] = useState(EMPTY);
  const [assignFilter, setAssignFilter] = useState(EMPTY); // ALL | ASSIGNED | UNASSIGNED
  const [statusFilter, setStatusFilter] = useState(() =>
    urlSearchParams.get("filter") === "expiring" ? "EXPIRING" : EMPTY
  );
  const [sortKey, setSortKey] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const expiringOnly = statusFilter === "EXPIRING";

  // rentalNo 입력 debounce → 서버 검색용
  const [debouncedRentalNo, setDebouncedRentalNo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRentalNo(rentalNo.trim()), 300);
    return () => clearTimeout(t);
  }, [rentalNo]);

  const [editTarget, setEditTarget] = useState<RentalPc | null>(null);
  const [returnTarget, setReturnTarget] = useState<RentalPc | null>(null);
  const [assignTarget, setAssignTarget] = useState<RentalPc | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<RentalPc | null>(null);

  // 상세 검색 (Ctrl+F로 열기)
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [searchQuery, setSearchQuery] = useState<RentalPcSearchParams | null>(null);

  // QR 라벨 인쇄
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [qrPrintOpen, setQrPrintOpen] = useState(false);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const hasFilter = searchQuery !== null || !!rentalNo || intakeYear !== EMPTY || rentalType !== EMPTY || rentalSpec !== EMPTY || businessSite !== EMPTY || statusFilter !== EMPTY || assignFilter !== EMPTY;

  function resetFilters() {
    setRentalNo(""); setIntakeYear(EMPTY); setRentalType(EMPTY); setRentalSpec(EMPTY); setBusinessSite(EMPTY); setStatusFilter(EMPTY); setAssignFilter(EMPTY); setSearchQuery(null);
  }

  const PAGE_SIZE = 30;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isLoadingAll } =
    useInfiniteQuery({
      queryKey: ["rentalPcs"],
      queryFn: ({ pageParam }) => rentalApi.getRentalPcs(pageParam as number | null, PAGE_SIZE),
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

  const { data: searchData, isLoading: isLoadingSearch } = useQuery({
    queryKey: ["searchPcs", searchQuery],
    queryFn: () => rentalApi.search(searchQuery!),
    enabled: searchQuery !== null,
  });

  const { data: rentalNoData, isLoading: isLoadingRentalNo } = useQuery({
    queryKey: ["searchByRentalNo", debouncedRentalNo],
    queryFn: () => rentalApi.search({ rentalNo: debouncedRentalNo }),
    enabled: !!debouncedRentalNo && searchQuery === null,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: rentalApi.getDashboard,
  });

  // 부서 트리 — AssignDialog 와 캐시 공유(["departments"]), 추가 API 호출 없음
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: userApi.getDepartments,
    staleTime: 10 * 60 * 1000,
  });

  // path → 정확한 팀명 맵 (T/OUT반 같이 "/" 포함 팀명 대응)
  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    function flatten(nodes: DepartmentNode[]) {
      for (const node of nodes) {
        map.set(node.path, node.name);
        if (node.children.length) flatten(node.children);
      }
    }
    flatten(departments);
    return map;
  }, [departments]);

  const isSearchMode = searchQuery !== null;
  const isRentalNoMode = !!debouncedRentalNo && searchQuery === null;
  const isLoading = isSearchMode ? isLoadingSearch : isRentalNoMode ? isLoadingRentalNo : expiringOnly ? isLoadingExpiring : isLoadingAll;

  // 필터 활성 시 전체 데이터가 필요하므로 남은 페이지 자동 로드
  const needsFullData = assignFilter === "ASSIGNED" || assignFilter === "UNASSIGNED"
    || statusFilter === "EXTENDED" || statusFilter === "EXPIRING_ALL";
  useEffect(() => {
    if (needsFullData && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [needsFullData, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 무한 스크롤 — sentinel이 DOM에 있을 때만 observer 연결 (callback ref)
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingRef = useRef(isFetchingNextPage);
  const fetchNextPageRef = useRef(fetchNextPage);
  hasNextPageRef.current = hasNextPage;
  isFetchingRef.current = isFetchingNextPage;
  fetchNextPageRef.current = fetchNextPage;

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPageRef.current && !isFetchingRef.current)
        fetchNextPageRef.current();
    }, { threshold: 0.5 });
    observer.observe(node);
    // cleanup은 node가 DOM에서 제거될 때 자동으로 무효화됨
  }, []);

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
  const [isExportingWithAssignment, setIsExportingWithAssignment] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  async function handlePollDsign() {
    setIsPolling(true);
    try {
      await triggerDsignPoll();
      toast.success("서약 현황이 업데이트되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
    } catch {
      toast.error("서약 현황 업데이트에 실패했습니다.");
    } finally {
      setIsPolling(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try { await rentalApi.exportExcel(); }
    catch { toast.error("내보내기에 실패했습니다."); }
    finally { setIsExporting(false); }
  }

  async function handleExportWithAssignment() {
    setIsExportingWithAssignment(true);
    try { await rentalApi.exportExcelWithAssignment(); }
    catch { toast.error("내보내기에 실패했습니다."); }
    finally { setIsExportingWithAssignment(false); }
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

  async function handleStockReturn(rental: RentalPc) {
    if (!rental.assignment) {
      toast.info("배정된 사용자가 없습니다.");
      return;
    }
    try {
      await rentalApi.removeAssignment(rental.id);
      toast.success("재고 처리되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["expiringPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch { toast.error("재고 처리 중 오류가 발생했습니다."); }
  }

  const allItems: RentalPc[] = isSearchMode
    ? (searchData ?? [])
    : isRentalNoMode
    ? (rentalNoData ?? [])
    : expiringOnly
    ? (expiringData ?? [])
    : (data?.pages.flatMap((p) => p.content) ?? []);

  const intakeYears = Array.from(
    new Set(allItems.map((pc) => getIntakeYear(pc.rentalNo)).filter(Boolean) as string[])
  ).sort();

  const businessSiteCodes = Array.from(
    new Set(allItems.map((pc) => pc.assignment?.businessSiteCode).filter(Boolean) as string[])
  ).sort();

  let filtered = isSearchMode ? [...allItems] : allItems.filter((pc) => {
    if (pc.isReturned) return false;
    // isRentalNoMode일 때는 서버에서 이미 필터링됨
    if (!isRentalNoMode && rentalNo && !pc.rentalNo.toLowerCase().includes(rentalNo.toLowerCase())) return false;
    if (intakeYear !== EMPTY && getIntakeYear(pc.rentalNo) !== intakeYear) return false;
    if (rentalType !== EMPTY && pc.rentalType !== rentalType) return false;
    if (rentalSpec !== EMPTY && pc.rentalSpec !== rentalSpec) return false;
    if (businessSite !== EMPTY && pc.assignment?.businessSiteCode !== businessSite) return false;
    if (assignFilter === "ASSIGNED" && !pc.assignment) return false;
    if (assignFilter === "UNASSIGNED" && !!pc.assignment) return false;
    if (statusFilter === "LOST") return pc.isLost;
    if (statusFilter === "NORMAL") {
      const expiryStatus = getExpiryStatus(pc.rentalEndDate);
      return !pc.isLost && !expiryStatus;
    }
    // EXTENDED / EXPIRING / EXPIRING_ALL: expiringData API가 둘 다 포함하므로 여기서 분리
    if (statusFilter === "EXTENDED") {
      return !pc.isLost && getExpiryStatus(pc.rentalEndDate) === "EXTENDED";
    }
    if (statusFilter === "EXPIRING") {
      return !pc.isLost && getExpiryStatus(pc.rentalEndDate) === "EXPIRING";
    }
    if (statusFilter === "EXPIRING_ALL") {
      return !pc.isLost && getExpiryStatus(pc.rentalEndDate) !== null;
    }
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every((pc) => selectedIds.has(pc.id));
  const someChecked = filtered.some((pc) => selectedIds.has(pc.id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filtered.map((pc) => pc.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  const selectedRentalNos = filtered.filter((pc) => selectedIds.has(pc.id)).map((pc) => pc.rentalNo);

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
      <AssignDialog rental={assignTarget} open={!!assignTarget} onClose={() => setAssignTarget(null)} />
      <ReplacementDialog rental={replaceTarget} open={!!replaceTarget} onClose={() => setReplaceTarget(null)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSearch={setSearchQuery} />
      <QrLabelPrintDialog
        open={qrPrintOpen}
        onClose={() => setQrPrintOpen(false)}
        selectedIds={Array.from(selectedIds)}
        selectedRentalNos={selectedRentalNos}
      />

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 50 }}
          className="w-44 bg-white rounded-lg border shadow-lg py-1 text-sm"
        >
          {canWrite && (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
              onClick={() => { setEditTarget(ctxMenu.rental); closeCtx(); }}
            >
              <Pencil className="w-3.5 h-3.5 text-gray-500" /> 수정
            </button>
          )}
          {canWrite && (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600 cursor-pointer"
              onClick={() => { setAssignTarget(ctxMenu.rental); closeCtx(); }}
            >
              <UserCheck className="w-3.5 h-3.5" /> 배정
            </button>
          )}
          {canDelete && (
            <>
              <div className="border-t my-1" />
              {!ctxMenu.rental.isLost ? (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600 cursor-pointer"
                  onClick={() => { handleReportLost(ctxMenu.rental); closeCtx(); }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> 분실
                </button>
              ) : (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-500 cursor-pointer"
                  onClick={() => { handleUndoLost(ctxMenu.rental); closeCtx(); }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> 분실 취소
                </button>
              )}
              {!ctxMenu.rental.isReturned ? (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-amber-50 flex items-center gap-2 text-amber-700 cursor-pointer"
                  onClick={() => { setReturnTarget(ctxMenu.rental); closeCtx(); }}
                >
                  <Undo2 className="w-3.5 h-3.5" /> 반납
                </button>
              ) : (
                <button
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600 cursor-pointer"
                  onClick={() => { handleUndoReturn(ctxMenu.rental); closeCtx(); }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 반납 복구
                </button>
              )}
            </>
          )}
          {canWrite && (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-orange-600 cursor-pointer"
              onClick={() => { setReplaceTarget(ctxMenu.rental); closeCtx(); }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> 교체
            </button>
          )}
          <button
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-600 cursor-pointer"
            onClick={() => { handleStockReturn(ctxMenu.rental); closeCtx(); }}
          >
            <Package className="w-3.5 h-3.5" /> 재고
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-blue-500/80" />
            렌탈 PC 목록
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">
              {hasFilter
                ? (() => {
                    const total = dashboardData?.totalCount?.toLocaleString() ?? "-";
                    if (assignFilter === "ASSIGNED") {
                      const count = dashboardData?.assignedCount?.toLocaleString() ?? filtered.length.toString();
                      return <span>배정됨 <span className="font-semibold text-blue-600">{count}</span>건 / 전체 {total}건</span>;
                    }
                    if (assignFilter === "UNASSIGNED") {
                      const count = dashboardData?.unassignedCount?.toLocaleString() ?? filtered.length.toString();
                      return <span>미배정 <span className="font-semibold text-amber-600">{count}</span>건 / 전체 {total}건</span>;
                    }
                    return <span><span className="font-semibold text-blue-600">{filtered.length}</span>건 / 전체 {total}건</span>;
                  })()
                : <span>전체 <span className="font-semibold text-gray-700 dark:text-gray-300">{dashboardData?.totalCount?.toLocaleString() ?? "-"}</span>건</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isSearchMode ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">상세 검색</span>
            <span className="sm:hidden">검색</span>
          </Button>
          {hasFilter && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1 text-gray-500">
              <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">필터 초기화</span><span className="sm:hidden">초기화</span>
            </Button>
          )}
          {canQr && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={selectedIds.size === 0}
              onClick={() => setQrPrintOpen(true)}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">QR 라벨</span> ({selectedIds.size})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm text-gray-600 hover:bg-accent hover:text-accent-foreground">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">내보내기</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleExport} disabled={isExporting} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4 text-emerald-600" />
                {isExporting ? "추출 중..." : "PC 목록"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWithAssignment} disabled={isExportingWithAssignment} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4 text-blue-600" />
                {isExportingWithAssignment ? "추출 중..." : "PC 목록 + 사용자 정보"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canWrite && <RegisterDialog />}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {isSearchMode && (
        <div className="rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 px-5 py-3.5 text-sm flex items-center justify-between gap-4 text-blue-600/90 dark:text-blue-300/80">
          <p className="font-medium flex items-center gap-2">
            <Search className="w-4 h-4 opacity-60" />
            상세 검색 결과: <span className="font-semibold">{filtered.length}</span>건
          </p>
          <button onClick={() => setSearchQuery(null)} className="hover:bg-blue-100/60 dark:hover:bg-blue-900/30 rounded-full w-7 h-7 flex items-center justify-center transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {(statusFilter === "EXPIRING" || statusFilter === "EXTENDED" || statusFilter === "EXPIRING_ALL") && (
        <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 px-5 py-3.5 text-sm flex items-center justify-between gap-4 text-amber-600/90 dark:text-amber-300/80">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 opacity-60" />
            {statusFilter === "EXTENDED" ? "만료일이 경과하여 연장 사용 중인 항목만 표시 중"
              : statusFilter === "EXPIRING_ALL" ? "만료임박 + 연장사용 항목 표시 중"
              : "30일 내 만료 예정 항목만 표시 중"}
          </p>
          <button onClick={() => setStatusFilter(EMPTY)} className="hover:bg-amber-100/60 dark:hover:bg-amber-900/30 rounded-full w-7 h-7 flex items-center justify-center transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {importResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-4 ${importResult.errors.length === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <p className="font-medium">{importResult.errors.length === 0 ? "업로드 완료" : `${importResult.errors.length}건 오류`}</p>
          <button onClick={() => setImportResult(null)} className="hover:opacity-60 text-lg leading-none">×</button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow className="bg-gray-50/60 dark:bg-gray-800/30">
              <TableHead className="text-center w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                />
              </TableHead>
              <SortTh col="rentalNo" className="w-48">렌탈번호</SortTh>
              <TableHead className="text-center w-16">년도</TableHead>
              <SortTh col="rentalType" className="w-24">유형</SortTh>
              <SortTh col="rentalSpec" className="w-20">사양</SortTh>
              <SortTh col="rentalStartDate" className="w-28">게시일</SortTh>
              <SortTh col="rentalEndDate" className="w-28">만료일</SortTh>
              <SortTh col="monthlyFee" className="w-28">월 렌탈료</SortTh>
              <TableHead className="text-center w-24">상태</TableHead>
              <TableHead className="text-center w-28">부서</TableHead>
              <TableHead className="text-center w-28">사용자</TableHead>
              <TableHead className="text-center w-24">사업장</TableHead>
              <TableHead className="text-center w-24">
                <span className="inline-flex items-center gap-1">
                  서약서
                  {canWrite && (
                    <button
                      onClick={handlePollDsign}
                      disabled={isPolling}
                      title="서약 현황 업데이트"
                      className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 disabled:opacity-40 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isPolling ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </span>
              </TableHead>
              <TableHead className="text-center w-20">관리</TableHead>
            </TableRow>

            {/* 필터 행 */}
            <TableRow className="bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
              <TableHead />
              {/* 렌탈번호 검색 */}
              <TableHead className="py-1.5 px-2">
                <Input
                  value={rentalNo}
                  onChange={(e) => setRentalNo(e.target.value)}
                  placeholder="번호 검색"
                  className="h-7 text-xs w-full"
                />
              </TableHead>
              {/* 년도 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={intakeYear} onValueChange={(v) => setIntakeYear(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    {intakeYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <TableHead /><TableHead /><TableHead />
              {/* 상태 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    <SelectItem value="NORMAL">정상</SelectItem>
                    <SelectItem value="EXPIRING_ALL">만료/연장 전체</SelectItem>
                    <SelectItem value="EXPIRING">만료임박</SelectItem>
                    <SelectItem value="EXTENDED">연장사용</SelectItem>
                    <SelectItem value="LOST">분실</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              {/* 부서 — 필터 없음 */}
              <TableHead />
              {/* 사용자 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={assignFilter} onValueChange={(v) => setAssignFilter(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    <SelectItem value="ASSIGNED">배정됨</SelectItem>
                    <SelectItem value="UNASSIGNED">미배정</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              {/* 사업장 필터 */}
              <TableHead className="py-1.5 px-2">
                <Select value={businessSite} onValueChange={(v) => setBusinessSite(v ?? EMPTY)}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>전체</SelectItem>
                    {businessSiteCodes.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              {/* 서약서/관리 — 필터 없음 */}
              <TableHead /><TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 13 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-gray-400">
                      등록된 렌탈 PC가 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((pc) => {
                  const isNew = isNewThisMonth(pc.rentalStartDate);
                  const isUpdated = isRecentlyUpdated(pc.updatedAt, pc.createdAt);
                  const expiryStatus = !pc.isReturned && !pc.isLost ? getExpiryStatus(pc.rentalEndDate) : null;

                  return (
                    <TableRow
                      key={pc.id}
                      className={[
                        "cursor-default transition-colors duration-200 ease-out",
                        pc.isLost ? "bg-red-50/30 hover:bg-red-50/50 dark:bg-red-950/10 dark:hover:bg-red-950/20" : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30",
                        pc.isReturned && !pc.isLost ? "opacity-35" : "",
                      ].join(" ")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ x: e.clientX, y: e.clientY, rental: pc });
                      }}
                    >
                      {/* 체크박스 */}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(pc.id)}
                          onCheckedChange={() => toggleSelect(pc.id)}
                        />
                      </TableCell>

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

                      <TableCell className="text-center text-xs text-gray-500">
                        {getIntakeYear(pc.rentalNo) ? `${getIntakeYear(pc.rentalNo)}년` : "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pc.rentalType === "NOTEBOOK" ? "bg-emerald-50/80 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"}`}>
                          {RENTAL_TYPE_LABEL[pc.rentalType]}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pc.rentalSpec === "HIGH" ? "bg-amber-50/80 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" : "bg-gray-100/80 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400"}`}>
                          {RENTAL_SPEC_LABEL[pc.rentalSpec]}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{pc.rentalStartDate}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className={expiryStatus ? "text-red-500 font-semibold" : ""}>{pc.rentalEndDate}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{pc.monthlyFee.toLocaleString()}원</TableCell>

                      {/* 상태 */}
                      <TableCell className="text-center">
                        {pc.isLost ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50/70 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />분실
                          </span>
                        ) : pc.isReturned ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] text-gray-400 bg-gray-50/70 dark:bg-gray-800/30">반납완료</span>
                        ) : expiryStatus === "EXTENDED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50/70 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />연장사용
                          </span>
                        ) : expiryStatus === "EXPIRING" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-50/70 text-orange-500 dark:bg-orange-950/30 dark:text-orange-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />만료임박
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50/70 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />정상
                          </span>
                        )}
                      </TableCell>

                      {/* 부서 */}
                      <TableCell className="text-center text-xs text-gray-600 overflow-visible">
                        {(pc.assignment?.assignmentType === "PERSONAL" || pc.assignment?.assignmentType === "DEPARTMENT") && pc.assignment.department ? (() => {
                          const stored = pc.assignment.department;
                          const lastSlash = stored.lastIndexOf("/");
                          // 우선순위: ① DB에 저장된 departmentName
                          //           ② 부서 트리 path 정확 매칭 → node.name (T/OUT반 등 기존 데이터 대응)
                          //           ③ 경로 파싱 폴백
                          const shortName =
                            pc.assignment.departmentName
                            ?? deptNameMap.get(stored)
                            ?? (lastSlash >= 0 ? stored.slice(lastSlash + 1) : stored);
                          const hasPath = lastSlash >= 0;
                          return hasPath ? (
                            <div className="relative group inline-flex justify-center">
                              <span className="text-gray-700 cursor-default underline decoration-dotted decoration-gray-400 underline-offset-2">
                                {shortName}
                              </span>
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                                              invisible opacity-0 group-hover:visible group-hover:opacity-100
                                              transition-opacity duration-150 delay-200">
                                <div className="bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 shadow-lg
                                                max-w-[320px] break-keep leading-relaxed">
                                  {stored}
                                </div>
                                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-700">{shortName}</span>
                          );
                        })() : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>

                      {/* 사용자 */}
                      <TableCell className="text-center">
                        {pc.assignment ? (
                          <button
                            onClick={() => setAssignTarget(pc)}
                            className="inline-flex flex-col items-center gap-0.5 text-xs hover:opacity-80 transition-opacity w-full cursor-pointer"
                            title="배정 변경"
                          >
                            {pc.assignment.assignmentType === "SITE" ? (
                              <>
                                <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                                  <MapPin className="w-3 h-3" />
                                  {pc.assignment.businessSiteCode}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{pc.assignment.purpose ?? "사업장"}</span>
                              </>
                            ) : pc.assignment.assignmentType === "DEPARTMENT" ? (
                              <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                                <Layers className="w-3 h-3" />
                                부서 공용
                              </span>
                            ) : (
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                {pc.assignment.userName}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => setAssignTarget(pc)}
                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="사용자 배정"
                          >
                            <UserPlus className="w-3 h-3" />
                            배정
                          </button>
                        )}
                      </TableCell>

                      {/* 사업장 */}
                      <TableCell className="text-center text-xs text-gray-600">
                        {pc.assignment?.businessSiteCode ?? <span className="text-gray-300">-</span>}
                      </TableCell>

                      {/* 서약서 */}
                      <TableCell className="text-center">
                        {pc.dsign?.signStatus === "SIGNED" ? (
                          pc.dsign.signViewUrl ? (
                            <a href={pc.dsign.signViewUrl} target="_blank" rel="noreferrer">
                              <DsignStatusBadge
                                sendStatus={pc.dsign.sendStatus}
                                signStatus={pc.dsign.signStatus}
                              />
                            </a>
                          ) : (
                            <DsignStatusBadge
                              sendStatus={pc.dsign.sendStatus}
                              signStatus={pc.dsign.signStatus}
                            />
                          )
                        ) : pc.dsign?.sendStatus === "SENT" ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] text-yellow-600 font-medium">대기</span>
                            <button
                              onClick={async () => {
                                try {
                                  await sendDsignPledge(pc.id);
                                  queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
                                } catch (e: unknown) {
                                  alert(e instanceof Error ? e.message : "발송 실패");
                                }
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-400 text-yellow-600 hover:bg-yellow-50 transition-colors"
                            >
                              재전송
                            </button>
                          </div>
                        ) : pc.assignment?.assignmentType === "PERSONAL" ? (
                          <button
                            onClick={async () => {
                              try {
                                await sendDsignPledge(pc.id);
                                queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
                              } catch (e: unknown) {
                                alert(e instanceof Error ? e.message : "발송 실패");
                              }
                            }}
                            className="text-[11px] px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            발송
                          </button>
                        ) : null}
                      </TableCell>

                      {/* 관리 버튼 */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Popover>
                            <PopoverTrigger
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 cursor-pointer"
                              title="QR 코드"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4">
                              <QrCodeDisplay rentalNo={pc.rentalNo} size={120} />
                            </PopoverContent>
                          </Popover>
                          <button
                            onClick={() => setEditTarget(pc)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 cursor-pointer"
                            title="수정"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!pc.isReturned && (
                            <button
                              onClick={() => setReturnTarget(pc)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 cursor-pointer"
                              title="반납 처리"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => pc.isLost ? handleUndoLost(pc) : handleReportLost(pc)}
                            className={`p-1 rounded hover:bg-red-50 cursor-pointer ${pc.isLost ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
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
        {!expiringOnly && !isSearchMode && !isRentalNoMode && filtered.length > 0 && (
          <div ref={sentinelRef} className="h-4" />
        )}
        {isFetchingNextPage && (
          <div className="py-3 text-center text-sm text-gray-400">불러오는 중...</div>
        )}
      </div>
    </div>
  );
}
