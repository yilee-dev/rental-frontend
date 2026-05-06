"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rentalApi } from "@/lib/rental-api";
import { RentalPc, RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };
const EMPTY = "ALL";

export default function ReturnsPage() {
  return (
    <Suspense>
      <ReturnsPageInner />
    </Suspense>
  );
}

function ReturnsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const initialTab = searchParams.get("tab") === "lost" ? "lost" : "returns";
  const [tab, setTab] = useState<"returns" | "lost">(initialTab);

  function switchTab(t: "returns" | "lost") {
    setTab(t);
    router.replace(`/returns${t === "lost" ? "?tab=lost" : ""}`);
  }

  // 반납 탭
  const { data: returnRecords = [], isLoading: isLoadingReturns } = useQuery({
    queryKey: ["returns"],
    queryFn: rentalApi.getReturnRecords,
  });

  // 분실 탭
  const { data: lostRecords = [], isLoading: isLoadingLost } = useQuery({
    queryKey: ["lostRecords"],
    queryFn: rentalApi.getLostRecords,
  });

  const [searchNumber, setSearchNumber] = useState("");
  const [searchReturnedBy, setSearchReturnedBy] = useState("");
  const [filterType, setFilterType] = useState(EMPTY);
  const [filterSpec, setFilterSpec] = useState(EMPTY);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);

  const filteredReturns = returnRecords.filter((r) => {
    if (searchNumber && !r.rentalNo.toLowerCase().includes(searchNumber.toLowerCase())) return false;
    if (searchReturnedBy && !(
      (r.returnedBy && r.returnedBy.includes(searchReturnedBy)) ||
      (r.returnedByEmpNo && r.returnedByEmpNo.includes(searchReturnedBy))
    )) return false;
    if (filterType !== EMPTY && r.rentalType !== filterType) return false;
    if (filterSpec !== EMPTY && r.rentalSpec !== filterSpec) return false;
    return true;
  });

  const filteredLost = lostRecords.filter((r) => {
    if (searchNumber && !r.rentalNo.toLowerCase().includes(searchNumber.toLowerCase())) return false;
    if (filterType !== EMPTY && r.rentalType !== filterType) return false;
    if (filterSpec !== EMPTY && r.rentalSpec !== filterSpec) return false;
    return true;
  });

  async function handleUndoReturn(id: number) {
    if (confirmId !== id) { setConfirmId(id); return; }
    setUndoing(true);
    try {
      await rentalApi.undoReturn(id);
      toast.success("반납이 복구되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmId(null);
    } catch {
      toast.error("복구 중 오류가 발생했습니다.");
    } finally {
      setUndoing(false);
    }
  }

  async function handleUndoLost(pc: RentalPc) {
    if (confirmId !== pc.id) { setConfirmId(pc.id); return; }
    setUndoing(true);
    try {
      await rentalApi.undoLost(pc.id);
      toast.success("분실 신고가 취소되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["lostRecords"] });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmId(null);
    } catch {
      toast.error("분실 신고 취소 중 오류가 발생했습니다.");
    } finally {
      setUndoing(false);
    }
  }

  const isLoading = tab === "returns" ? isLoadingReturns : isLoadingLost;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">반납 / 분실 목록</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">
              {tab === "returns"
                ? `반납 ${returnRecords.length}건`
                : `분실 ${lostRecords.length}건`}
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === "returns"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => switchTab("returns")}
        >
          반납 목록
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "lost"
              ? "border-red-500 text-red-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => switchTab("lost")}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          분실 목록
          {lostRecords.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
              {lostRecords.length}
            </span>
          )}
        </button>
      </div>

      {tab === "returns" ? (
        <ReturnTable
          records={filteredReturns}
          isLoading={isLoadingReturns}
          searchNumber={searchNumber}
          setSearchNumber={setSearchNumber}
          searchReturnedBy={searchReturnedBy}
          setSearchReturnedBy={setSearchReturnedBy}
          filterType={filterType}
          setFilterType={setFilterType}
          filterSpec={filterSpec}
          setFilterSpec={setFilterSpec}
          confirmId={confirmId}
          undoing={undoing}
          onUndo={handleUndoReturn}
          onCancelConfirm={() => setConfirmId(null)}
        />
      ) : (
        <LostTable
          records={filteredLost}
          isLoading={isLoadingLost}
          searchNumber={searchNumber}
          setSearchNumber={setSearchNumber}
          filterType={filterType}
          setFilterType={setFilterType}
          filterSpec={filterSpec}
          setFilterSpec={setFilterSpec}
          confirmId={confirmId}
          undoing={undoing}
          onUndoLost={handleUndoLost}
          onCancelConfirm={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

interface ReturnTableProps {
  records: RentalPc[];
  isLoading: boolean;
  searchNumber: string; setSearchNumber: (v: string) => void;
  searchReturnedBy: string; setSearchReturnedBy: (v: string) => void;
  filterType: string; setFilterType: (v: string) => void;
  filterSpec: string; setFilterSpec: (v: string) => void;
  confirmId: number | null; undoing: boolean;
  onUndo: (id: number) => void;
  onCancelConfirm: () => void;
}

function ReturnTable({
  records, isLoading, searchNumber, setSearchNumber, searchReturnedBy, setSearchReturnedBy,
  filterType, setFilterType, filterSpec, setFilterSpec, confirmId, undoing, onUndo, onCancelConfirm,
}: ReturnTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-center w-32">렌탈번호</TableHead>
            <TableHead className="text-center w-24">유형</TableHead>
            <TableHead className="text-center w-20">사양</TableHead>
            <TableHead className="text-center w-28">게시일</TableHead>
            <TableHead className="text-center w-28">만료일</TableHead>
            <TableHead className="text-center w-24">월 렌탈료</TableHead>
            <TableHead className="text-center w-28">반납 날짜</TableHead>
            <TableHead className="text-center w-24">사번</TableHead>
            <TableHead className="text-center w-24">반납자</TableHead>
            <TableHead className="text-center w-20">관리</TableHead>
          </TableRow>
          <TableRow className="bg-gray-50 border-t">
            <TableHead className="py-1.5 px-2">
              <Input value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} placeholder="번호 검색" className="h-7 text-xs w-full" />
            </TableHead>
            <TableHead className="py-1.5 px-2">
              <Select value={filterType} onValueChange={(v) => setFilterType(v ?? EMPTY)}>
                <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NOTEBOOK">노트북</SelectItem>
                  <SelectItem value="DESKTOP">데스크탑</SelectItem>
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead className="py-1.5 px-2">
              <Select value={filterSpec} onValueChange={(v) => setFilterSpec(v ?? EMPTY)}>
                <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NORMAL">일반</SelectItem>
                  <SelectItem value="HIGH">설계</SelectItem>
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead colSpan={4} />
            <TableHead colSpan={2} className="py-1.5 px-2">
              <Input value={searchReturnedBy} onChange={(e) => setSearchReturnedBy(e.target.value)} placeholder="사번·이름 검색" className="h-7 text-xs w-full" />
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            : records.length === 0
            ? <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-400 text-sm">반납 이력이 없습니다.</TableCell></TableRow>
            : records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-center font-mono text-sm">{record.rentalNo}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{RENTAL_TYPE_LABEL[record.rentalType]}</Badge></TableCell>
                  <TableCell className="text-center"><Badge variant={record.rentalSpec === "HIGH" ? "default" : "secondary"}>{RENTAL_SPEC_LABEL[record.rentalSpec]}</Badge></TableCell>
                  <TableCell className="text-center text-sm">{record.rentalStartDate}</TableCell>
                  <TableCell className="text-center text-sm">{record.rentalEndDate}</TableCell>
                  <TableCell className="text-center text-sm">{record.monthlyFee.toLocaleString()}원</TableCell>
                  <TableCell className="text-center text-sm font-medium text-amber-700">{record.returnDate ?? "-"}</TableCell>
                  <TableCell className="text-center text-sm font-mono">{record.returnedByEmpNo || "-"}</TableCell>
                  <TableCell className="text-center text-sm">{record.returnedBy || "-"}</TableCell>
                  <TableCell className="text-center">
                    {confirmId === record.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <Button size="sm" variant="destructive" className="h-6 text-xs px-2" disabled={undoing} onClick={() => onUndo(record.id)}>확인</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancelConfirm}>취소</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-gray-500 hover:text-blue-600" onClick={() => onUndo(record.id)}>
                        <RotateCcw className="w-3 h-3" /> 복구
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface LostTableProps {
  records: RentalPc[];
  isLoading: boolean;
  searchNumber: string; setSearchNumber: (v: string) => void;
  filterType: string; setFilterType: (v: string) => void;
  filterSpec: string; setFilterSpec: (v: string) => void;
  confirmId: number | null; undoing: boolean;
  onUndoLost: (pc: RentalPc) => void;
  onCancelConfirm: () => void;
}

function LostTable({
  records, isLoading, searchNumber, setSearchNumber, filterType, setFilterType,
  filterSpec, setFilterSpec, confirmId, undoing, onUndoLost, onCancelConfirm,
}: LostTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
      <Table className="min-w-[820px]">
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-center w-32">렌탈번호</TableHead>
            <TableHead className="text-center w-24">유형</TableHead>
            <TableHead className="text-center w-20">사양</TableHead>
            <TableHead className="text-center w-28">게시일</TableHead>
            <TableHead className="text-center w-28">만료일</TableHead>
            <TableHead className="text-center w-24">월 렌탈료</TableHead>
            <TableHead className="text-center w-36">배정 사용자</TableHead>
            <TableHead className="text-center w-24">사업장</TableHead>
            <TableHead className="text-center w-20">관리</TableHead>
          </TableRow>
          <TableRow className="bg-gray-50 border-t">
            <TableHead className="py-1.5 px-2">
              <Input value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} placeholder="번호 검색" className="h-7 text-xs w-full" />
            </TableHead>
            <TableHead className="py-1.5 px-2">
              <Select value={filterType} onValueChange={(v) => setFilterType(v ?? EMPTY)}>
                <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NOTEBOOK">노트북</SelectItem>
                  <SelectItem value="DESKTOP">데스크탑</SelectItem>
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead className="py-1.5 px-2">
              <Select value={filterSpec} onValueChange={(v) => setFilterSpec(v ?? EMPTY)}>
                <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NORMAL">일반</SelectItem>
                  <SelectItem value="HIGH">설계</SelectItem>
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead colSpan={6} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            : records.length === 0
            ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400 text-sm">분실 신고 항목이 없습니다.</TableCell></TableRow>
            : records.map((pc) => (
                <TableRow key={pc.id} className="bg-red-50 hover:bg-red-100">
                  <TableCell className="text-center font-mono text-sm">
                    <span className="mr-1">🚨</span>{pc.rentalNo}
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{RENTAL_TYPE_LABEL[pc.rentalType]}</Badge></TableCell>
                  <TableCell className="text-center"><Badge variant={pc.rentalSpec === "HIGH" ? "default" : "secondary"}>{RENTAL_SPEC_LABEL[pc.rentalSpec]}</Badge></TableCell>
                  <TableCell className="text-center text-sm">{pc.rentalStartDate}</TableCell>
                  <TableCell className="text-center text-sm">{pc.rentalEndDate}</TableCell>
                  <TableCell className="text-center text-sm">{pc.monthlyFee.toLocaleString()}원</TableCell>
                  <TableCell className="text-center text-sm">
                    {pc.assignment
                      ? (pc.assignment.assignmentType === "SITE"
                          ? <span className="text-green-700">{pc.assignment.businessSiteCode} ({pc.assignment.purpose ?? "사업장"})</span>
                          : pc.assignment.assignmentType === "DEPARTMENT"
                          ? <span className="text-blue-700">{pc.assignment.department?.split("/").at(-1) ?? "-"} (부서)</span>
                          : pc.assignment.userName)
                      : <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell className="text-center text-xs text-gray-600">{pc.assignment?.businessSiteCode ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center">
                    {confirmId === pc.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <Button size="sm" variant="destructive" className="h-6 text-xs px-2" disabled={undoing} onClick={() => onUndoLost(pc)}>확인</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancelConfirm}>취소</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-gray-500 hover:text-red-600" onClick={() => onUndoLost(pc)}>
                        <AlertTriangle className="w-3 h-3" /> 취소
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
