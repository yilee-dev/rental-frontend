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
import { rentalApi } from "@/lib/rental-api";
import { RentalPc } from "@/types";
import { toast } from "sonner";

const RENTAL_TYPE_LABEL = { NOTEBOOK: "노트북", DESKTOP: "데스크탑" };
const RENTAL_SPEC_LABEL = { NORMAL: "일반", HIGH: "설계" };

interface Props {
  rental: RentalPc | null;
  open: boolean;
  onClose: () => void;
}

export function ReturnDialog({ rental, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);
  const [returnDate, setReturnDate] = useState(today);
  const [returnedBy, setReturnedBy] = useState("");

  useEffect(() => {
    if (open) {
      setReturnDate(today);
      setReturnedBy("");
    }
  }, [open, today]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rental) return;
    setLoading(true);
    try {
      await rentalApi.returnRentalPc(rental.id, { returnDate, returnedBy });
      toast.success("반납 처리가 완료되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      onClose();
    } catch {
      toast.error("반납 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>반납 처리</DialogTitle>
        </DialogHeader>
        {rental && (
          <div className="rounded-md bg-gray-50 border px-4 py-3 text-sm space-y-1 mb-2">
            <div className="font-mono font-semibold text-gray-800">{rental.rentalNo}</div>
            <div className="text-gray-500 text-xs">
              {RENTAL_TYPE_LABEL[rental.rentalType]} · {RENTAL_SPEC_LABEL[rental.rentalSpec]} · {rental.monthlyFee.toLocaleString()}원/월
            </div>
            <div className="text-gray-500 text-xs">{rental.rentalStartDate} ~ {rental.rentalEndDate}</div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">반납 날짜</label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">등록자</label>
            <Input
              placeholder="반납 등록자 이름 입력"
              value={returnedBy}
              onChange={(e) => setReturnedBy(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
              {loading ? "처리 중..." : "반납 완료"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
