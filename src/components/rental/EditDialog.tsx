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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rentalApi } from "@/lib/rental-api";
import { RentalPc, RentalSpec, RentalType } from "@/types";
import { toast } from "sonner";

interface Props {
  rental: RentalPc | null;
  open: boolean;
  onClose: () => void;
}

export function EditDialog({ rental, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [rentalNo, setRentalNo] = useState("");
  const [rentalType, setRentalType] = useState<RentalType>("NOTEBOOK");
  const [rentalSpec, setRentalSpec] = useState<RentalSpec>("NORMAL");
  const [rentalStartDate, setRentalStartDate] = useState("");
  const [rentalEndDate, setRentalEndDate] = useState("");
  const [monthlyFee, setMonthlyFee] = useState(0);

  useEffect(() => {
    if (rental) {
      setRentalNo(rental.rentalNo);
      setRentalType(rental.rentalType);
      setRentalSpec(rental.rentalSpec);
      setRentalStartDate(rental.rentalStartDate);
      setRentalEndDate(rental.rentalEndDate);
      setMonthlyFee(rental.monthlyFee);
    }
  }, [rental]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rental) return;
    setLoading(true);
    try {
      await rentalApi.update(rental.id, {
        rentalNo,
        rentalType,
        rentalSpec,
        rentalStartDate,
        rentalEndDate,
        monthlyFee,
      });
      toast.success("수정이 완료되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      onClose();
    } catch {
      toast.error("수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartDateChange(val: string) {
    setRentalStartDate(val);
    if (val) {
      const d = new Date(val);
      d.setFullYear(d.getFullYear() + 5);
      d.setDate(d.getDate() - 1);
      setRentalEndDate(d.toISOString().split("T")[0]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>렌탈 PC 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">렌탈번호</label>
              <Input value={rentalNo} onChange={(e) => setRentalNo(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">렌탈유형</label>
              <Select value={rentalType} onValueChange={(v) => setRentalType(v as RentalType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTEBOOK">노트북</SelectItem>
                  <SelectItem value="DESKTOP">데스크탑</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">렌탈사양</label>
              <Select value={rentalSpec} onValueChange={(v) => setRentalSpec(v as RentalSpec)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">일반</SelectItem>
                  <SelectItem value="HIGH">설계</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">게시일</label>
              <Input
                type="date"
                value={rentalStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">만료일</label>
              <Input
                type="date"
                value={rentalEndDate}
                onChange={(e) => setRentalEndDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">월 렌탈료 (원)</label>
              <Input
                type="number"
                value={monthlyFee || ""}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
