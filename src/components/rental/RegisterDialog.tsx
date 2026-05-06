"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { useAuthStore } from "@/store/authStore";
import { RentalPcRequest, RentalSpec, RentalType, UserProfile } from "@/types";
import { Download, Plus, Trash2, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
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
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          <SelectTrigger><SelectValue /></SelectTrigger>
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

// ─── 사용자 일괄 배정 탭 ──────────────────────────────────────────────────────
interface PreviewRow {
  rentalNo: string;
  empNo: string;
  user: UserProfile | null;
  status: "ok" | "not_found";
}

function BulkAssignTab({ onDone }: { onDone: () => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    setResolving(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const parsed = rows
        .filter((row, idx) => {
          if (idx === 0) return !/렌탈|번호|no/i.test(String(row[0] ?? ""));
          return true;
        })
        .filter((row) => row[0] && row[1])
        .map((row) => ({
          rentalNo: String(row[0]).trim(),
          empNo: String(row[1]).trim().padStart(6, "0"),
        }));

      if (parsed.length === 0) {
        toast.error("유효한 데이터가 없습니다. A열: 렌탈번호, B열: 사번 형식을 확인하세요.");
        setResolving(false);
        return;
      }

      const empNos = [...new Set(parsed.map((r) => r.empNo))];
      const userMap = new Map<string, UserProfile>();
      await Promise.all(
        empNos.map(async (empNo) => {
          try {
            const results = await userApi.searchUsers(empNo, undefined, 5);
            const match = results.find((u) => u.empNo === empNo);
            if (match) userMap.set(empNo, match);
          } catch { /* 개별 실패 무시 */ }
        })
      );

      setPreview(parsed.map((row) => {
        const user = userMap.get(row.empNo) ?? null;
        return { ...row, user, status: user ? "ok" : "not_found" };
      }));
    } catch {
      toast.error("파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setResolving(false);
    }
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => {
      const assignedBy = currentUser
        ? (currentUser.familyName && currentUser.givenName
            ? `${currentUser.familyName}${currentUser.givenName}`
            : currentUser.name)
        : "시스템";
      const items = (preview ?? [])
        .filter((r) => r.status === "ok" && r.user)
        .map((r) => ({
          rentalNo: r.rentalNo,
          assignmentType: "PERSONAL" as const,
          empNo: r.user!.empNo ?? r.user!.username,
          userName: r.user!.name,
          department: r.user!.departmentName ?? r.user!.department ?? null,
          companyCode: r.user!.companyCode ?? null,
          businessSiteCode: r.user!.businessSiteCode ?? null,
        }));
      return rentalApi.batchAssign({ items, assignedBy });
    },
    onSuccess: (result) => {
      toast.success(`${result.length}건 배정이 완료되었습니다.`);
      queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      setPreview(null);
      setFileName("");
      onDone();
    },
    onError: () => toast.error("일괄 배정 중 오류가 발생했습니다."),
  });

  const okCount = preview?.filter((r) => r.status === "ok").length ?? 0;
  const failCount = preview?.filter((r) => r.status !== "ok").length ?? 0;

  return (
    <div className="space-y-4 pt-2">
      {/* 양식 다운로드 */}
      <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 bg-gray-50">
        <div className="flex-1 text-sm text-muted-foreground">
          A열: 렌탈번호 &nbsp;·&nbsp; B열: 사번 형식의 엑셀을 업로드하세요.
        </div>
        <Button variant="outline" size="sm" onClick={rentalApi.downloadAssignTemplate} className="shrink-0 gap-1.5">
          <Download className="w-3.5 h-3.5" />
          양식 다운로드
        </Button>
      </div>

      {/* 파일 선택 */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {/* 로딩 */}
      {resolving && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      )}

      {/* 미리보기 */}
      {preview && !resolving && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 font-medium">{okCount}건 배정 가능</span>
            {failCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-600 font-medium">{failCount}건 미발견</span>
              </>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-xs">
                  <TableHead className="w-36">렌탈번호</TableHead>
                  <TableHead className="w-24">사번</TableHead>
                  <TableHead className="w-24">이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead className="text-center w-16">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, idx) => (
                  <TableRow key={idx} className={row.status !== "ok" ? "bg-red-50/50" : ""}>
                    <TableCell className="font-mono text-xs">{row.rentalNo}</TableCell>
                    <TableCell className="text-xs">{row.empNo}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {row.user?.name ?? <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {row.user?.departmentName ?? row.user?.department ?? <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.status === "ok"
                        ? <Badge className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">매핑됨</Badge>
                        : <Badge variant="destructive" className="text-[10px] px-1.5">미발견</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {failCount > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              미발견 항목은 배정에서 제외됩니다.
            </div>
          )}

          <Button className="w-full" onClick={() => submit()} disabled={okCount === 0 || isPending}>
            {isPending
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />처리 중...</>
              : `${okCount}건 일괄 배정`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── 메인 다이얼로그 ──────────────────────────────────────────────────────────
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>렌탈 PC 등록</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="single">단일 등록</TabsTrigger>
            <TabsTrigger value="batch">다중 등록</TabsTrigger>
            <TabsTrigger value="excel">엑셀 업로드</TabsTrigger>
            <TabsTrigger value="assign">사용자 배정</TabsTrigger>
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
                      <Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
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
                <Plus className="mr-2 h-4 w-4" />행 추가
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
              <Button variant="outline" size="sm" onClick={rentalApi.downloadTemplate} className="mb-4">
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

          {/* 사용자 일괄 배정 */}
          <TabsContent value="assign">
            <BulkAssignTab onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
