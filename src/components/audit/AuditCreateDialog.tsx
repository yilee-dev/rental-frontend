"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { auditApi } from "@/lib/audit-api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export function AuditCreateDialog() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [businessSiteCode, setBusinessSiteCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function buildName() {
    if (!currentUser) return "시스템";
    return (currentUser.familyName && currentUser.givenName)
      ? `${currentUser.familyName}${currentUser.givenName}`
      : currentUser.name;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await auditApi.create({
        title,
        businessSiteCode,
        startDate,
        endDate,
        createdBy: buildName(),
      });
      toast.success(`실사가 생성되었습니다. (${result.totalCount}대 등록)`);
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      setOpen(false);
      setTitle("");
      setBusinessSiteCode("");
      setStartDate("");
      setEndDate("");
    } catch {
      toast.error("실사 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        실사 등록
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>실사 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">실사 제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026년 상반기 울산 실사"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">사업장 코드</label>
            <Input
              value={businessSiteCode}
              onChange={(e) => setBusinessSiteCode(e.target.value)}
              placeholder="예: 1100"
              maxLength={4}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">시작일</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">종료일</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
