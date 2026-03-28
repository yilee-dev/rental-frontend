"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { rentalApi } from "@/lib/rental-api";
import RentalPcTable from "./RentalPcTable";
import { RentalPc } from "@/types";

export default function RentalPcList() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["rentalPcs"],
      queryFn: ({ pageParam }) => rentalApi.getRentalPcs(pageParam as number | null, 20),
      initialPageParam: null as number | null,
      getNextPageParam: (lastPage) =>
        lastPage.hasNext ? lastPage.nextCursor : undefined,
    });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items: RentalPc[] = data?.pages.flatMap((p) => p.content) ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        등록된 렌탈 PC가 없습니다.
      </div>
    );
  }

  return (
    <div>
      <RentalPcTable items={items} />
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}
      {!hasNextPage && items.length > 0 && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          전체 {items.length}건
        </div>
      )}
    </div>
  );
}
