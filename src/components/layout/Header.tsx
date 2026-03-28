import { Monitor } from "lucide-react";

export function Header() {
  return (
    <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
      <div className="flex items-center gap-2 font-semibold text-lg">
        <Monitor className="w-5 h-5 text-blue-600" />
        렌탈 PC 관리
      </div>
    </header>
  );
}
