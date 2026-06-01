"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Network, Plus, Pencil, Trash2, Search, CheckCircle2, XCircle, AlertCircle,
  Router, Radio, ShieldCheck, Wifi, HardDrive, Zap, Layers, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { networkEquipmentApi } from "@/lib/network-equipment-api";
import { P, useHasPermission } from "@/lib/permissions";
import { NetworkEquipment, NetworkEquipmentRequest, NetworkEquipmentStatus, NetworkEquipmentType } from "@/types";
import { toast } from "sonner";

const ALL = "ALL";

const STATUS_META: Record<NetworkEquipmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:      { label: "운영 중",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  INACTIVE:    { label: "비활성",   color: "bg-gray-100 text-gray-600",       icon: XCircle },
  MAINTENANCE: { label: "점검 중",  color: "bg-amber-100 text-amber-700",     icon: AlertCircle },
};

const TYPE_META: Record<NetworkEquipmentType, { label: string; icon: React.ElementType; color: string }> = {
  ROUTER:       { label: "라우터",      icon: Router,     color: "text-blue-600 bg-blue-50" },
  SWITCH:       { label: "스위치",      icon: Layers,     color: "text-indigo-600 bg-indigo-50" },
  FIREWALL:     { label: "방화벽",      icon: ShieldCheck, color: "text-red-600 bg-red-50" },
  AP:           { label: "AP",          icon: Wifi,       color: "text-sky-600 bg-sky-50" },
  NAS:          { label: "NAS",         icon: HardDrive,  color: "text-violet-600 bg-violet-50" },
  UPS:          { label: "UPS",         icon: Zap,        color: "text-amber-600 bg-amber-50" },
  LOAD_BALANCER:{ label: "L/B",         icon: Radio,      color: "text-emerald-600 bg-emerald-50" },
  OTHER:        { label: "기타",         icon: Package,    color: "text-gray-500 bg-gray-50" },
};

const EQUIPMENT_TYPES: NetworkEquipmentType[] = ["ROUTER", "SWITCH", "FIREWALL", "AP", "NAS", "UPS", "LOAD_BALANCER", "OTHER"];
const STATUSES: NetworkEquipmentStatus[] = ["ACTIVE", "INACTIVE", "MAINTENANCE"];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── 등록/수정 다이얼로그 ─────────────────────────────────────────────────────
function EquipmentFormDialog({
  open, onClose, editTarget,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: NetworkEquipment | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editTarget;

  const blank: NetworkEquipmentRequest = {
    equipmentType: "SWITCH", manufacturer: null, model: null,
    assetNo: null, serialNo: null, ipAddress: null, macAddress: null,
    businessSiteCode: null, location: null, purpose: null, portCount: null,
    managedBy: null, status: "ACTIVE", purchasedAt: null, warrantyExpiry: null, memo: null,
  };

  function toForm(e: NetworkEquipment): NetworkEquipmentRequest {
    return {
      equipmentType: e.equipmentType, manufacturer: e.manufacturer,
      model: e.model, assetNo: e.assetNo, serialNo: e.serialNo,
      ipAddress: e.ipAddress, macAddress: e.macAddress,
      businessSiteCode: e.businessSiteCode, location: e.location,
      purpose: e.purpose, portCount: e.portCount,
      managedBy: e.managedBy, status: e.status,
      purchasedAt: e.purchasedAt, warrantyExpiry: e.warrantyExpiry,
      memo: e.memo,
    };
  }

  const [form, setForm] = useState<NetworkEquipmentRequest>(editTarget ? toForm(editTarget) : blank);

  useEffect(() => {
    setForm(editTarget ? toForm(editTarget) : blank);
  }, [open, editTarget]);

  function set<K extends keyof NetworkEquipmentRequest>(key: K, value: NetworkEquipmentRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      isEdit ? networkEquipmentApi.update(editTarget!.id, form) : networkEquipmentApi.create(form),
    onSuccess: () => {
      toast.success(isEdit ? "수정되었습니다." : "장비가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["network-equipment"] });
      onClose();
    },
    onError: () => toast.error("처리 중 오류가 발생했습니다."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-blue-600" />
            {isEdit ? "장비 수정" : "네트워크 장비 등록"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 장비 기본 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">장비 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>장비 유형 <span className="text-red-500">*</span></Label>
                <Select value={form.equipmentType} onValueChange={(v) => set("equipmentType", v as NetworkEquipmentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>상태 <span className="text-red-500">*</span></Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as NetworkEquipmentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>제조사</Label>
                <Input value={form.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value || null)} placeholder="예) Cisco, HP Aruba, Juniper" />
              </div>
              <div className="space-y-1.5">
                <Label>모델명</Label>
                <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value || null)} placeholder="예) Catalyst 2960X" />
              </div>
              {(form.equipmentType === "SWITCH" || form.equipmentType === "ROUTER") && (
                <div className="space-y-1.5">
                  <Label>포트 수</Label>
                  <Input type="number" value={form.portCount ?? ""} onChange={(e) => set("portCount", e.target.value ? Number(e.target.value) : null)} placeholder="예) 24" />
                </div>
              )}
            </div>
          </section>

          {/* 자산 식별 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">자산 식별</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>자산번호</Label>
                <Input value={form.assetNo ?? ""} onChange={(e) => set("assetNo", e.target.value || null)} placeholder="예) NET-2024-001" />
              </div>
              <div className="space-y-1.5">
                <Label>시리얼번호</Label>
                <Input value={form.serialNo ?? ""} onChange={(e) => set("serialNo", e.target.value || null)} />
              </div>
            </div>
          </section>

          {/* 네트워크 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">네트워크</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>관리 IP</Label>
                <Input value={form.ipAddress ?? ""} onChange={(e) => set("ipAddress", e.target.value || null)} placeholder="예) 10.117.9.254" />
              </div>
              <div className="space-y-1.5">
                <Label>MAC 주소</Label>
                <Input value={form.macAddress ?? ""} onChange={(e) => set("macAddress", e.target.value || null)} placeholder="예) 00:1A:2B:3C:4D:5E" />
              </div>
            </div>
          </section>

          {/* 위치 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">위치 / 담당</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>사업장 코드</Label>
                <Input value={form.businessSiteCode ?? ""} onChange={(e) => set("businessSiteCode", e.target.value || null)} placeholder="예) GURO" />
              </div>
              <div className="space-y-1.5">
                <Label>배치장소</Label>
                <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="예) 본관 서버실 랙 A-3" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>용도</Label>
                <Input value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value || null)} placeholder="예) 인터넷 연결용 코어 스위치" />
              </div>
              <div className="space-y-1.5">
                <Label>담당자</Label>
                <Input value={form.managedBy ?? ""} onChange={(e) => set("managedBy", e.target.value || null)} />
              </div>
            </div>
          </section>

          {/* 자산 기간 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">자산 기간</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>구매일</Label>
                <Input type="date" value={form.purchasedAt ?? ""} onChange={(e) => set("purchasedAt", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>보증 만료일</Label>
                <Input type="date" value={form.warrantyExpiry ?? ""} onChange={(e) => set("warrantyExpiry", e.target.value || null)} />
              </div>
            </div>
          </section>

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea value={form.memo ?? ""} onChange={(e) => set("memo", e.target.value || null)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
            <Button onClick={() => save()} disabled={isPending}>
              {isPending ? "처리 중..." : isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상세 다이얼로그 ──────────────────────────────────────────────────────────
function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-800 dark:text-gray-200 break-all ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
      </span>
    </div>
  );
}

function EquipmentDetailDialog({
  equipment, onClose, onEdit,
}: {
  equipment: NetworkEquipment;
  onClose: () => void;
  onEdit: (e: NetworkEquipment) => void;
}) {
  const canWrite = useHasPermission(P.NETWORK_WRITE);
  const typeMeta = TYPE_META[equipment.equipmentType];
  const TypeIcon = typeMeta.icon;
  const statusMeta = STATUS_META[equipment.status];
  const StatusIcon = statusMeta.icon;
  const warrantyDays = daysUntil(equipment.warrantyExpiry);
  const warrantyWarning = warrantyDays !== null && warrantyDays <= 30;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${typeMeta.color}`}>
                <TypeIcon className="w-3.5 h-3.5" />
                {typeMeta.label}
              </div>
              <span>{equipment.manufacturer ?? ""} {equipment.model ?? ""}</span>
            </DialogTitle>
            {canWrite && (
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { onClose(); onEdit(equipment); }}>
                <Pencil className="w-3.5 h-3.5" /> 수정
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* 상태 */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusMeta.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusMeta.label}
            </span>
            {warrantyWarning && warrantyDays !== null && (
              <span className="text-xs text-amber-600 font-medium">
                {warrantyDays < 0 ? `보증 ${Math.abs(warrantyDays)}일 초과` : `보증 만료 D-${warrantyDays}`}
              </span>
            )}
          </div>

          {/* 자산 식별 */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">자산 식별</h3>
            <DetailRow label="자산번호" value={equipment.assetNo} mono />
            <DetailRow label="시리얼번호" value={equipment.serialNo} mono />
            {equipment.portCount !== null && <DetailRow label="포트 수" value={`${equipment.portCount}포트`} />}
          </section>

          {/* 네트워크 */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">네트워크</h3>
            <DetailRow label="관리 IP" value={equipment.ipAddress} mono />
            <DetailRow label="MAC 주소" value={equipment.macAddress} mono />
          </section>

          {/* 위치 / 담당 */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">위치 / 담당</h3>
            <DetailRow label="사업장" value={equipment.businessSiteCode} />
            <DetailRow label="배치장소" value={equipment.location} />
            <DetailRow label="용도" value={equipment.purpose} />
            <DetailRow label="담당자" value={equipment.managedBy} />
          </section>

          {/* 자산 기간 */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">자산 기간</h3>
            <DetailRow label="구매일" value={equipment.purchasedAt} />
            <DetailRow
              label="보증 만료일"
              value={equipment.warrantyExpiry ? (
                <span className={warrantyWarning ? "text-amber-600 font-semibold" : ""}>
                  {equipment.warrantyExpiry}
                  {warrantyDays !== null && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({warrantyDays < 0 ? `${Math.abs(warrantyDays)}일 초과` : `D-${warrantyDays}`})
                    </span>
                  )}
                </span>
              ) : null}
            />
          </section>

          {/* 메모 */}
          {equipment.memo && (
            <section>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">메모</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">{equipment.memo}</p>
            </section>
          )}

          {/* 등록/수정 시각 */}
          <div className="flex gap-4 text-[11px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span>등록 {equipment.createdAt.slice(0, 10)}</span>
            <span>수정 {equipment.updatedAt.slice(0, 10)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 장비 행 ──────────────────────────────────────────────────────────────────
function EquipmentRow({
  equipment, canWrite, canDelete, onEdit, onDelete, onClick,
}: {
  equipment: NetworkEquipment;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (e: NetworkEquipment) => void;
  onDelete: (id: number) => void;
  onClick: (e: NetworkEquipment) => void;
}) {
  const typeMeta = TYPE_META[equipment.equipmentType];
  const TypeIcon = typeMeta.icon;
  const statusMeta = STATUS_META[equipment.status];
  const StatusIcon = statusMeta.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const warrantyDays = daysUntil(equipment.warrantyExpiry);
  const warrantyWarning = warrantyDays !== null && warrantyDays <= 30;

  return (
    <tr
      onClick={() => onClick(equipment)}
      className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${warrantyWarning ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
    >
      {/* 유형 */}
      <td className="px-4 py-3">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${typeMeta.color}`}>
          <TypeIcon className="w-3.5 h-3.5" />
          {typeMeta.label}
        </div>
      </td>
      {/* 제조사/모델 */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{equipment.manufacturer ?? "-"}</div>
        <div className="text-xs text-gray-400">{equipment.model ?? "-"}</div>
      </td>
      {/* IP / 자산번호 */}
      <td className="px-4 py-3">
        <div className="font-mono text-sm">{equipment.ipAddress ?? "-"}</div>
        <div className="text-xs text-gray-400">{equipment.assetNo ?? "-"}</div>
      </td>
      {/* 시리얼 */}
      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{equipment.serialNo ?? "-"}</td>
      {/* 사업장 / 위치 */}
      <td className="px-4 py-3">
        <div className="text-sm">{equipment.businessSiteCode ?? "-"}</div>
        <div className="text-xs text-gray-400 truncate max-w-[140px]" title={equipment.location ?? ""}>{equipment.location ?? "-"}</div>
      </td>
      {/* 상태 */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusMeta.color}`}>
          <StatusIcon className="w-3 h-3" />
          {statusMeta.label}
        </span>
      </td>
      {/* 보증 만료 */}
      <td className="px-4 py-3">
        {equipment.warrantyExpiry ? (
          <div className="text-xs">
            <div className={warrantyWarning ? "text-amber-600 font-semibold" : "text-gray-600"}>
              {equipment.warrantyExpiry}
            </div>
            {warrantyDays !== null && (
              <div className={`text-[10px] ${warrantyWarning ? "text-amber-500" : "text-gray-400"}`}>
                {warrantyDays < 0 ? `${Math.abs(warrantyDays)}일 초과` : `D-${warrantyDays}`}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      {/* 담당자 */}
      <td className="px-4 py-3 text-xs text-gray-500">{equipment.managedBy ?? "-"}</td>
      {/* 액션 */}
      <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
              onClick={() => { onDelete(equipment.id); setConfirmDelete(false); }}>삭제</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
              onClick={() => setConfirmDelete(false)}>취소</Button>
          </div>
        ) : (
          <div className="flex gap-1">
            {canWrite && (
              <button onClick={(ev) => { ev.stopPropagation(); onEdit(equipment); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button onClick={(ev) => { ev.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function NetworkEquipmentPage() {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission(P.NETWORK_WRITE);
  const canDelete = useHasPermission(P.NETWORK_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NetworkEquipment | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<NetworkEquipment | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["network-equipment"],
    queryFn: networkEquipmentApi.getAll,
  });

  const { mutate: deleteEquipment } = useMutation({
    mutationFn: (id: number) => networkEquipmentApi.delete(id),
    onSuccess: () => { toast.success("삭제되었습니다."); queryClient.invalidateQueries({ queryKey: ["network-equipment"] }); },
    onError: () => toast.error("삭제 중 오류가 발생했습니다."),
  });

  function openCreate() { setEditTarget(null); setFormOpen(true); }
  function openEdit(e: NetworkEquipment) { setEditTarget(e); setFormOpen(true); }

  // 통계
  const activeCount = list.filter((e) => e.status === "ACTIVE").length;
  const warrantyAlertCount = list.filter((e) => {
    const d = daysUntil(e.warrantyExpiry);
    return d !== null && d <= 30;
  }).length;

  // 필터링
  const filtered = list.filter((e) => {
    if (typeFilter !== ALL && e.equipmentType !== typeFilter) return false;
    if (statusFilter !== ALL && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.manufacturer?.toLowerCase().includes(q)) ||
        (e.model?.toLowerCase().includes(q)) ||
        (e.ipAddress?.includes(q)) ||
        (e.assetNo?.toLowerCase().includes(q)) ||
        (e.serialNo?.toLowerCase().includes(q)) ||
        (e.location?.toLowerCase().includes(q)) ||
        (e.businessSiteCode?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <EquipmentFormDialog open={formOpen} onClose={() => setFormOpen(false)} editTarget={editTarget} />
      {selectedEquipment && (
        <EquipmentDetailDialog
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          onEdit={(e) => { setSelectedEquipment(null); openEdit(e); }}
        />
      )}

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            네트워크 장비 관리
          </h1>
          {!isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
              <span>전체 {list.length}대</span>
              <span>·</span>
              <span className="text-emerald-600">운영 {activeCount}</span>
              {warrantyAlertCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600">보증만료 임박 {warrantyAlertCount}</span>
                </>
              )}
            </div>
          )}
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> 장비 등록
          </Button>
        )}
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap flex-1">
          <button
            onClick={() => setTypeFilter(ALL)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              typeFilter === ALL ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체 {list.length}
          </button>
          {EQUIPMENT_TYPES.map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const count = list.filter((e) => e.equipmentType === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? ALL : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  typeFilter === t ? `${meta.color} ring-1 ring-current` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-3 h-3" />{meta.label} {count}
              </button>
            );
          })}
          <div className="w-px bg-gray-200 mx-1" />
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const count = list.filter((e) => e.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? ALL : s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === s ? `${meta.color} ring-1 ring-current` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {meta.label} {count}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제조사, 모델, IP, 자산번호 검색..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* 보증 만료 경고 배너 */}
      {warrantyAlertCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          보증 만료가 30일 이내인 장비가 {warrantyAlertCount}대 있습니다.
        </div>
      )}

      {/* 테이블 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Network className="w-12 h-12 opacity-20 mb-3" />
          <p className="text-sm">{search || typeFilter !== ALL || statusFilter !== ALL ? "검색 결과가 없습니다." : "등록된 장비가 없습니다."}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">유형</th>
                <th className="px-4 py-3 text-left font-medium">제조사 / 모델</th>
                <th className="px-4 py-3 text-left font-medium">IP / 자산번호</th>
                <th className="px-4 py-3 text-left font-medium">시리얼번호</th>
                <th className="px-4 py-3 text-left font-medium">사업장 / 위치</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">보증 만료</th>
                <th className="px-4 py-3 text-left font-medium">담당자</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <EquipmentRow
                  key={e.id}
                  equipment={e}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  onEdit={openEdit}
                  onDelete={(id) => deleteEquipment(id)}
                  onClick={setSelectedEquipment}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
