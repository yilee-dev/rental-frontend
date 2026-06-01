"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Server as ServerIcon, Plus, Pencil, Trash2, Search, Shield, ShieldOff,
  CheckCircle2, XCircle, AlertCircle, Database, Globe, Mail, HardDrive,
  BarChart2, Archive, MonitorDot, Layers, Cpu, MemoryStick, HardDriveIcon,
  Users2, ExternalLink, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { serverApi } from "@/lib/server-api";
import { P, useHasPermission } from "@/lib/permissions";
import { Server, ServerPurpose, ServerRequest, ServerStatus, ServerType } from "@/types";
import { toast } from "sonner";

const ALL = "ALL";

const STATUS_META: Record<ServerStatus, { label: string; color: string; icon: React.ElementType }> = {
  RUNNING:     { label: "운영 중",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  STOPPED:     { label: "중지",    color: "bg-gray-100 text-gray-600",       icon: XCircle },
  MAINTENANCE: { label: "점검 중", color: "bg-amber-100 text-amber-700",     icon: AlertCircle },
};

const TYPE_META: Record<ServerType, { label: string; color: string }> = {
  VIRTUAL:  { label: "가상화", color: "bg-violet-100 text-violet-700" },
  PHYSICAL: { label: "물리",   color: "bg-blue-100 text-blue-700" },
};

const PURPOSE_META: Record<ServerPurpose, { label: string; icon: React.ElementType }> = {
  WEB:        { label: "웹 서버",       icon: Globe },
  DB:         { label: "데이터베이스",   icon: Database },
  APP:        { label: "애플리케이션",   icon: Layers },
  FILE:       { label: "파일 서버",     icon: HardDrive },
  MAIL:       { label: "메일 서버",     icon: Mail },
  BACKUP:     { label: "백업",          icon: Archive },
  MONITORING: { label: "모니터링",      icon: BarChart2 },
  AD:         { label: "AD (디렉터리)", icon: Users2 },
  ETC:        { label: "기타",          icon: MonitorDot },
};

const PURPOSES: ServerPurpose[] = ["WEB", "DB", "APP", "FILE", "MAIL", "BACKUP", "MONITORING", "AD", "ETC"];
const STATUSES: ServerStatus[] = ["RUNNING", "STOPPED", "MAINTENANCE"];
const SERVER_TYPES: ServerType[] = ["VIRTUAL", "PHYSICAL"];
const HYPERVISORS = ["VMware ESXi", "VMware vSphere", "Hyper-V", "KVM", "XEN", "기타"];

// ─── 상세 다이얼로그 ──────────────────────────────────────────────────────────
function ServerDetailDialog({
  server, onClose, onEdit, canWrite,
}: {
  server: Server;
  onClose: () => void;
  onEdit: (s: Server) => void;
  canWrite: boolean;
}) {
  const status = STATUS_META[server.status];
  const StatusIcon = status.icon;
  const purpose = PURPOSE_META[server.purpose];
  const PurposeIcon = purpose.icon;

  function Row({ label, value }: { label: string; value?: string | number | null }) {
    if (!value && value !== 0) return null;
    return (
      <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
        <dt className="w-32 shrink-0 text-xs text-gray-400">{label}</dt>
        <dd className="text-xs text-gray-800 dark:text-gray-200 break-all">{value}</dd>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <DialogTitle className="font-mono text-lg">{server.hostname}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_META[server.serverType].color}`}>
                  {TYPE_META[server.serverType].label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />{status.label}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <PurposeIcon className="w-3.5 h-3.5" />{purpose.label}
                </span>
              </div>
            </div>
            {canWrite && (
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0"
                onClick={() => { onClose(); onEdit(server); }}>
                <Pencil className="w-3.5 h-3.5" /> 수정
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 네트워크 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">네트워크</h3>
            <dl>
              <Row label="IP 주소" value={server.ipAddress} />
              <Row label="서브넷 마스크" value={server.subnetMask} />
              <Row label="게이트웨이" value={server.gateway} />
              <Row label="MAC 주소" value={server.macAddress} />
            </dl>
          </section>

          {/* 가상화 정보 */}
          {server.serverType === "VIRTUAL" && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">가상화</h3>
              <dl>
                <Row label="하이퍼바이저" value={server.hypervisorType} />
                <Row label="물리 호스트" value={server.hostServer} />
              </dl>
            </section>
          )}

          {/* OS / 스펙 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">OS / 스펙</h3>
            <dl>
              <Row label="운영체제" value={server.os} />
              <Row label="CPU" value={server.cpuCores ? `${server.cpuCores} Core` : null} />
              <Row label="메모리" value={server.memoryGb ? `${server.memoryGb} GB` : null} />
              <Row label="디스크" value={server.diskGb ? `${server.diskGb} GB` : null} />
            </dl>
          </section>

          {/* 방화벽 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">방화벽</h3>
            <dl>
              <div className="flex gap-3 py-2 border-b border-gray-50">
                <dt className="w-32 shrink-0 text-xs text-gray-400">방화벽</dt>
                <dd>
                  {server.firewallEnabled ? (
                    <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                      <Shield className="w-3 h-3" /> 활성화
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-gray-50 text-gray-400 border-gray-200 gap-1">
                      <ShieldOff className="w-3 h-3" /> 비활성화
                    </Badge>
                  )}
                </dd>
              </div>
              {server.firewallEnabled && server.firewallPorts && (
                <div className="flex gap-3 py-2">
                  <dt className="w-32 shrink-0 text-xs text-gray-400">오픈 포트</dt>
                  <dd className="text-xs font-mono bg-gray-50 rounded px-2 py-1.5 flex-1 whitespace-pre-wrap break-all">
                    {server.firewallPorts.split(",").map((p) => p.trim()).join("\n")}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* 자산 / 위치 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">자산 / 위치</h3>
            <dl>
              <Row label="자산번호" value={server.assetNo} />
              <Row label="시리얼번호" value={server.serialNo} />
              <Row label="사업장 코드" value={server.businessSiteCode} />
              <Row label="위치" value={server.location} />
              <Row label="담당자" value={server.managedBy} />
            </dl>
          </section>

          {/* 부가 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">부가 정보</h3>
            <dl>
              <div className="flex gap-3 py-2 border-b border-gray-50">
                <dt className="w-32 shrink-0 text-xs text-gray-400">백업</dt>
                <dd>
                  {server.backupEnabled ? (
                    <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 gap-1">
                      <Archive className="w-3 h-3" /> 활성화
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">비활성화</span>
                  )}
                </dd>
              </div>
              {server.monitoringUrl && (
                <div className="flex gap-3 py-2 border-b border-gray-50">
                  <dt className="w-32 shrink-0 text-xs text-gray-400">모니터링 URL</dt>
                  <dd>
                    <a href={server.monitoringUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      {server.monitoringUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              )}
              {server.description && (
                <div className="flex gap-3 py-2 border-b border-gray-50">
                  <dt className="w-32 shrink-0 text-xs text-gray-400">설명</dt>
                  <dd className="text-xs text-gray-700 whitespace-pre-wrap">{server.description}</dd>
                </div>
              )}
              {server.memo && (
                <div className="flex gap-3 py-2">
                  <dt className="w-32 shrink-0 text-xs text-gray-400">메모</dt>
                  <dd className="text-xs text-gray-700 whitespace-pre-wrap">{server.memo}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* 등록/수정일 */}
          <div className="flex gap-4 text-[11px] text-gray-400 pt-1 border-t">
            <span>등록: {server.createdAt?.slice(0, 16).replace("T", " ")}</span>
            <span>수정: {server.updatedAt?.slice(0, 16).replace("T", " ")}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 등록/수정 다이얼로그 ─────────────────────────────────────────────────────
function ServerFormDialog({
  open, onClose, editTarget,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: Server | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editTarget;

  const blank: ServerRequest = {
    hostname: "", serverType: "VIRTUAL", hypervisorType: null, hostServer: null,
    ipAddress: "", subnetMask: null, gateway: null, macAddress: null,
    os: "", cpuCores: null, memoryGb: null, diskGb: null,
    purpose: "WEB", description: null, firewallEnabled: true, firewallPorts: null,
    businessSiteCode: null, location: null, assetNo: null, serialNo: null,
    managedBy: null, status: "RUNNING", backupEnabled: false, monitoringUrl: null, memo: null,
  };

  function toForm(s: Server): ServerRequest {
    return {
      hostname: s.hostname, serverType: s.serverType,
      hypervisorType: s.hypervisorType, hostServer: s.hostServer,
      ipAddress: s.ipAddress, subnetMask: s.subnetMask,
      gateway: s.gateway, macAddress: s.macAddress,
      os: s.os, cpuCores: s.cpuCores, memoryGb: s.memoryGb,
      diskGb: s.diskGb, purpose: s.purpose,
      description: s.description, firewallEnabled: s.firewallEnabled,
      firewallPorts: s.firewallPorts, businessSiteCode: s.businessSiteCode,
      location: s.location, assetNo: s.assetNo, serialNo: s.serialNo,
      managedBy: s.managedBy, status: s.status,
      backupEnabled: s.backupEnabled, monitoringUrl: s.monitoringUrl, memo: s.memo,
    };
  }

  const [form, setForm] = useState<ServerRequest>(editTarget ? toForm(editTarget) : blank);

  useEffect(() => {
    setForm(editTarget ? toForm(editTarget) : blank);
  }, [open, editTarget]);

  function set<K extends keyof ServerRequest>(key: K, value: ServerRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => isEdit ? serverApi.update(editTarget!.id, form) : serverApi.create(form),
    onSuccess: () => {
      toast.success(isEdit ? "수정되었습니다." : "서버가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      onClose();
    },
    onError: () => toast.error("처리 중 오류가 발생했습니다."),
  });

  const canSubmit = form.hostname.trim() && form.ipAddress.trim() && form.os.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ServerIcon className="w-4 h-4 text-blue-600" />
            {isEdit ? "서버 수정" : "서버 등록"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 기본 정보 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기본 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>호스트명 <span className="text-red-500">*</span></Label>
                <Input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="예) web-server-01" />
              </div>
              <div className="space-y-1.5">
                <Label>서버 유형 <span className="text-red-500">*</span></Label>
                <Select value={form.serverType} onValueChange={(v) => set("serverType", v as ServerType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.serverType === "VIRTUAL" && (
                <>
                  <div className="space-y-1.5">
                    <Label>하이퍼바이저</Label>
                    <Select value={form.hypervisorType ?? ""} onValueChange={(v) => set("hypervisorType", v || null)}>
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {HYPERVISORS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>물리 호스트 서버</Label>
                    <Input value={form.hostServer ?? ""} onChange={(e) => set("hostServer", e.target.value || null)} placeholder="예) esxi-host-01" />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label>운영 상태 <span className="text-red-500">*</span></Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as ServerStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>용도 <span className="text-red-500">*</span></Label>
                <Select value={form.purpose} onValueChange={(v) => set("purpose", v as ServerPurpose)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          {PURPOSE_META[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* 네트워크 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">네트워크</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>IP 주소 <span className="text-red-500">*</span></Label>
                <Input value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="예) 10.117.9.40" />
              </div>
              <div className="space-y-1.5">
                <Label>서브넷 마스크</Label>
                <Input value={form.subnetMask ?? ""} onChange={(e) => set("subnetMask", e.target.value || null)} placeholder="예) 255.255.255.0" />
              </div>
              <div className="space-y-1.5">
                <Label>게이트웨이</Label>
                <Input value={form.gateway ?? ""} onChange={(e) => set("gateway", e.target.value || null)} placeholder="예) 10.117.9.1" />
              </div>
              <div className="space-y-1.5">
                <Label>MAC 주소</Label>
                <Input value={form.macAddress ?? ""} onChange={(e) => set("macAddress", e.target.value || null)} placeholder="예) 00:1A:2B:3C:4D:5E" />
              </div>
            </div>
          </section>

          {/* OS / 스펙 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">OS / 스펙</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>운영체제 <span className="text-red-500">*</span></Label>
                <Input value={form.os} onChange={(e) => set("os", e.target.value)} placeholder="예) Windows Server 2022, Ubuntu 22.04 LTS" />
              </div>
              <div className="space-y-1.5">
                <Label>CPU 코어</Label>
                <Input type="number" value={form.cpuCores ?? ""} onChange={(e) => set("cpuCores", e.target.value ? Number(e.target.value) : null)} placeholder="예) 8" />
              </div>
              <div className="space-y-1.5">
                <Label>메모리 (GB)</Label>
                <Input type="number" value={form.memoryGb ?? ""} onChange={(e) => set("memoryGb", e.target.value ? Number(e.target.value) : null)} placeholder="예) 32" />
              </div>
              <div className="space-y-1.5">
                <Label>디스크 (GB)</Label>
                <Input type="number" value={form.diskGb ?? ""} onChange={(e) => set("diskGb", e.target.value ? Number(e.target.value) : null)} placeholder="예) 500" />
              </div>
            </div>
          </section>

          {/* 방화벽 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">방화벽</h3>
            <div className="flex items-center gap-3">
              <Checkbox id="firewallEnabled" checked={form.firewallEnabled} onCheckedChange={(v) => set("firewallEnabled", !!v)} />
              <label htmlFor="firewallEnabled" className="text-sm cursor-pointer">
                {form.firewallEnabled ? "방화벽 활성화" : "방화벽 비활성화"}
              </label>
            </div>
            {form.firewallEnabled && (
              <div className="space-y-1.5">
                <Label>오픈 포트</Label>
                <Textarea
                  value={form.firewallPorts ?? ""}
                  onChange={(e) => set("firewallPorts", e.target.value || null)}
                  placeholder={"예) 22/tcp:SSH, 80/tcp:HTTP, 443/tcp:HTTPS, 3306/tcp:MySQL"}
                  rows={3}
                />
                <p className="text-xs text-gray-400">형식: 포트/프로토콜:용도 — 쉼표로 구분</p>
              </div>
            )}
          </section>

          {/* 자산 / 위치 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">자산 / 위치</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>자산번호</Label>
                <Input value={form.assetNo ?? ""} onChange={(e) => set("assetNo", e.target.value || null)} placeholder="예) SVR-2024-001" />
              </div>
              {form.serverType === "PHYSICAL" && (
                <div className="space-y-1.5">
                  <Label>시리얼번호</Label>
                  <Input value={form.serialNo ?? ""} onChange={(e) => set("serialNo", e.target.value || null)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>사업장 코드</Label>
                <Input value={form.businessSiteCode ?? ""} onChange={(e) => set("businessSiteCode", e.target.value || null)} placeholder="예) GURO" />
              </div>
              <div className="space-y-1.5">
                <Label>위치</Label>
                <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="예) IDC 1층 랙 A-3" />
              </div>
              <div className="space-y-1.5">
                <Label>담당자</Label>
                <Input value={form.managedBy ?? ""} onChange={(e) => set("managedBy", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>모니터링 URL</Label>
                <Input value={form.monitoringUrl ?? ""} onChange={(e) => set("monitoringUrl", e.target.value || null)} placeholder="http://..." />
              </div>
            </div>
          </section>

          {/* 부가 */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">부가 정보</h3>
            <div className="flex items-center gap-3">
              <Checkbox id="backupEnabled" checked={form.backupEnabled} onCheckedChange={(v) => set("backupEnabled", !!v)} />
              <label htmlFor="backupEnabled" className="text-sm cursor-pointer">
                {form.backupEnabled ? "백업 활성화" : "백업 비활성화"}
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>설명</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>메모</Label>
              <Textarea value={form.memo ?? ""} onChange={(e) => set("memo", e.target.value || null)} rows={2} />
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
            <Button onClick={() => save()} disabled={!canSubmit || isPending}>
              {isPending ? "처리 중..." : isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 서버 카드 ────────────────────────────────────────────────────────────────
function ServerCard({
  server, canWrite, canDelete,
  onEdit, onDelete, onClick,
}: {
  server: Server;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (s: Server) => void;
  onDelete: (id: number) => void;
  onClick: (s: Server) => void;
}) {
  const status = STATUS_META[server.status];
  const StatusIcon = status.icon;
  const purpose = PURPOSE_META[server.purpose];
  const PurposeIcon = purpose.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      onClick={() => !confirmDelete && onClick(server)}
      className="relative rounded-xl border bg-white dark:bg-gray-900 p-5 space-y-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm truncate">{server.hostname}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_META[server.serverType].color}`}>
              {TYPE_META[server.serverType].label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
            <PurposeIcon className="w-3.5 h-3.5" />
            <span>{purpose.label}</span>
            {server.businessSiteCode && <><span>·</span><span>{server.businessSiteCode}</span></>}
          </div>
        </div>
        {(canWrite || canDelete) && (
          <div className="flex gap-1 shrink-0">
            {canWrite && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(server); }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 네트워크 / OS */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="text-gray-400">IP</div>
          <div className="font-mono font-medium">{server.ipAddress}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">OS</div>
          <div className="truncate" title={server.os}>{server.os}</div>
        </div>
        {server.serverType === "VIRTUAL" && server.hypervisorType && (
          <div className="space-y-1">
            <div className="text-gray-400">하이퍼바이저</div>
            <div>{server.hypervisorType}</div>
          </div>
        )}
        {server.serverType === "VIRTUAL" && server.hostServer && (
          <div className="space-y-1">
            <div className="text-gray-400">물리 호스트</div>
            <div className="font-mono truncate">{server.hostServer}</div>
          </div>
        )}
      </div>

      {/* 스펙 */}
      {(server.cpuCores || server.memoryGb || server.diskGb) && (
        <div className="flex gap-3 text-xs text-gray-500">
          {server.cpuCores && <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{server.cpuCores}core</span>}
          {server.memoryGb && <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" />{server.memoryGb}GB</span>}
          {server.diskGb && <span className="flex items-center gap-1"><HardDriveIcon className="w-3 h-3" />{server.diskGb}GB</span>}
        </div>
      )}

      {/* 방화벽 / 백업 */}
      <div className="flex items-center gap-2 flex-wrap">
        {server.firewallEnabled ? (
          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
            <Shield className="w-3 h-3" /> 방화벽 ON
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-gray-50 text-gray-400 border-gray-200 gap-1">
            <ShieldOff className="w-3 h-3" /> 방화벽 OFF
          </Badge>
        )}
        {server.backupEnabled && (
          <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 gap-1">
            <Archive className="w-3 h-3" /> 백업 ON
          </Badge>
        )}
        {server.location && <span className="text-[11px] text-gray-400 truncate">{server.location}</span>}
      </div>

      {server.firewallEnabled && server.firewallPorts && (
        <div className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1.5 font-mono truncate" title={server.firewallPorts}>
          {server.firewallPorts}
        </div>
      )}

      {server.managedBy && <div className="text-[11px] text-gray-400">담당: {server.managedBy}</div>}

      {/* 삭제 확인 오버레이 */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 rounded-xl flex flex-col items-center justify-center gap-3 z-10">
          <p className="text-sm font-medium">정말 삭제하시겠습니까?</p>
          <p className="text-xs text-gray-400">{server.hostname}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="h-7 text-xs px-3"
              onClick={(e) => { e.stopPropagation(); onDelete(server.id); setConfirmDelete(false); }}>삭제</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-3"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>취소</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ServersPage() {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission(P.SERVER_WRITE);
  const canDelete = useHasPermission(P.SERVER_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Server | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: serverApi.getAll,
  });

  const { mutate: deleteServer } = useMutation({
    mutationFn: (id: number) => serverApi.delete(id),
    onSuccess: () => { toast.success("삭제되었습니다."); queryClient.invalidateQueries({ queryKey: ["servers"] }); },
    onError: () => toast.error("삭제 중 오류가 발생했습니다."),
  });

  function openCreate() { setEditTarget(null); setFormOpen(true); }
  function openEdit(s: Server) { setEditTarget(s); setFormOpen(true); }

  const runningCount = list.filter((s) => s.status === "RUNNING").length;
  const virtualCount = list.filter((s) => s.serverType === "VIRTUAL").length;
  const physicalCount = list.filter((s) => s.serverType === "PHYSICAL").length;

  const filtered = list.filter((s) => {
    if (typeFilter !== ALL && s.serverType !== typeFilter) return false;
    if (statusFilter !== ALL && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.hostname.toLowerCase().includes(q) ||
        s.ipAddress.includes(q) ||
        s.os.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q)) ||
        (s.managedBy?.toLowerCase().includes(q)) ||
        (s.location?.toLowerCase().includes(q)) ||
        (s.assetNo?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <ServerFormDialog open={formOpen} onClose={() => setFormOpen(false)} editTarget={editTarget} />

      {selectedServer && (
        <ServerDetailDialog
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onEdit={(s) => { setSelectedServer(null); openEdit(s); }}
          canWrite={canWrite}
        />
      )}

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ServerIcon className="w-5 h-5 text-blue-600" />
            서버 자산 관리
          </h1>
          {!isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
              <span>전체 {list.length}대</span>
              <span>·</span>
              <span className="text-emerald-600">운영 {runningCount}</span>
              <span>·</span>
              <span className="text-violet-600">가상 {virtualCount}</span>
              <span>·</span>
              <span className="text-blue-600">물리 {physicalCount}</span>
            </div>
          )}
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> 서버 등록
          </Button>
        )}
      </div>

      {/* 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {[ALL, ...SERVER_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === ALL ? `전체 ${list.length}` : `${TYPE_META[t as ServerType].label} ${list.filter((s) => s.serverType === t).length}`}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            return (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? ALL : s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === s ? `${meta.color} ring-1 ring-current` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {meta.label} {list.filter((srv) => srv.status === s).length}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="호스트명, IP, OS 검색..." className="pl-8 h-8 text-sm" />
        </div>
      </div>

      {/* 콘텐츠 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ServerIcon className="w-12 h-12 opacity-20 mb-3" />
          <p className="text-sm">{search || typeFilter !== ALL || statusFilter !== ALL ? "검색 결과가 없습니다." : "등록된 서버가 없습니다."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              canWrite={canWrite}
              canDelete={canDelete}
              onEdit={openEdit}
              onDelete={(id) => deleteServer(id)}
              onClick={setSelectedServer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
