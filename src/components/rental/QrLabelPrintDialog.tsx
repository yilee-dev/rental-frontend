"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer } from "lucide-react";
import { rentalApi } from "@/lib/rental-api";
import { toast } from "sonner";
import { LabelFormat } from "@/types";
import QrCodeDisplay from "./QrCodeDisplay";

interface QrLabelPrintDialogProps {
  open: boolean;
  onClose: () => void;
  selectedIds: number[];
  selectedRentalNos: string[];
}

export default function QrLabelPrintDialog({ open, onClose, selectedIds, selectedRentalNos }: QrLabelPrintDialogProps) {
  const [format, setFormat] = useState<LabelFormat>("THERMAL_50x30");
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (selectedIds.length === 0) {
      toast.error("선택된 PC가 없습니다.");
      return;
    }
    setIsDownloading(true);
    try {
      await rentalApi.downloadQrLabelPdf(selectedIds, format);
      toast.success("PDF가 다운로드되었습니다. PDF 뷰어에서 열어 인쇄해주세요.");
      onClose();
    } catch {
      toast.error("QR 라벨 PDF 생성에 실패했습니다.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            QR 라벨 인쇄
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-gray-600">
            선택된 PC: <span className="font-semibold">{selectedIds.length}대</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">라벨 형식</label>
            <Select value={format} onValueChange={(v) => setFormat(v as LabelFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THERMAL_50x30">열 프린터 라벨 (80x40mm)</SelectItem>
                <SelectItem value="A4_GRID">A4 용지 (32라벨/페이지)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedRentalNos.length > 0 && selectedRentalNos.length <= 3 && (
            <div className="flex justify-center gap-4 pt-2">
              {selectedRentalNos.map((no) => (
                <QrCodeDisplay key={no} rentalNo={no} size={80} />
              ))}
            </div>
          )}

          {selectedRentalNos.length > 3 && (
            <div className="text-xs text-gray-400 text-center pt-2">
              {selectedRentalNos.slice(0, 3).join(", ")} 외 {selectedRentalNos.length - 3}건
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
            <Download className="w-4 h-4" />
            {isDownloading ? "생성 중..." : "PDF 다운로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
