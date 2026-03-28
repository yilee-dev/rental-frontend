import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">404 - 페이지를 찾을 수 없습니다</h2>
      <Link href="/" className="text-blue-500 underline hover:text-blue-700">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
