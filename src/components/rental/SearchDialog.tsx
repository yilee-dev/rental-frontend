"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw } from "lucide-react";
import { RentalPcSearchParams } from "@/types";

const EMPTY = "";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-100 text-red-600 border border-red-200">
      {children}
    </kbd>
  );
}

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSearch: (params: RentalPcSearchParams) => void;
}

export function SearchDialog({ open, onClose, onSearch }: SearchDialogProps) {
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLButtonElement>(null);
  const ref6 = useRef<HTMLButtonElement>(null);
  const ref7 = useRef<HTMLInputElement>(null);
  const ref8 = useRef<HTMLButtonElement>(null);

  const [rentalNo, setRentalNo] = useState("");
  const [userName, setUserName] = useState("");
  const [empNo, setEmpNo] = useState("");
  const [department, setDepartment] = useState("");
  const [rentalType, setRentalType] = useState(EMPTY);
  const [rentalSpec, setRentalSpec] = useState(EMPTY);
  const [businessSiteCode, setBusinessSiteCode] = useState("");
  const [status, setStatus] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const refs: Record<string, React.RefObject<HTMLElement | null>> = {
        "1": ref1, "2": ref2, "3": ref3, "4": ref4,
        "5": ref5, "6": ref6, "7": ref7, "8": ref8,
      };
      if (refs[e.key]) {
        e.preventDefault();
        refs[e.key].current?.focus();
        return;
      }
      if (e.key === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function reset() {
    setRentalNo("");
    setUserName("");
    setEmpNo("");
    setDepartment("");
    setRentalType(EMPTY);
    setRentalSpec(EMPTY);
    setBusinessSiteCode("");
    setStatus(EMPTY);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params: RentalPcSearchParams = {};
    if (rentalNo) params.rentalNo = rentalNo;
    if (userName) params.userName = userName;
    if (empNo) params.empNo = empNo;
    if (department) params.department = department;
    if (rentalType) params.rentalType = rentalType as RentalPcSearchParams["rentalType"];
    if (rentalSpec) params.rentalSpec = rentalSpec as RentalPcSearchParams["rentalSpec"];
    if (businessSiteCode) params.businessSiteCode = businessSiteCode;
    if (status) params.status = status;
    onSearch(params);
    onClose();
  }

  const hasValue = rentalNo || userName || empNo || department || rentalType || rentalSpec || businessSiteCode || status;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            상세 검색
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">렌탈번호 <Kbd>Ctrl+1</Kbd></label>
              <Input
                ref={ref1}
                autoFocus
                value={rentalNo}
                onChange={(e) => setRentalNo(e.target.value)}
                placeholder="렌탈번호 검색"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">사용자명 <Kbd>Ctrl+2</Kbd></label>
              <Input
                ref={ref2}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="사용자명 검색"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">사번 <Kbd>Ctrl+3</Kbd></label>
              <Input
                ref={ref3}
                value={empNo}
                onChange={(e) => setEmpNo(e.target.value)}
                placeholder="사번 검색"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">부서 <Kbd>Ctrl+4</Kbd></label>
              <Input
                ref={ref4}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="부서명 검색"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">유형 <Kbd>Ctrl+5</Kbd></label>
              <Select value={rentalType} onValueChange={(v) => setRentalType(v ?? EMPTY)}>
                <SelectTrigger ref={ref5}><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NOTEBOOK">노트북</SelectItem>
                  <SelectItem value="DESKTOP">데스크탑</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">사양 <Kbd>Ctrl+6</Kbd></label>
              <Select value={rentalSpec} onValueChange={(v) => setRentalSpec(v ?? EMPTY)}>
                <SelectTrigger ref={ref6}><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NORMAL">일반</SelectItem>
                  <SelectItem value="HIGH">설계</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">사업장 코드 <Kbd>Ctrl+7</Kbd></label>
              <Input
                ref={ref7}
                value={businessSiteCode}
                onChange={(e) => setBusinessSiteCode(e.target.value)}
                placeholder="사업장 코드"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center">상태 <Kbd>Ctrl+8</Kbd></label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? EMPTY)}>
                <SelectTrigger ref={ref8}><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>전체</SelectItem>
                  <SelectItem value="NORMAL">정상</SelectItem>
                  <SelectItem value="EXPIRING">만료임박</SelectItem>
                  <SelectItem value="EXTENDED">연장사용</SelectItem>
                  <SelectItem value="LOST">분실</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="mr-auto gap-1 text-gray-500">
              <RotateCcw className="w-3.5 h-3.5" /> 초기화
              <Kbd>Ctrl+C</Kbd>
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" className="gap-2">
              <Search className="w-4 h-4" />
              검색
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
