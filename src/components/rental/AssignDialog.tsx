"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, ChevronRight, ChevronDown, Search, UserCheck, X, Users, Layers, MapPin,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { useAuthStore } from "@/store/authStore";
import { useDebounce } from "@/hooks/useDebounce";
import { RentalPc, UserProfile, DepartmentNode } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AssignDialogProps {
  rental: RentalPc | null;
  open: boolean;
  onClose: () => void;
}

type Tab = "search" | "dept" | "site";

// ─── 사업장 매핑 (백엔드 BUSINESS_SITE_NAMES 와 동일) ─────────────────────────
const BUSINESS_SITES: { code: string; name: string; companyCode: string; companyName: string }[] = [
  { code: "1100", name: "울산", companyCode: "1000", companyName: "동희산업" },
  { code: "1350", name: "수원", companyCode: "1000", companyName: "동희산업" },
  { code: "1500", name: "매곡", companyCode: "1000", companyName: "동희산업" },
  { code: "1800", name: "김천", companyCode: "1000", companyName: "동희산업" },
  { code: "2100", name: "아산", companyCode: "2000", companyName: "동희" },
  { code: "3100", name: "광주", companyCode: "3000", companyName: "동희하이테크" },
  { code: "4100", name: "양산", companyCode: "4000", companyName: "동희정공" },
  { code: "4400", name: "평택", companyCode: "4000", companyName: "동희정공" },
  { code: "4500", name: "아산", companyCode: "4000", companyName: "동희정공" },
  { code: "A200", name: "수원", companyCode: "A000", companyName: "동희홀딩스" },
];

// ─── 부서 트리 노드 ───────────────────────────────────────────────────────────
function DeptNode({
  node,
  selected,
  onSelect,
}: {
  node: DepartmentNode;
  selected: string | null;
  onSelect: (path: string, name: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.path;
  // 이 노드가 선택된 경로의 조상이거나 선택된 노드 자체이면 펼침
  const isAncestorOrSelf = !!selected && (selected === node.path || selected.startsWith(node.path + "/"));
  const [expanded, setExpanded] = useState(isAncestorOrSelf);
  const nodeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isAncestorOrSelf) setExpanded(true);
  }, [isAncestorOrSelf]);

  useEffect(() => {
    if (isSelected) nodeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isSelected]);

  return (
    <div>
      <button
        ref={nodeRef}
        onClick={() => {
          onSelect(node.path, node.name);
          if (hasChildren) setExpanded((v) => !v);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
          isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
        )}
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
        <span className="break-keep leading-snug">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div className="ml-4 border-l border-gray-200 dark:border-gray-700 pl-1">
          {node.children.map((child) => (
            <DeptNode key={child.path} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 사용자 카드 ──────────────────────────────────────────────────────────────
function UserCard({
  user,
  selected,
  onSelect,
}: {
  user: UserProfile;
  selected: boolean;
  onSelect: (u: UserProfile) => void;
}) {
  const initial = user.familyName ?? user.name.charAt(0);
  return (
    <button
      onClick={() => onSelect(user)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer",
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
    >
      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
        {initial}
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

// ─── 메인 다이얼로그 ──────────────────────────────────────────────────────────
export function AssignDialog({ rental, open, onClose }: AssignDialogProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [deptSelected, setDeptSelected] = useState<string | null>(null);
  const [deptSelectedName, setDeptSelectedName] = useState<string | null>(null);
  /** 개인 배정: 선택된 임직원 */
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  /** 부서 공용 배정: 선택된 부서 */
  const [selectedDept, setSelectedDept] = useState<{ path: string; displayName: string } | null>(null);
  /** 사업장 배정: 선택된 사업장 */
  const [selectedSite, setSelectedSite] = useState<typeof BUSINESS_SITES[number] | null>(null);
  /** 사업장 배정: 용도 */
  const [sitePurpose, setSitePurpose] = useState("");
  const [saving, setSaving] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 검색 탭 결과 — debounce 적용으로 타이핑 완료 후에만 호출
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: () => userApi.searchUsers(debouncedSearch || undefined, undefined, 50),
    enabled: tab === "search" && debouncedSearch.length >= 1,
    placeholderData: [],
    staleTime: 60 * 1000,
  });

  // 부서 트리 — staleTime 10분 (BFF 캐시와 동기)
  const { data: departments = [], isLoading: isDeptLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: userApi.getDepartments,
    enabled: tab === "dept",
    staleTime: 10 * 60 * 1000,
  });

  // 선택한 부서 사용자 목록 — staleTime 10분
  const { data: deptUsers = [], isFetching: isDeptUsersLoading } = useQuery({
    queryKey: ["users", "dept", deptSelected],
    queryFn: () => userApi.searchUsers(undefined, deptSelected!, 200),
    enabled: tab === "dept" && !!deptSelected,
    placeholderData: [],
    staleTime: 10 * 60 * 1000,
  });

  // 열릴 때 초기화 + 부서 트리 미리 로드
  useEffect(() => {
    if (!open) return;

    setSearch("");
    setSelectedUser(null);
    setSelectedDept(null);
    setSelectedSite(null);
    setSitePurpose("");
    setDeptSelectedName(null);

    const assignment = rental?.assignment;

    if (assignment?.assignmentType === "PERSONAL") {
      setTab("dept");
      // 저장된 값을 임시로 먼저 세팅 (구형 데이터는 짧은 이름일 수 있음)
      setDeptSelected(assignment.department ?? null);

      // empNo 또는 이름으로 사용자 조회 → UserProfile.department(전체 경로)로 트리 탐색
      const keyword = assignment.empNo ?? assignment.userName;
      if (keyword) {
        userApi.searchUsers(keyword, undefined, 10)
          .then((users) => {
            const matched = users.find(
              (u) => u.empNo === assignment.empNo || u.name === assignment.userName
            );
            if (matched?.department) {
              setDeptSelected(matched.department);
            }
          })
          .catch(() => { /* 조회 실패 시 임시 값 유지 */ });
      }
    } else {
      setTab("search");
      setDeptSelected(null);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    // 부서 탭 전환 시 바로 보이도록 미리 fetch
    queryClient.prefetchQuery({
      queryKey: ["departments"],
      queryFn: userApi.getDepartments,
      staleTime: 10 * 60 * 1000,
    });
  }, [open, queryClient, rental]);

  const userList = tab === "search" ? searchResults : deptUsers;

  function selectUser(user: UserProfile) {
    setSelectedUser(user);
    setSelectedDept(null);
    setSelectedSite(null);
  }

  function selectDeptForAssignment(path: string) {
    const displayName = deptSelectedName ?? path.split("/").at(-1) ?? path;
    setSelectedDept({ path, displayName });
    setSelectedUser(null);
    setSelectedSite(null);
  }

  function selectSite(site: typeof BUSINESS_SITES[number]) {
    setSelectedSite(site);
    setSelectedUser(null);
    setSelectedDept(null);
  }

  const canConfirm = !!selectedUser || !!selectedDept || (!!selectedSite && sitePurpose.trim().length > 0);

  async function handleAssign() {
    if (!rental || !canConfirm) return;
    setSaving(true);
    try {
      const assignedBy = currentUser
        ? (currentUser.familyName && currentUser.givenName
            ? `${currentUser.familyName}${currentUser.givenName}`
            : currentUser.name)
        : "시스템";

      if (selectedUser) {
        await rentalApi.assign(rental.id, {
          assignmentType: "PERSONAL",
          empNo: selectedUser.empNo ?? selectedUser.username,
          userName: selectedUser.name,
          // 전체 경로를 우선 저장해야 다이얼로그 재오픈 시 트리 탐색이 가능함
          department: selectedUser.department ?? selectedUser.departmentName ?? null,
          // 팀명만 별도 저장 — department 경로에 "/" 포함 시 파싱 오류 방지
          departmentName: selectedUser.departmentName ?? null,
          companyCode: selectedUser.companyCode ?? null,
          businessSiteCode: selectedUser.businessSiteCode ?? null,
          purpose: null,
          assignedBy,
        });
        const prevUserName =
          rental.assignment?.assignmentType === "PERSONAL"
            ? rental.assignment.userName
            : null;
        toast.success(
          prevUserName
            ? `${selectedUser.name}님으로 배정이 변경되었습니다.`
            : `${selectedUser.name}님에게 배정되었습니다.`,
          {
            description: prevUserName
              ? `기존 배정(${prevUserName})이 자동으로 해제되었습니다.`
              : "서약서 발송을 준비 중입니다. 잠시 후 서명 현황에서 확인해주세요.",
            duration: 5000,
          }
        );
      } else if (selectedDept) {
        await rentalApi.assign(rental.id, {
          assignmentType: "DEPARTMENT",
          empNo: null,
          userName: null,
          department: selectedDept.path,
          departmentName: selectedDept.displayName,
          companyCode: null,
          businessSiteCode: null,
          purpose: null,
          assignedBy,
        });
        toast.success(`${selectedDept.displayName} 부서에 공용 배정되었습니다.`);
      } else if (selectedSite) {
        await rentalApi.assign(rental.id, {
          assignmentType: "SITE",
          empNo: null,
          userName: null,
          department: null,
          departmentName: null,
          companyCode: selectedSite.companyCode,
          businessSiteCode: selectedSite.code,
          purpose: sitePurpose.trim(),
          assignedBy,
        });
        toast.success(`${selectedSite.companyName} ${selectedSite.name} 사업장에 배정되었습니다.`);
      }

      await queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["expiringPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch {
      toast.error("배정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!rental) return;
    setSaving(true);
    try {
      await rentalApi.removeAssignment(rental.id);
      toast.success("배정이 해제되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["rentalPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["searchPcs"] });
      await queryClient.invalidateQueries({ queryKey: ["expiringPcs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch {
      toast.error("해제 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!rental) return null;

  const hasExistingAssignment = !!rental.assignment;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-[900px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4 text-blue-600" />
            사용자 배정
            <span className="font-mono text-sm font-normal text-muted-foreground ml-1">
              {rental.rentalNo}
            </span>
          </DialogTitle>

          {/* 현재 배정 정보 */}
          {hasExistingAssignment && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm">
              {rental.assignment!.assignmentType === "SITE"
                ? <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                : rental.assignment!.assignmentType === "DEPARTMENT"
                ? <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                : <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              }
              <span className="text-amber-800 dark:text-amber-300 flex-1">
                현재 배정:&nbsp;
                {rental.assignment!.assignmentType === "SITE" ? (
                  <><strong>{BUSINESS_SITES.find(s => s.code === rental.assignment!.businessSiteCode)?.name ?? rental.assignment!.businessSiteCode}</strong>
                  <span className="text-xs ml-1 opacity-70">(사업장 · {rental.assignment!.purpose})</span></>
                ) : rental.assignment!.assignmentType === "DEPARTMENT" ? (
                  <><strong>{rental.assignment!.departmentName ?? rental.assignment!.department?.split("/").at(-1) ?? rental.assignment!.department}</strong><span className="text-xs ml-1 opacity-70">(부서 공용)</span></>
                ) : (
                  <><strong>{rental.assignment!.userName}</strong>
                  {rental.assignment!.empNo && ` (${rental.assignment!.empNo})`}
                  {(rental.assignment!.departmentName ?? rental.assignment!.department) && ` · ${rental.assignment!.departmentName ?? rental.assignment!.department?.split("/").at(-1) ?? rental.assignment!.department}`}</>
                )}
              </span>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="text-amber-700 hover:text-red-600 transition-colors cursor-pointer"
                title="배정 해제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </DialogHeader>

        {/* 탭 */}
        <div className="flex border-b shrink-0 px-5">
          {([["search", Search, "이름/사번 검색"], ["dept", Building2, "부서 탐색"], ["site", MapPin, "사업장 배정"]] as const).map(
            ([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors cursor-pointer",
                  tab === id
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            )
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 검색 탭 */}
          {tab === "search" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-4 py-3 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="이름, 사번, 이메일로 검색..."
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                {search.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    검색어를 입력하세요
                  </p>
                ) : isSearching ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))
                ) : userList.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    검색 결과가 없습니다
                  </p>
                ) : (
                  userList.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      selected={selectedUser?.id === u.id}
                      onSelect={selectUser}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* 부서 탐색 탭 */}
          {tab === "dept" && (
            <div className="flex flex-1 overflow-hidden">
              {/* 왼쪽: 부서 트리 */}
              <div className="w-72 border-r overflow-y-auto px-2 py-3 shrink-0">
                {isDeptLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full mb-1 rounded" />
                  ))
                ) : departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">부서 정보 없음</p>
                ) : (
                  departments.map((node) => (
                    <DeptNode
                      key={node.path}
                      node={node}
                      selected={deptSelected}
                      onSelect={(path, name) => { setDeptSelected(path); setDeptSelectedName(name); }}
                    />
                  ))
                )}
              </div>

              {/* 오른쪽: 부서 공용 배정 버튼 + 부서 사용자 */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {deptSelected && (
                  <div className="px-4 pt-3 pb-2 border-b shrink-0">
                    <button
                      onClick={() => selectDeptForAssignment(deptSelected)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                        selectedDept?.path === deptSelected
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:border-gray-600 dark:hover:border-blue-500"
                      )}
                    >
                      <Layers className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold">{deptSelected.split("/").at(-1)}</span>
                          <span className="text-xs font-normal opacity-70">부서 공용으로 배정</span>
                        </span>
                        <span className="block text-xs opacity-50 truncate mt-0.5">
                          {deptSelected}
                        </span>
                      </span>
                      {selectedDept?.path === deptSelected && (
                        <UserCheck className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {!deptSelected ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <Building2 className="w-8 h-8 opacity-30" />
                      <p className="text-sm">부서를 선택하세요</p>
                    </div>
                  ) : isDeptUsersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))
                  ) : deptUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <Users className="w-8 h-8 opacity-30" />
                      <p className="text-sm">해당 부서에 사용자가 없습니다</p>
                      <p className="text-xs text-muted-foreground">위 버튼으로 부서 공용 배정이 가능합니다</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground pb-1">
                        개인 배정 · {deptUsers.length}명
                      </p>
                      {deptUsers.map((u) => (
                        <UserCard
                          key={u.id}
                          user={u}
                          selected={selectedUser?.id === u.id}
                          onSelect={selectUser}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 사업장 배정 탭 */}
          {tab === "site" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="text-xs text-muted-foreground pb-2">사업장을 선택하세요</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_SITES.map((site) => (
                    <button
                      key={site.code}
                      onClick={() => selectSite(site)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors cursor-pointer",
                        selectedSite?.code === site.code
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        selectedSite?.code === site.code
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      )}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{site.name}</p>
                        <p className="text-xs text-muted-foreground">{site.companyName} · {site.code}</p>
                      </div>
                      {selectedSite?.code === site.code && (
                        <UserCheck className="w-4 h-4 text-blue-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>

                {selectedSite && (
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium">
                      용도 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={sitePurpose}
                      onChange={(e) => setSitePurpose(e.target.value)}
                      placeholder="예: 화상회의, 공용 업무, 방문자용 등"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 선택 정보 + 확인 */}
        <div className="border-t px-5 py-4 shrink-0 flex items-center gap-3 bg-gray-50 dark:bg-gray-900">
          <div className="flex-1 min-w-0">
            {selectedUser ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {selectedUser.familyName ?? selectedUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedUser.empNo && `${selectedUser.empNo} · `}
                    {selectedUser.departmentName ?? selectedUser.department ?? "부서 미지정"}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">개인 배정</Badge>
              </div>
            ) : selectedDept ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedDept.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedDept.path}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">부서 공용</Badge>
              </div>
            ) : selectedSite ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedSite.companyName} {selectedSite.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{sitePurpose || "용도를 입력하세요"}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">사업장</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">배정할 임직원, 부서 또는 사업장을 선택하세요</p>
            )}
          </div>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleAssign} disabled={!canConfirm || saving}>
            {saving ? "처리 중..." : "배정 확정"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
