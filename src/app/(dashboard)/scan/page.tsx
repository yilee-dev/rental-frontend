"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auditApi } from "@/lib/audit-api";
import { rentalApi } from "@/lib/rental-api";
import { userApi } from "@/lib/user-api";
import { useAuthStore } from "@/store/authStore";
import { Audit, AuditItem, RentalPc, UserProfile } from "@/types";
import { P, useHasPermission } from "@/lib/permissions";
import { Camera, CheckCircle2, RefreshCw, AlertTriangle, Search, QrCode, UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ScanPage() {
  return (
    <Suspense>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const canVerify = useHasPermission(P.AUDIT_VERIFY);
  const canWrite = useHasPermission(P.RENTAL_WRITE);

  const initialNo = searchParams.get("no") ?? "";
  const hasInitialNo = !!initialNo;

  const [rentalNo, setRentalNo] = useState(initialNo);
  const [scanning, setScanning] = useState(false);
  const html5QrCodeRef = useRef<unknown>(null);

  // 실사 선택
  const { data: audits } = useQuery({
    queryKey: ["audits"],
    queryFn: auditApi.getAll,
  });
  const activeAudits = (audits ?? []).filter((a: Audit) => a.status === "IN_PROGRESS");
  const [selectedAuditId, setSelectedAuditId] = useState<string>(searchParams.get("auditId") ?? "");

  useEffect(() => {
    if (!selectedAuditId && activeAudits.length === 1) {
      setSelectedAuditId(String(activeAudits[0].id));
    }
  }, [activeAudits, selectedAuditId]);

  // 조회 결과
  const [pcInfo, setPcInfo] = useState<RentalPc | null>(null);
  const [auditItem, setAuditItem] = useState<AuditItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [looked, setLooked] = useState(false);

  // 배정 변경
  const [showReassign, setShowReassign] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  function buildName() {
    if (!currentUser) return "시스템";
    return (currentUser.familyName && currentUser.givenName)
      ? `${currentUser.familyName}${currentUser.givenName}`
      : currentUser.name;
  }

  const handleLookup = useCallback(async (no: string) => {
    if (!no.trim()) return;
    setLoading(true);
    setPcInfo(null);
    setAuditItem(null);
    setLooked(true);
    setShowReassign(false);
    setFoundUser(null);
    try {
      const results = await rentalApi.search({ rentalNo: no.trim() });
      if (results.length === 0) {
        toast.error("해당 렌탈번호를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      const pc = results.find(r => r.rentalNo === no.trim()) ?? results[0];
      setPcInfo(pc);

      if (selectedAuditId) {
        try {
          const item = await auditApi.getItemByRentalNo(Number(selectedAuditId), no.trim());
          setAuditItem(item);
        } catch {
          setAuditItem(null);
        }
      }
    } catch {
      toast.error("조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedAuditId]);

  useEffect(() => {
    if (initialNo) {
      handleLookup(initialNo);
    }
  }, [initialNo, handleLookup]);

  async function handleVerify(status: "VERIFIED" | "MISMATCH" | "MISSING") {
    if (!selectedAuditId || !pcInfo) return;
    try {
      const result = await auditApi.verify(Number(selectedAuditId), pcInfo.id, {
        status,
        verifiedBy: buildName(),
      });
      setAuditItem(result);
      const msg = status === "VERIFIED" ? "실사 확인 완료" : status === "MISMATCH" ? "재배치 등록 완료" : "미발견 등록 완료";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["auditItems", Number(selectedAuditId)] });
      queryClient.invalidateQueries({ queryKey: ["audit", Number(selectedAuditId)] });
    } catch {
      toast.error("처리에 실패했습니다.");
    }
  }

  async function handleSearchUser() {
    if (!nameInput.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchResults([]);
    try {
      const results = await userApi.searchUsers(nameInput.trim(), undefined, 10);
      if (results.length === 0) {
        toast.error("사용자를 찾을 수 없습니다.");
      } else if (results.length === 1) {
        setFoundUser(results[0]);
      } else {
        setSearchResults(results);
      }
    } catch {
      toast.error("사용자 검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  }

  async function handleReassign() {
    if (!pcInfo || !foundUser) return;
    setReassigning(true);
    try {
      await rentalApi.assign(pcInfo.id, {
        assignmentType: "PERSONAL",
        empNo: foundUser.empNo ?? foundUser.username,
        userName: foundUser.name,
        department: foundUser.department ?? null,
        departmentName: foundUser.departmentName ?? null,
        companyCode: foundUser.companyCode ?? null,
        businessSiteCode: foundUser.businessSiteCode ?? null,
        purpose: null,
        assignedBy: buildName(),
      });
      toast.success(`${foundUser.name}님으로 배정이 변경되었습니다.`);
      setShowReassign(false);
      setFoundUser(null);
      setNameInput("");
      setSearchResults([]);
      // PC 정보 새로고침
      handleLookup(pcInfo.rentalNo);
    } catch {
      toast.error("배정 변경에 실패했습니다.");
    } finally {
      setReassigning(false);
    }
  }

  async function toggleCamera() {
    if (scanning) {
      if (html5QrCodeRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (html5QrCodeRef.current as any).stop();
        } catch { /* ignore */ }
        html5QrCodeRef.current = null;
      }
      setScanning(false);
      return;
    }

    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const match = decodedText.match(/[?&]no=([^&]+)/);
          const no = match ? decodeURIComponent(match[1]) : decodedText;
          setRentalNo(no);
          handleLookup(no);
          scanner.stop().catch(() => {});
          html5QrCodeRef.current = null;
          setScanning(false);
        },
        () => {}
      );
    } catch {
      toast.error("카메라를 사용할 수 없습니다.");
      setScanning(false);
    }
  }

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (html5QrCodeRef.current as any).stop().catch(() => {});
      }
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleLookup(rentalNo);
  }

  const isAuditMode = !!selectedAuditId;

  return (
    <div className="max-w-lg mx-auto space-y-4 px-4 pb-8">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <QrCode className="w-6 h-6" />
        {hasInitialNo ? "자산 정보" : "QR 스캔"}
      </h1>

      {/* 실사 선택 */}
      {activeAudits.length > 0 && (
        <div className="space-y-1">
          <Select value={selectedAuditId} onValueChange={(v) => setSelectedAuditId(v ?? "")}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="진행 중인 실사 선택" /></SelectTrigger>
            <SelectContent>
              {activeAudits.map((a: Audit) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.title} ({a.businessSiteCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAuditId && (() => {
            const a = activeAudits.find((x: Audit) => String(x.id) === selectedAuditId);
            return a ? (
              <p className="text-xs text-blue-600 px-1">{a.title} · {a.startDate} ~ {a.endDate}</p>
            ) : null;
          })()}
        </div>
      )}

      {/* QR로 직접 접근하지 않은 경우에만 카메라 + 수동 입력 */}
      {!hasInitialNo && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div id="qr-reader" className={scanning ? "w-full" : "hidden"} />
            {!scanning && (
              <button onClick={toggleCamera} className="w-full flex flex-col items-center justify-center py-10 bg-gray-50 active:bg-gray-100">
                <Camera className="w-14 h-14 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">탭하여 QR 스캔</p>
              </button>
            )}
          </div>

          {scanning && (
            <Button onClick={toggleCamera} variant="destructive" className="w-full gap-2">
              <Camera className="w-4 h-4" /> 카메라 중지
            </Button>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={rentalNo}
              onChange={(e) => setRentalNo(e.target.value)}
              placeholder="렌탈번호 직접 입력"
              className="flex-1"
            />
            <Button type="submit" disabled={loading} size="sm" className="gap-1 px-4">
              <Search className="w-4 h-4" /> 조회
            </Button>
          </form>
        </>
      )}

      {loading && <div className="text-center py-8 text-gray-400">조회 중...</div>}

      {pcInfo && !loading && (
        <div className="space-y-3">
          {/* PC + 배정 정보 카드 */}
          <div className="rounded-xl border shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold">{pcInfo.rentalNo}</span>
              <Badge className="text-xs bg-gray-100 text-gray-600">
                {pcInfo.rentalType === "NOTEBOOK" ? "노트북" : "데스크탑"} · {pcInfo.rentalSpec === "NORMAL" ? "일반" : "설계"}
              </Badge>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="text-sm font-medium text-gray-400">배정 사용자</div>
            {pcInfo.assignment ? (
              <div className="space-y-1">
                <div className="text-xl font-bold">
                  {pcInfo.assignment.userName ?? pcInfo.assignment.department ?? "-"}
                </div>
                <div className="text-sm text-gray-500">
                  {pcInfo.assignment.empNo && <span>사번 {pcInfo.assignment.empNo}</span>}
                  {pcInfo.assignment.empNo && pcInfo.assignment.department && <span> · </span>}
                  {pcInfo.assignment.department && <span>{pcInfo.assignment.department}</span>}
                </div>
                <div className="text-xs text-gray-400">
                  사업장 {pcInfo.assignment.businessSiteCode ?? "-"} · {pcInfo.rentalStartDate} ~ {pcInfo.rentalEndDate}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 py-2">미배정</div>
            )}
          </div>

          {/* 실사 액션 버튼 (실사 진행 중일 때만) */}
          {isAuditMode && canVerify && auditItem && auditItem.status === "PENDING" && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleVerify("VERIFIED")}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 active:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">실사확인</span>
              </button>
              <button
                onClick={() => handleVerify("MISMATCH")}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 p-5 active:bg-red-100 transition-colors"
              >
                <RefreshCw className="w-10 h-10 text-red-600" />
                <span className="text-sm font-bold text-red-700">재배치</span>
              </button>
              <button
                onClick={() => handleVerify("MISSING")}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 active:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-10 h-10 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">미발견</span>
              </button>
            </div>
          )}

          {/* 실사 미선택 + 활성 실사 있음 */}
          {!isAuditMode && activeAudits.length > 0 && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-700">
              위에서 진행 중인 실사를 선택하면 실사 검증이 가능합니다.
            </div>
          )}

          {/* 이미 검증 완료 */}
          {isAuditMode && auditItem && auditItem.status !== "PENDING" && (
            <div className={`rounded-xl border-2 p-4 text-center space-y-2 ${
              auditItem.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50" :
              auditItem.status === "MISMATCH" ? "border-red-200 bg-red-50" :
              "border-amber-200 bg-amber-50"
            }`}>
              <div className="text-lg font-bold">
                {auditItem.status === "VERIFIED" ? "실사확인 완료" :
                 auditItem.status === "MISMATCH" ? "재배치 등록됨" : "미발견 등록됨"}
              </div>
              <div className="text-xs text-gray-500">
                {auditItem.verifiedBy} · {auditItem.verifiedAt?.replace("T", " ").slice(0, 16)}
              </div>
              <button
                onClick={async () => {
                  try {
                    const result = await auditApi.resetVerification(Number(selectedAuditId), pcInfo!.id);
                    setAuditItem(result);
                    toast.success("검증이 해제되었습니다.");
                    queryClient.invalidateQueries({ queryKey: ["auditItems", Number(selectedAuditId)] });
                    queryClient.invalidateQueries({ queryKey: ["audit", Number(selectedAuditId)] });
                  } catch { toast.error("해제에 실패했습니다."); }
                }}
                className="text-xs text-gray-400 underline active:text-gray-600"
              >
                검증 해제
              </button>
            </div>
          )}

          {/* 실사에 미등록 PC */}
          {isAuditMode && !auditItem && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              이 PC는 선택된 실사에 등록되어 있지 않습니다.
            </div>
          )}

          {/* 배정 변경 버튼 */}
          {canWrite && !showReassign && (
            <Button
              onClick={() => setShowReassign(true)}
              variant="outline"
              className="w-full gap-2"
            >
              <UserCog className="w-4 h-4" /> 배정 변경
            </Button>
          )}

          {/* 배정 변경 폼 */}
          {canWrite && showReassign && (
            <div className="rounded-xl border-2 border-blue-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700 flex items-center gap-1">
                  <UserCog className="w-4 h-4" /> 배정 변경
                </span>
                <button onClick={() => { setShowReassign(false); setFoundUser(null); setNameInput(""); setSearchResults([]); }} className="text-xs text-gray-400 hover:text-gray-600">
                  취소
                </button>
              </div>

              <div className="flex gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setFoundUser(null); setSearchResults([]); }}
                  placeholder="이름 입력"
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchUser(); } }}
                />
                <Button onClick={handleSearchUser} disabled={searching} size="sm" className="gap-1 px-4">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  검색
                </Button>
              </div>

              {searchResults.length > 0 && !foundUser && (
                <div className="rounded-lg border divide-y">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setFoundUser(u); setSearchResults([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="text-sm font-semibold">{u.name}</div>
                      <div className="text-xs text-gray-500">
                        {u.empNo && <span>사번 {u.empNo} · </span>}
                        {u.departmentName ?? u.department ?? "-"}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {foundUser && (
                <div className="rounded-lg bg-blue-50 p-3 space-y-2">
                  <div className="text-sm font-semibold">{foundUser.name}</div>
                  <div className="text-xs text-gray-500">
                    {foundUser.empNo && <span>사번 {foundUser.empNo} · </span>}
                    {foundUser.departmentName ?? foundUser.department ?? "-"}
                  </div>
                  <Button
                    onClick={handleReassign}
                    disabled={reassigning}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {reassigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                    {foundUser.name}님으로 배정 변경
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!pcInfo && !loading && looked && (
        <div className="text-center py-8 text-gray-400">해당 렌탈번호를 찾을 수 없습니다.</div>
      )}
    </div>
  );
}
