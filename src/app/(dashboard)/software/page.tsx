"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, FileArchive, Package, Search, Shield, Trash2, Upload, X,
  Briefcase, Code, MoreHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { softwareApi } from "@/lib/software-api";
import { useAuthStore } from "@/store/authStore";
import { P, useHasPermission } from "@/lib/permissions";
import { Software } from "@/types";
import { toast } from "sonner";

const ALL = "ALL";
const CATEGORIES = ["보안", "업무", "개발", "기타"];

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  보안: { icon: Shield, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  업무: { icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  개발: { icon: Code, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  기타: { icon: Package, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
};

function getCategoryMeta(category: string | null) {
  return CATEGORY_META[category ?? "기타"] ?? CATEGORY_META["기타"];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return dateStr.slice(0, 10);
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

function ExtBadge({ fileName }: { fileName: string }) {
  const ext = getFileExtension(fileName);
  const extColors: Record<string, string> = {
    exe: "bg-amber-100 text-amber-700",
    msi: "bg-amber-100 text-amber-700",
    zip: "bg-violet-100 text-violet-700",
    "7z": "bg-violet-100 text-violet-700",
    dmg: "bg-gray-100 text-gray-700",
    pdf: "bg-red-100 text-red-700",
    iso: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${extColors[ext] ?? "bg-gray-100 text-gray-600"}`}>
      .{ext}
    </span>
  );
}

// ─── 업로드/수정 다이얼로그 ───────────────────────────────────────────────
function SoftwareFormDialog({
  open, onClose, editTarget,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: Software | null;
}) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editTarget;

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(editTarget?.name ?? "");
  const [version, setVersion] = useState(editTarget?.version ?? "");
  const [description, setDescription] = useState(editTarget?.description ?? "");
  const [category, setCategory] = useState(editTarget?.category ?? "");
  const [dragging, setDragging] = useState(false);

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (formData: FormData) => softwareApi.upload(formData),
    onSuccess: () => {
      toast.success(isEdit ? "수정되었습니다." : "소프트웨어가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["software"] });
      reset();
      onClose();
    },
    onError: () => toast.error("처리 중 오류가 발생했습니다."),
  });

  function handleFile(f: File) {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleSubmit() {
    if (!isEdit && !file) return;
    if (!name.trim()) return;
    const formData = new FormData();
    if (file) formData.append("file", file);
    formData.append("name", name.trim());
    if (version.trim()) formData.append("version", version.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (category) formData.append("category", category);
    const uploadedBy = currentUser
      ? (currentUser.familyName && currentUser.givenName
          ? `${currentUser.familyName}${currentUser.givenName}`
          : currentUser.name)
      : "";
    if (uploadedBy) formData.append("uploadedBy", uploadedBy);
    upload(formData);
  }

  function reset() {
    setFile(null);
    setName("");
    setVersion("");
    setDescription("");
    setCategory("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4 text-blue-600" />
            {isEdit ? "소프트웨어 수정" : "소프트웨어 등록"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 파일 드롭존 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
              dragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <>
                <FileArchive className="w-8 h-8 text-blue-500" />
                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : isEdit ? (
              <>
                <FileArchive className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-500">새 파일로 교체하려면 클릭</p>
                <p className="text-xs text-gray-400">현재: {editTarget?.originalFileName}</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-500">파일을 드래그하거나 클릭해 선택</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>소프트웨어명 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 알약, Visual Studio Code" />
            </div>

            <div className="space-y-1.5">
              <Label>버전</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="예) 1.0.0" />
            </div>

            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => {
                    const meta = CATEGORY_META[c];
                    const Icon = meta.icon;
                    return (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                          {c}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>설명</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="설치 목적, 용도 등을 입력하세요"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isPending}>취소</Button>
            <Button onClick={handleSubmit} disabled={(!isEdit && !file) || !name.trim() || isPending}>
              {isPending ? "처리 중..." : isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 소프트웨어 카드 ────────────────────────────────────────────────────
function SoftwareCard({
  sw, canWrite, canDelete, onDownload, onDelete, downloading,
}: {
  sw: Software;
  canWrite: boolean;
  canDelete: boolean;
  onDownload: (sw: Software) => void;
  onDelete: (id: number) => void;
  downloading: boolean;
}) {
  const meta = getCategoryMeta(sw.category);
  const Icon = meta.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`group relative rounded-lg border ${meta.border} bg-white dark:bg-gray-900 p-5 transition-all hover:shadow-md hover:border-gray-300`}>
      {/* 카테고리 아이콘 + 이름 */}
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{sw.name}</h3>
            {sw.version && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">v{sw.version}</Badge>
            )}
          </div>
          {sw.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sw.description}</p>
          )}
        </div>

        {/* 액션 메뉴 */}
        {(canWrite || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger className="h-7 w-7 p-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-gray-100 cursor-pointer">
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {canDelete && (
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  삭제
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 파일 정보 + 다운로드 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ExtBadge fileName={sw.originalFileName} />
          <span className="text-xs text-gray-400 truncate" title={sw.originalFileName}>
            {sw.originalFileName}
          </span>
          <span className="text-xs text-gray-300 shrink-0">{formatFileSize(sw.fileSize)}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 gap-1.5 text-xs shrink-0"
          disabled={downloading}
          onClick={() => onDownload(sw)}
        >
          <Download className="w-3 h-3" />
          {downloading ? "..." : "받기"}
        </Button>
      </div>

      {/* 메타 정보 */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
        <span>{sw.uploadedBy ?? "알 수 없음"}</span>
        <span>{formatDate(sw.uploadedAt)}</span>
      </div>

      {/* 삭제 확인 오버레이 */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 rounded-lg flex flex-col items-center justify-center gap-3 z-10">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">정말 삭제하시겠습니까?</p>
          <p className="text-xs text-gray-400">{sw.name}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={() => { onDelete(sw.id); setConfirmDelete(false); }}>
              삭제
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────
export default function SoftwarePage() {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission(P.SOFTWARE_WRITE);
  const canDelete = useHasPermission(P.SOFTWARE_DELETE);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["software"],
    queryFn: softwareApi.getAll,
  });

  const { mutate: deleteSoftware } = useMutation({
    mutationFn: (id: number) => softwareApi.delete(id),
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["software"] });
    },
    onError: () => toast.error("삭제 중 오류가 발생했습니다."),
  });

  async function handleDownload(sw: Software) {
    setDownloading(sw.id);
    try {
      await softwareApi.download(sw.id, sw.originalFileName);
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloading(null);
    }
  }

  // 카테고리별 카운트 + 용량
  const categoryCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = list.filter((sw) => (sw.category ?? "기타") === c).length;
    return acc;
  }, {} as Record<string, number>);

  const categorySizes = CATEGORIES.reduce((acc, c) => {
    acc[c] = list.filter((sw) => (sw.category ?? "기타") === c).reduce((s, sw) => s + sw.fileSize, 0);
    return acc;
  }, {} as Record<string, number>);

  const totalSize = list.reduce((s, sw) => s + sw.fileSize, 0);

  // 필터링
  const filtered = list.filter((sw) => {
    if (categoryFilter !== ALL && (sw.category ?? "기타") !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        sw.name.toLowerCase().includes(q) ||
        (sw.description?.toLowerCase().includes(q)) ||
        sw.originalFileName.toLowerCase().includes(q) ||
        (sw.uploadedBy?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // 카테고리별 그룹
  const grouped = CATEGORIES
    .filter((c) => categoryFilter === ALL || categoryFilter === c)
    .map((c) => ({
      category: c,
      items: filtered.filter((sw) => (sw.category ?? "기타") === c),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <SoftwareFormDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            필수 소프트웨어
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">전체 {list.length}개 · {formatFileSize(totalSize)}</p>
          )}
        </div>
        {canWrite && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            소프트웨어 등록
          </Button>
        )}
      </div>

      {/* 카테고리 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 카테고리 탭 */}
        <div className="flex gap-1.5 flex-wrap flex-1">
          <button
            onClick={() => setCategoryFilter(ALL)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              categoryFilter === ALL
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            전체 {list.length}
            {list.length > 0 && <span className="opacity-60 font-normal"> · {formatFileSize(totalSize)}</span>}
          </button>
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;
            const count = categoryCounts[c] ?? 0;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c === categoryFilter ? ALL : c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  categoryFilter === c
                    ? `${meta.bg} ${meta.color} ring-1 ring-current`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                <Icon className="w-3 h-3" />
                {c} {count}
                {count > 0 && <span className="opacity-60 font-normal"> · {formatFileSize(categorySizes[c])}</span>}
              </button>
            );
          })}
        </div>

        {/* 검색 */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 설명, 파일명 검색..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* 콘텐츠 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="w-12 h-12 opacity-20 mb-3" />
          <p className="text-sm">
            {search || categoryFilter !== ALL
              ? "검색 결과가 없습니다."
              : "등록된 소프트웨어가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            const meta = CATEGORY_META[group.category];
            const Icon = meta.icon;
            return (
              <div key={group.category}>
                {/* 그룹 헤더 (전체 보기일 때만) */}
                {categoryFilter === ALL && (
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{group.category}</h2>
                    <span className="text-xs text-gray-400">{group.items.length}개</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{formatFileSize(group.items.reduce((s, sw) => s + sw.fileSize, 0))}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((sw) => (
                    <SoftwareCard
                      key={sw.id}
                      sw={sw}
                      canWrite={canWrite}
                      canDelete={canDelete}
                      onDownload={handleDownload}
                      onDelete={(id) => deleteSoftware(id)}
                      downloading={downloading === sw.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
