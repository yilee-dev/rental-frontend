"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rentalApi } from "@/lib/rental-api";
import { RentalPcRequest, RentalSpec, RentalType } from "@/types";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY_ROW = (): RentalPcRequest => ({
  rentalNo: "",
  rentalType: "NOTEBOOK",
  rentalSpec: "NORMAL",
  rentalStartDate: "",
  rentalEndDate: "",
  monthlyFee: 0,
});

function RentalPcForm({
  value,
  onChange,
}: {
  value: RentalPcRequest;
  onChange: (v: RentalPcRequest) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-sm font-medium">렌탈번호</label>
        <Input
          value={value.rentalNo}
          onChange={(e) => onChange({ ...value, rentalNo: e.target.value })}
          placeholder="렌탈번호 입력"
        />
      </div>
      <div>
        <label className="text-sm font-medium">타입</label>
        <Select
          value={value.rentalType}
          onValueChange={(v) => onChange({ ...value, rentalType: v as RentalType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NOTEBOOK">노트북</SelectItem>
            <SelectItem value="DESKTOP">데스크탑</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">사양</label>
        <Select
          value={value.rentalSpec}
          onValueChange={(v) => onChange({ ...value, rentalSpec: v as RentalSpec })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NORMAL">일반</SelectItem>
            <SelectItem value="HIGH">설계</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">렌탈 게시일</label>
        <Input
          type="date"
          value={value.rentalStartDate}
          onChange={(e) => onChange({ ...value, rentalStartDate: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">렌탈 만료일</label>
        <Input
          type="date"
          value={value.rentalEndDate}
          onChange={(e) => onChange({ ...value, rentalEndDate: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <label className="text-sm font-medium">월 렌탈료 (원)</label>
        <Input
          type="number"
          value={value.monthlyFee || ""}
          onChange={(e) => onChange({ ...value, monthlyFee: Number(e.target.value) })}
          placeholder="0"
        />
      </div>
    </div>
  );
}

export default function RegisterDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [single, setSingle] = useState<RentalPcRequest>(EMPTY_ROW());
  const [rows, setRows] = useState<RentalPcRequest[]>([EMPTY_ROW()]);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });

  const handleSingle = async () => {
    setLoading(true);
    try {
      await rentalApi.register(single);
      toast.success("등록이 완료되었습니다.");
      invalidate();
      setSingle(EMPTY_ROW());
      setOpen(false);
    } catch {
      toast.error("등록에 실패했습니다. 서버 연결을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    setLoading(true);
    try {
      await rentalApi.registerBatch(rows);
      toast.success(`${rows.length}건 등록이 완료되었습니다.`);
      invalidate();
      setRows([EMPTY_ROW()]);
      setOpen(false);
    } catch {
      toast.error("등록에 실패했습니다. 서버 연결을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await rentalApi.uploadExcel(file);
      toast.success("엑셀 업로드가 완료되었습니다.");
      invalidate();
      setOpen(false);
    } catch {
      toast.error("업로드에 실패했습니다. 서버 연결을 확인해주세요.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        등록하기
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>렌탈 PC 등록</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">단일 등록</TabsTrigger>
            <TabsTrigger value="batch">다중 등록</TabsTrigger>
            <TabsTrigger value="excel">엑셀 업로드</TabsTrigger>
          </TabsList>

          {/* 단일 등록 */}
          <TabsContent value="single" className="space-y-4 pt-2">
            <RentalPcForm value={single} onChange={setSingle} />
            <Button className="w-full" onClick={handleSingle} disabled={loading}>
              {loading ? "등록 중..." : "등록"}
            </Button>
          </TabsContent>

          {/* 다중 등록 */}
          <TabsContent value="batch" className="space-y-4 pt-2">
            <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
              {rows.map((row, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                    {rows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <RentalPcForm
                    value={row}
                    onChange={(v) => setRows(rows.map((r, idx) => (idx === i ? v : r)))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRows([...rows, EMPTY_ROW()])}>
                <Plus className="mr-2 h-4 w-4" />
                행 추가
              </Button>
              <Button className="flex-1" onClick={handleBatch} disabled={loading}>
                {loading ? "등록 중..." : `${rows.length}건 등록`}
              </Button>
            </div>
          </TabsContent>

          {/* 엑셀 업로드 */}
          <TabsContent value="excel" className="space-y-4 pt-2">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                엑셀 양식을 다운로드하여 데이터를 입력한 후 업로드해 주세요.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={rentalApi.downloadTemplate}
                className="mb-4"
              >
                <Download className="mr-2 h-4 w-4" />
                등록 양식 다운로드
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
            </div>
            <Button className="w-full" onClick={handleUpload} disabled={loading}>
              {loading ? "업로드 중..." : "업로드 및 등록"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
