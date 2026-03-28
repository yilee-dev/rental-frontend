"use client";

import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SoftwarePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">필수 소프트웨어</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm">소프트웨어 관리 기능은 준비 중입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
