"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rentalApi } from "@/lib/rental-api";
import { RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };
const EMPTY = "ALL";

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: rentalApi.getReturnRecords,
  });

  const [searchNumber, setSearchNumber] = useState("");
  const [searchReturnedBy, setSearchReturnedBy] = useState("");
  const [filterType, setFilterType] = useState(EMPTY);
  const [filterSpec, setFilterSpec] = useState(EMPTY);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);

  const filtered = records.filter((r) => {
    if (searchNumber && !r.rentalNo.toLowerCase().includes(searchNumber.toLowerCase())) return false;
    if (searchReturnedBy && r.returnedBy && !r.returnedBy.includes(searchReturnedBy)) return false;
    if (filterType !== EMPTY && r.rentalType !== filterType) return false;
    if (filterSpec !== EMPTY && r.rentalSpec !== filterSpec) return false;
    return true;
  });

  async function handleUndo(id: number) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setUndoing(true);
    try {
      await rentalApi.undoReturn(id);
      toast.success("반납이 복구되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      setConfirmId(null);
    } catch {
      toast.error("복구 중 오류가 발생했습니다.");
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">반납 목록</h1>
          {!isLoading && <p className="text-sm text-gray-500">전체 {records.length}건</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center w-36">렌탈번호</TableHead>
              <TableHead className="text-center w-28">유형</TableHead>
              <TableHead className="text-center w-24">사양</TableHead>
              <TableHead className="text-center w-32">게시일</TableHead>
              <TableHead className="text-center w-32">만료일</TableHead>
              <TableHead className="text-center w-28">월 렌탈료</TableHead>
              <TableHead className="text-center w-32">반납 날짜</TableHead>
              <TableHead className="text-center">등록자</TableHead>
              <TableHead className="text-center w-24">관리</TableHead>
            </TableRow>
            <TableRow className="bg-gray-50 border-t">
              <TableHead className="py-1.5 px-2">
                <Input
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder="번호 검색"
                  className="h-7 text-xs w-full"
                />
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
              <TableHead className="py-1.5 px-2">
                <Input
                  value={searchReturnedBy}
                  onChange={(e) => setSearchReturnedBy(e.target.value)}
                  placeholder="등록자 검색"
                  className="h-7 text-xs w-full"
                />
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                      반납 이력이 없습니다.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-center font-mono text-sm">{record.rentalNo}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{RENTAL_TYPE_LABEL[record.rentalType]}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={record.rentalSpec === "HIGH" ? "default" : "secondary"}>
                        {RENTAL_SPEC_LABEL[record.rentalSpec]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{record.rentalStartDate}</TableCell>
                    <TableCell className="text-center text-sm">{record.rentalEndDate}</TableCell>
                    <TableCell className="text-center text-sm">{record.monthlyFee.toLocaleString()}원</TableCell>
                    <TableCell className="text-center text-sm font-medium text-amber-700">{record.returnDate ?? "-"}</TableCell>
                    <TableCell className="text-center text-sm">{record.returnedBy || "-"}</TableCell>
                    <TableCell className="text-center">
                      {confirmId === record.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-xs px-2"
                            disabled={undoing}
                            onClick={() => handleUndo(record.id)}
                          >
                            확인
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setConfirmId(null)}
                          >
                            취소
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-gray-500 hover:text-blue-600"
                          onClick={() => handleUndo(record.id)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          복구
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
