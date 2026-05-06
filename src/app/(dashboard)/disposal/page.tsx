"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, ChevronDown, ChevronRight, Download, HardDrive,
  Pencil, Plus, Search, Trash2, UserCheck, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { disposalDiskApi } from "@/lib/disposal-disk-api";
import { userApi } from "@/lib/user-api";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/authStore";
import { P, useHasPermission } from "@/lib/permissions";
import { DepartmentNode, DisposalDisk, DisposalDiskRequest, DisposalStatus, UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABEL: Record<DisposalStatus, string> = { STORED: "보관중", DISPOSED: "폐기완료" };

const EMPTY_FORM: DisposalDiskRequest = {
  serialNo: "",
  pcModel: null,
  assetNo: null,
  returnedByEmpNo: null,
  returnedByName: null,
  returnedByDept: null,
  returnDate: new Date().toISOString().slice(0, 10),
  registeredBy: "",
  storageLocation: null,
  status: "STORED",
  notes: null,
};

// ─── 부서 트리 노드 ────────────────────────────────────────────────────────────
function DeptNode({
  node, selected, onSelect,
}: { node: DepartmentNode; selected: string | null; onSelect: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <button
        onClick={() => { onSelect(node.path); if (hasChildren) setExpanded((v) => !v); }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 cursor-pointer",
          selected === node.path && "bg-blue-50 text-blue-700 font-medium"
        )}
      >
        {hasChildren
          ? (expanded
              ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />)
          : <span className="w-3.5 shrink-0" />}
        <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
        <span className="break-keep leading-snug">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div className="ml-4 border-l border-gray-200 pl-1">
          {node.children.map((child) => (
            <DeptNode key={child.path} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 사용자 카드 ───────────────────────────────────────────────────────────────
function UserCard({ user, selected, onSelect }: {
  user: UserProfile; selected: boolean; onSelect: (u: UserProfile) => void;
}) {
  return (
    <button
      onClick={() => onSelect(user)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer",
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50"
      )}
    >
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
        {user.familyName ?? user.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {user.empNo && <span className="mr-2">{user.empNo}</span>}
          {(user.departmentName ?? user.department) && (
            <span>{user.departmentName ?? user.department}</span>
          )}
        </p>
      </div>
      {selected && <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />}
    </button>
  );
}

// ─── 반납자 검색 패널 ──────────────────────────────────────────────────────────
function ReturneeSearchPanel({
  selectedUser, onSelect, onClear,
}: {
  selectedUser: UserProfile | null;
  onSelect: (u: UserProfile) => void;
  onClear: () => void;
}) {
  const [tab, setTab] = useState<"search" | "dept">("search");
  const [search, setSearch] = useState("");
  const [deptSelected, setDeptSelected] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: () => userApi.searchUsers(debouncedSearch, undefined, 50),
    enabled: tab === "search" && debouncedSearch.length >= 1,
    placeholderData: [],
    staleTime: 60_000,
  });

  const { data: departments = [], isLoading: isDeptLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: userApi.getDepartments,
    enabled: tab === "dept",
    staleTime: 10 * 60_000,
  });

  const { data: deptUsers = [], isFetching: isDeptUsersLoading } = useQuery({
    queryKey: ["users", "dept", deptSelected],
    queryFn: () => userApi.searchUsers(undefined, deptSelected!, 200),
    enabled: tab === "dept" && !!deptSelected,
    placeholderData: [],
    staleTime: 10 * 60_000,
  });

  const userList = tab === "search" ? searchResults : deptUsers;

  return (
    <div className="flex flex-col h-full border-l">
      {/* 선택된 사용자 요약 */}
      {selectedUser ? (
        <div className="px-3 py-2.5 border-b bg-blue-50 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-600 font-medium mb-1">선택된 반납자</p>
            <button onClick={onClear} className="text-blue-400 hover:text-red-500 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm font-semibold">{selectedUser.name}</p>
          <p className="text-xs text-gray-500">
            {selectedUser.empNo && <span className="mr-1.5">{selectedUser.empNo}</span>}
            {selectedUser.departmentName ?? selectedUser.department}
          </p>
        </div>
      ) : (
        <div className="px-3 py-2 border-b shrink-0">
          <p className="text-xs text-gray-400">반납자를 검색해서 선택하세요</p>
        </div>
      )}

      {/* 탭 */}
      <div className="flex border-b shrink-0">
        {([["search", Search, "이름/사번"], ["dept", Building2, "부서"]] as const).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-xs border-b-2 -mb-px transition-colors cursor-pointer flex-1 justify-center",
              tab === id
                ? "border-blue-600 text-blue-600 font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* 검색 탭 */}
      {tab === "search" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 사번으로 검색..."
                className="pl-7 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {search.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">검색어를 입력하세요</p>
            ) : isSearching ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : userList.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">결과 없음</p>
            ) : userList.map((u) => (
              <UserCard key={u.id} user={u} selected={selectedUser?.id === u.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* 부서 탭 */}
      {tab === "dept" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 border-r overflow-y-auto px-1 py-2 shrink-0">
            {isDeptLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full mb-1" />)
              : departments.map((node) => (
                  <DeptNode key={node.path} node={node} selected={deptSelected} onSelect={setDeptSelected} />
                ))}
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {!deptSelected ? (
              <p className="text-center text-xs text-muted-foreground py-8">부서를 선택하세요</p>
            ) : isDeptUsersLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : deptUsers.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">해당 부서에 사용자 없음</p>
            ) : deptUsers.map((u) => (
              <UserCard key={u.id} user={u} selected={selectedUser?.id === u.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function DisposalPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canWrite = useHasPermission(P.DISPOSAL_WRITE);
  const canDelete = useHasPermission(P.DISPOSAL_DELETE);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisposalStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DisposalDisk | null>(null);
  const [form, setForm] = useState<DisposalDiskRequest>(EMPTY_FORM);
  const [selectedReturnee, setSelectedReturnee] = useState<UserProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: disks = [], isLoading } = useQuery({
    queryKey: ["disposalDisks"],
    queryFn: disposalDiskApi.getAll,
  });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: (data: DisposalDiskRequest) =>
      editTarget ? disposalDiskApi.update(editTarget.id, data) : disposalDiskApi.register(data),
    onSuccess: () => {
      toast.success(editTarget ? "수정되었습니다." : "등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["disposalDisks"] });
      closeDialog();
    },
    onError: (e: Error) => {
      toast.error(e.message.includes("400") ? "이미 등록된 시리얼 번호입니다." : "저장 중 오류가 발생했습니다.");
    },
  });

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => disposalDiskApi.delete(id),
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["disposalDisks"] });
      setConfirmDeleteId(null);
    },
    onError: () => toast.error("삭제 중 오류가 발생했습니다."),
  });

  function defaultRegisteredBy() {
    if (!currentUser) return "";
    return currentUser.familyName && currentUser.givenName
      ? `${currentUser.familyName}${currentUser.givenName}`
      : currentUser.name;
  }

  function openRegister() {
    setEditTarget(null);
    setSelectedReturnee(null);
    setForm({ ...EMPTY_FORM, registeredBy: defaultRegisteredBy() });
    setDialogOpen(true);
  }

  function openEdit(disk: DisposalDisk) {
    setEditTarget(disk);
    setSelectedReturnee(null);
    setForm({
      serialNo: disk.serialNo,
      pcModel: disk.pcModel,
      assetNo: disk.assetNo,
      returnedByEmpNo: disk.returnedByEmpNo,
      returnedByName: disk.returnedByName,
      returnedByDept: disk.returnedByDept,
      returnDate: disk.returnDate,
      registeredBy: disk.registeredBy,
      storageLocation: disk.storageLocation,
      status: disk.status,
      notes: disk.notes,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditTarget(null);
    setSelectedReturnee(null);
    setForm(EMPTY_FORM);
  }

  function handleSelectReturnee(user: UserProfile) {
    setSelectedReturnee(user);
    setForm((prev) => ({
      ...prev,
      returnedByEmpNo: user.empNo ?? null,
      returnedByName: user.name,
      returnedByDept: user.departmentName ?? user.department ?? null,
    }));
  }

  function handleClearReturnee() {
    setSelectedReturnee(null);
    setForm((prev) => ({
      ...prev,
      returnedByEmpNo: null,
      returnedByName: null,
      returnedByDept: null,
    }));
  }

  function set(field: keyof DisposalDiskRequest, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  }

  function handleSubmit() {
    if (!form.serialNo.trim()) { toast.error("시리얼 번호를 입력해주세요."); return; }
    if (!form.returnDate) { toast.error("반납일을 입력해주세요."); return; }
    if (!form.registeredBy.trim()) { toast.error("등록자를 입력해주세요."); return; }
    save(form);
  }

  const filtered = disks.filter((d) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.serialNo.toLowerCase().includes(q) ||
      d.pcModel?.toLowerCase().includes(q) ||
      d.assetNo?.toLowerCase().includes(q) ||
      d.returnedByName?.includes(search) ||
      d.returnedByEmpNo?.includes(search) ||
      d.returnedByDept?.includes(search) ||
      d.registeredBy.includes(search) ||
      d.storageLocation?.toLowerCase().includes(q)
    );
  });

  const storedCount = disks.filter((d) => d.status === "STORED").length;
  const disposedCount = disks.filter((d) => d.status === "DISPOSED").length;

  async function handleExport() {
    setIsExporting(true);
    try { await disposalDiskApi.exportExcel(); }
    catch { toast.error("내보내기에 실패했습니다."); }
    finally { setIsExporting(false); }
  }

  return (
    <div className="space-y-4">
      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="w-[90vw] max-w-[820px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <HardDrive className="w-4 h-4 text-gray-600" />
              {editTarget ? "폐기 디스크 수정" : "폐기 디스크 등록"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* 좌측: 폼 */}
            <div className="flex flex-col w-[360px] shrink-0 overflow-y-auto px-5 py-4 space-y-4 border-r">

              {/* 디스크 정보 */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">디스크 정보</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">시리얼 번호 <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.serialNo}
                      onChange={(e) => setForm((p) => ({ ...p, serialNo: e.target.value }))}
                      placeholder="예: SN-20240115-001"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">PC 기종</Label>
                      <Input value={form.pcModel ?? ""} onChange={(e) => set("pcModel", e.target.value)} placeholder="ThinkPad X1" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">자산 번호</Label>
                      <Input value={form.assetNo ?? ""} onChange={(e) => set("assetNo", e.target.value)} placeholder="자산/렌탈 번호" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 반납자 정보 (읽기전용 — 우측 검색에서 채워짐) */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">반납자 정보</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">사번</Label>
                      <Input value={form.returnedByEmpNo ?? ""} onChange={(e) => set("returnedByEmpNo", e.target.value)} placeholder="사번" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">이름</Label>
                      <Input value={form.returnedByName ?? ""} onChange={(e) => set("returnedByName", e.target.value)} placeholder="이름" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">부서</Label>
                    <Input value={form.returnedByDept ?? ""} onChange={(e) => set("returnedByDept", e.target.value)} placeholder="부서" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">반납일 <span className="text-red-500">*</span></Label>
                    <Input type="date" value={form.returnDate} onChange={(e) => setForm((p) => ({ ...p, returnDate: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
              </div>

              {/* 등록 정보 */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">등록 정보</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">등록자 <span className="text-red-500">*</span></Label>
                      <Input value={form.registeredBy} onChange={(e) => setForm((p) => ({ ...p, registeredBy: e.target.value }))} placeholder="담당자" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">보관 위치</Label>
                      <Input value={form.storageLocation ?? ""} onChange={(e) => set("storageLocation", e.target.value)} placeholder="서버실 A-3" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">상태</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as DisposalStatus }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STORED">보관중</SelectItem>
                        <SelectItem value="DISPOSED">폐기완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">비고</Label>
                    <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="특이사항 등" rows={2} className="resize-none text-sm" />
                  </div>
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={closeDialog} disabled={isSaving}>취소</Button>
                <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? "저장 중..." : editTarget ? "수정" : "등록"}
                </Button>
              </div>
            </div>

            {/* 우측: 반납자 검색 패널 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ReturneeSearchPanel
                selectedUser={selectedReturnee}
                onSelect={handleSelectReturnee}
                onClear={handleClearReturnee}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-600" />
            폐기 디스크 관리
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">
              전체 {disks.length}건
              <span className="mx-1.5 text-gray-300">·</span>
              보관중 <span className="font-medium text-blue-600">{storedCount}</span>건
              <span className="mx-1.5 text-gray-300">·</span>
              폐기완료 <span className="font-medium text-gray-500">{disposedCount}</span>건
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5">
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            {isExporting ? "추출 중..." : "엑셀 다운로드"}
          </Button>
          {canWrite && <Button size="sm" onClick={openRegister} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            디스크 등록
          </Button>}
        </div>
      </div>

      {/* 검색·필터 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="시리얼, 자산번호, 이름, 부서, 보관위치 검색..."
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DisposalStatus | "ALL")}>
          <SelectTrigger className="w-full sm:w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 상태</SelectItem>
            <SelectItem value="STORED">보관중</SelectItem>
            <SelectItem value="DISPOSED">폐기완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="bg-gray-50 text-xs">
              <TableHead className="text-center w-40">시리얼 번호</TableHead>
              <TableHead className="text-center w-28">PC 기종</TableHead>
              <TableHead className="text-center w-28">자산 번호</TableHead>
              <TableHead className="text-center w-24">반납일</TableHead>
              <TableHead className="text-center w-20">사번</TableHead>
              <TableHead className="text-center w-20">반납자</TableHead>
              <TableHead className="text-center w-32">부서</TableHead>
              <TableHead className="text-center w-20">등록자</TableHead>
              <TableHead className="text-center w-24">보관 위치</TableHead>
              <TableHead className="text-center w-20">상태</TableHead>
              <TableHead className="text-center">비고</TableHead>
              <TableHead className="text-center w-20">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <HardDrive className="w-8 h-8 text-gray-300" />
                    <p>{disks.length === 0 ? "등록된 폐기 디스크가 없습니다." : "검색 결과가 없습니다."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((disk) => (
                <TableRow
                  key={disk.id}
                  className={disk.status === "DISPOSED" ? "opacity-60 hover:opacity-80" : "hover:bg-gray-50"}
                >
                  <TableCell className="text-center font-mono text-sm font-medium">{disk.serialNo}</TableCell>
                  <TableCell className="text-center text-sm text-gray-600">{disk.pcModel ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center text-sm font-mono text-gray-600">{disk.assetNo ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center text-sm">{disk.returnDate}</TableCell>
                  <TableCell className="text-center text-xs font-mono text-gray-500">{disk.returnedByEmpNo ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center text-sm">{disk.returnedByName ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center text-xs text-gray-600 w-36 max-w-[144px] truncate" title={disk.returnedByDept ?? ""}>
                    {disk.returnedByDept ? disk.returnedByDept.split("/").at(-1) : <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm text-gray-600">{disk.registeredBy}</TableCell>
                  <TableCell className="text-center text-xs text-gray-600">{disk.storageLocation ?? <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={disk.status === "STORED" ? "default" : "secondary"} className="text-xs">
                      {STATUS_LABEL[disk.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[120px] truncate" title={disk.notes ?? ""}>
                    {disk.notes ?? <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {canWrite && (
                        <button onClick={() => openEdit(disk)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 cursor-pointer" title="수정">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (confirmDeleteId === disk.id ? (
                        <div className="flex items-center gap-0.5 ml-0.5">
                          <button onClick={() => remove(disk.id)} disabled={isDeleting} className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white hover:bg-red-700 cursor-pointer">확인</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 hover:bg-gray-300 cursor-pointer">취소</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(disk.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer" title="삭제">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
