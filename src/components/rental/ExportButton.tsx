"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rentalApi } from "@/lib/rental-api";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function ExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await rentalApi.exportExcel();
      toast.success("엑셀 파일을 다운로드했습니다.");
    } catch {
      toast.error("내보내기에 실패했습니다. 서버 연결을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "내보내는 중..." : "엑셀 내보내기"}
    </Button>
  );
}
