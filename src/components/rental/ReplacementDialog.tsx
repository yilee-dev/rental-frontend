"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rentalApi } from "@/lib/rental-api";
import { useAuthStore } from "@/store/authStore";
import { RentalPc, RentalType, RentalSpec } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL: Record<RentalType, string> = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL: Record<RentalSpec, string> = { NORMAL: "일반", HIGH: "설계" };

interface Props {
  rental: RentalPc | null;
  open: boolean;
  onClose: () => void;
}

export function ReplacementDialog({ rental, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);

  // 새 PC 정보
  const [newRentalNo, setNewRentalNo] = useState("");
  const [newRentalType, setNewRentalType] = useState<RentalType>("NOTEBOOK");
  const [newRentalSpec, setNewRentalSpec] = useState<RentalSpec>("NORMAL");
  const [newStartDate, setNewStartDate] = useState(today);
  const [newEndDate, setNewEndDate] = useState("");
  const [newMonthlyFee, setNewMonthlyFee] = useState("");
  const [reason, setReason] = useState("고장");

  useEffect(() => {
    if (open && rental) {
      setNewRentalNo("");
      setNewRentalType(rental.rentalType);
      setNewRentalSpec(rental.rentalSpec);
      setNewStartDate(today);
      setNewEndDate(rental.rentalEndDate);
      setNewMonthlyFee(String(rental.monthlyFee));
      setReason("고장");
    }
  }, [open, rental, today]);

  function buildName() {
    if (!currentUser) return "시스템";
    return (currentUser.familyName && currentUser.givenName)
      ? `${currentUser.familyName}${currentUser.givenName}`
      : currentUser.name;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rental) return;
    setLoading(true);
    try {
      const result = await rentalApi.replace(rental.id, {
        newPc: {
          rentalNo: newRentalNo,
          rentalType: newRentalType,
          rentalSpec: newRentalSpec,
          rentalStartDate: newStartDate,
          rentalEndDate: newEndDate,
          monthlyFee: Number(newMonthlyFee),
        },
        reason,
        replacedBy: buildName(),
      });
      toast.success(`교체 완료: ${rental.rentalNo} → ${result.newRentalNo}`, {
        description: "배정 정보가 새 PC로 이전되었습니다. QR 코드를 재발급하고, 서약서 발송 현황을 확인해주세요.",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      onClose();
    } catch {
      toast.error("교체 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>PC 교체</DialogTitle>
        </DialogHeader>

        {rental && (
          <div className="rounded-md bg-gray-50 border px-4 py-3 text-sm space-y-1 mb-2">
            <div className="text-xs text-gray-400">기존 PC (반납 처리됨)</div>
            <div className="font-mono font-semibold text-gray-800">{rental.rentalNo}</div>
            <div className="text-gray-500 text-xs">
              {RENTAL_TYPE_LABEL[rental.rentalType]} · {RENTAL_SPEC_LABEL[rental.rentalSpec]} · {rental.monthlyFee.toLocaleString()}원/월
            </div>
            {rental.assignment && (
              <div className="text-xs text-blue-600">
                배정: {rental.assignment.userName ?? rental.assignment.department ?? rental.assignment.businessSiteCode} → 새 PC로 이전됨
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-sm font-medium text-gray-700">새 PC 정보</div>

          <div className="space-y-1">
            <label className="text-sm font-medium">렌탈번호</label>
            <Input
              value={newRentalNo}
              onChange={(e) => setNewRentalNo(e.target.value)}
              placeholder="새 렌탈번호 입력"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">유형</label>
              <Select value={newRentalType} onValueChange={(v) => setNewRentalType(v as RentalType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTEBOOK">노트북</SelectItem>
                  <SelectItem value="DESKTOP">데스크탑</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">사양</label>
              <Select value={newRentalSpec} onValueChange={(v) => setNewRentalSpec(v as RentalSpec)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">일반</SelectItem>
                  <SelectItem value="HIGH">설계</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">렌탈 시작일</label>
              <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">렌탈 만료일</label>
              <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">월 렌탈료</label>
            <Input
              type="number"
              value={newMonthlyFee}
              onChange={(e) => setNewMonthlyFee(e.target.value)}
              placeholder="월 렌탈료"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">교체 사유</label>
            <Select value={reason} onValueChange={(v) => v && setReason(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="고장">고장</SelectItem>
                <SelectItem value="성능 업그레이드">성능 업그레이드</SelectItem>
                <SelectItem value="노후화">노후화</SelectItem>
                <SelectItem value="기타">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">처리자</label>
            <div className="text-sm px-3 py-2 rounded-md border bg-gray-50 text-gray-700">
              {buildName()}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
              {loading ? "처리 중..." : "교체 완료"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
