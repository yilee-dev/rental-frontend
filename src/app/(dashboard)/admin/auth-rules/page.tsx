"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "http://10.117.9.40:8080";

interface AuthRule {
  method: string;
  pathPattern: string;
  role: string;
}

async function fetchRules(): Promise<AuthRule[]> {
  const res = await fetch(`${BFF_URL}/api/admin/auth/rules`, { credentials: "include" });
  if (!res.ok) throw new Error(`Error: ${res.status}`);
  return res.json();
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function addRule(rule: AuthRule): Promise<void> {
  const csrfToken = getCsrfToken();
  const res = await fetch(`${BFF_URL}/api/admin/auth/rules`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
    },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error(`Error: ${res.status}`);
}

async function deleteRule(rule: Pick<AuthRule, "method" | "pathPattern">): Promise<void> {
  const csrfToken = getCsrfToken();
  const res = await fetch(`${BFF_URL}/api/admin/auth/rules`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
    },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error(`Error: ${res.status}`);
}

const HTTP_METHODS = ["*", "GET", "POST", "PUT", "DELETE"];

// 시스템에서 사용 중인 권한 목록 (그룹별)
const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: "렌탈 PC",
    permissions: ["rental:read", "rental:write", "rental:delete", "rental:qr"],
  },
  {
    label: "자산 실사",
    permissions: ["audit:read", "audit:manage", "audit:verify"],
  },
  {
    label: "폐기 디스크",
    permissions: ["disposal:read", "disposal:write", "disposal:delete"],
  },
  {
    label: "소프트웨어",
    permissions: ["software:read", "software:write", "software:delete"],
  },
  {
    label: "서버 자산",
    permissions: ["server:read", "server:write", "server:delete"],
  },
  {
    label: "네트워크 장비",
    permissions: ["network:read", "network:write", "network:delete"],
  },
  {
    label: "시스템 / 관리자",
    permissions: ["admin:manage", "report:dba"],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  POST:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PUT:    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "*":    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function permissionBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "admin:manage" || role === "report:dba") return "default";
  if (role.endsWith(":read")) return "outline";
  return "secondary";
}

export default function AuthRulesPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.permissions?.includes("admin:manage") ?? false;
  const queryClient = useQueryClient();

  const [newMethod, setNewMethod] = useState("*");
  const [newPath, setNewPath] = useState("");
  const [newRole, setNewRole] = useState("rental:read");
  const [customRole, setCustomRole] = useState("");
  const [useCustomRole, setUseCustomRole] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["auth-rules"],
    queryFn: fetchRules,
    enabled: isManager,
  });

  const addMutation = useMutation({
    mutationFn: addRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-rules"] });
      setNewPath("");
      setCustomRole("");
      toast.success("규칙이 추가되었습니다.");
    },
    onError: () => toast.error("규칙 추가에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-rules"] });
      toast.success("규칙이 삭제되었습니다.");
    },
    onError: () => toast.error("규칙 삭제에 실패했습니다."),
  });

  function handleAdd() {
    if (!newPath.trim()) { toast.error("경로 패턴을 입력하세요."); return; }
    const authority = useCustomRole ? customRole.trim() : newRole;
    if (!authority) { toast.error("권한을 입력하세요."); return; }
    addMutation.mutate({ method: newMethod, pathPattern: newPath.trim(), role: authority });
  }

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>접근 권한이 없습니다.</p>
      </div>
    );
  }

  const sorted = [...rules].sort((a, b) => {
    const ma = HTTP_METHODS.indexOf(a.method), mb = HTTP_METHODS.indexOf(b.method);
    if (ma !== mb) return ma - mb;
    return a.pathPattern.localeCompare(b.pathPattern);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-bold">API 권한 관리</h1>
        <Badge variant="secondary" className="text-xs">{rules.length}개 규칙</Badge>
      </div>

      {/* 규칙 추가 */}
      <div className="p-4 rounded-lg border bg-white dark:bg-gray-900 space-y-3">
        <p className="text-xs text-muted-foreground">
          기본 규칙(application.yml)은 서버 재시작 시 자동 적재됩니다. 여기서는 신규 서비스 경로에 대한 추가 규칙을 등록하세요.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Method</label>
            <Select value={newMethod} onValueChange={(v) => setNewMethod(v ?? "*")}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Path */}
          <div className="space-y-1.5 flex-1 min-w-48">
            <label className="text-xs font-medium text-muted-foreground">Path Pattern</label>
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/api/v1/users/**"
            />
          </div>

          {/* Authority */}
          <div className="space-y-1.5 w-56">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Authority</label>
              <button
                type="button"
                className="text-[10px] text-blue-500 hover:underline"
                onClick={() => { setUseCustomRole(!useCustomRole); setCustomRole(""); }}
              >
                {useCustomRole ? "목록에서 선택" : "직접 입력"}
              </button>
            </div>
            {useCustomRole ? (
              <Input
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="예) users:read"
                className="font-mono text-sm"
              />
            ) : (
              <Select value={newRole} onValueChange={(v) => setNewRole(v ?? "rental:read")}>
                <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERMISSION_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs">{group.label}</SelectLabel>
                      {group.permissions.map((p) => (
                        <SelectItem key={p} value={p} className="font-mono text-xs">{p}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button onClick={handleAdd} disabled={addMutation.isPending} className="gap-1.5">
            <Plus className="w-4 h-4" />
            추가
          </Button>
        </div>
      </div>

      {/* 규칙 목록 */}
      <div className="rounded-lg border bg-white dark:bg-gray-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Method</TableHead>
              <TableHead>Path Pattern</TableHead>
              <TableHead className="w-52">Authority</TableHead>
              <TableHead className="w-20 text-center">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">불러오는 중...</TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">등록된 규칙이 없습니다.</TableCell>
              </TableRow>
            ) : (
              sorted.map((rule) => (
                <TableRow key={`${rule.method}:${rule.pathPattern}`}>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${METHOD_COLORS[rule.method] ?? "bg-gray-100 text-gray-800"}`}>
                      {rule.method}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rule.pathPattern}</TableCell>
                  <TableCell>
                    <Badge
                      variant={permissionBadgeVariant(rule.role)}
                      className={`font-mono text-xs ${!ALL_PERMISSIONS.includes(rule.role) ? "border-dashed" : ""}`}
                    >
                      {rule.role}
                    </Badge>
                    {!ALL_PERMISSIONS.includes(rule.role) && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">커스텀</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-600"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate({ method: rule.method, pathPattern: rule.pathPattern })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
