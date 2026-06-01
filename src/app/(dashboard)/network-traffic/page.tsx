"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Info, Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  networkTrafficApi, PortInfo, PeerConnection, ServerTrafficAnalysis,
} from "@/lib/network-traffic-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "inbound" | "outbound" | "graph" | "inbound-port-graph" | "outbound-port-graph";
type InboundSortKey = keyof Pick<PortInfo, "port" | "packetCount" | "uniqueSources">;
type SortDir = "asc" | "desc";

export default function NetworkTrafficPage() {
  const [ipInput, setIpInput] = useState("");
  const [submittedIp, setSubmittedIp] = useState("");
  const [tab, setTab] = useState<Tab>("inbound");
  const [inboundSort, setInboundSort] = useState<InboundSortKey>("packetCount");
  const [inboundSortDir, setInboundSortDir] = useState<SortDir>("desc");

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["serverTraffic", submittedIp],
    queryFn: () => networkTrafficApi.getServerAnalysis(submittedIp),
    enabled: !!submittedIp,
    staleTime: Infinity,
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ipInput.trim();
    if (!trimmed) return;
    setSubmittedIp(trimmed);
    setTab("inbound");
  }

  async function handleInvalidateCache() {
    try {
      await networkTrafficApi.invalidateCache(submittedIp || undefined);
      toast.success("캐시가 삭제되었습니다.");
      if (submittedIp) refetch();
    } catch {
      toast.error("캐시 삭제에 실패했습니다.");
    }
  }

  const sortedInbound = useMemo(() => {
    if (!data) return [];
    return [...data.inboundPorts].sort((a, b) => {
      const aVal = a[inboundSort] as number;
      const bVal = b[inboundSort] as number;
      return inboundSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [data, inboundSort, inboundSortDir]);

  function toggleInboundSort(key: InboundSortKey) {
    if (inboundSort === key) setInboundSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setInboundSort(key); setInboundSortDir("desc"); }
  }

  function SortIcon({ k }: { k: InboundSortKey }) {
    if (inboundSort !== k) return <ChevronDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
    return inboundSortDir === "asc"
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            네트워크 트래픽 분석
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">수집 기간: 2026-03-01 ~ 2026-03-06</p>
        </div>
        <div className="flex items-center gap-2">
          {submittedIp && (
            <Button variant="outline" size="sm" onClick={handleInvalidateCache}
              disabled={isFetching} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              캐시 갱신
            </Button>
          )}
        </div>
      </div>

      {/* IP 검색 */}
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="서버 IP 입력 (예: 10.1.2.3)"
            className="pl-8 text-sm h-9 font-mono"
          />
        </div>
        <Button type="submit" size="sm" className="h-9 px-4" disabled={!ipInput.trim() || isFetching}>
          분석
        </Button>
      </form>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {submittedIp} 트래픽 분석 중...
            </p>
            <p className="text-xs text-gray-400 mt-1">최초 조회는 수십 초 소요될 수 있습니다</p>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <p className="text-sm text-red-500">조회에 실패했습니다. OpenSearch 상태를 확인해 주세요.</p>
          <Button onClick={() => refetch()} variant="outline" size="sm">재시도</Button>
        </div>
      )}

      {/* 결과 */}
      {data && !isLoading && (
        <>
          {/* 결과 요약 */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
              {data.targetIp}
            </span>
            <span>인바운드 포트 {data.inboundPorts.length}개</span>
            <span>아웃바운드 연결 {data.outboundConnections.length}개</span>
            {data.fromCache && (
              <span className="text-emerald-500 font-medium">캐시됨</span>
            )}
          </div>

          {/* 탭 */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
            {([
              ["inbound", "인바운드 포트"],
              ["outbound", "아웃바운드 연결"],
              ["graph", "연결 그래프"],
              ["inbound-port-graph", "인바운드 포트 그래프"],
              ["outbound-port-graph", "아웃바운드 포트 그래프"],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  tab === t
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}>
                {label}
              </button>
            ))}
          </div>

          {/* 인바운드 포트 테이블 */}
          {tab === "inbound" && (
            <div className="flex flex-col gap-2 flex-1">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50">
                      <Th onClick={() => toggleInboundSort("port")}>
                        포트 <SortIcon k="port" />
                      </Th>
                      <Th onClick={() => toggleInboundSort("packetCount")}>
                        패킷 수 <SortIcon k="packetCount" />
                      </Th>
                      <Th onClick={() => toggleInboundSort("uniqueSources")}>
                        유니크 소스 수 <SortIcon k="uniqueSources" />
                      </Th>
                      <Th>주요 소스 IP</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInbound.map((row) => (
                      <tr key={row.port}
                        className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {row.port}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {row.packetCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {row.uniqueSources.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {row.topSources.slice(0, 5).map((src) => (
                              <button key={src}
                                onClick={() => { setIpInput(src); setSubmittedIp(src); setTab("inbound"); }}
                                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors cursor-pointer">
                                {src}
                              </button>
                            ))}
                            {row.topSources.length > 5 && (
                              <span className="text-[11px] text-gray-400">
                                +{row.topSources.length - 5}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sortedInbound.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                          인바운드 트래픽 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 아웃바운드 연결 테이블 */}
          {tab === "outbound" && (
            <div className="flex flex-col gap-2 flex-1">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50">
                      <Th>대상 서버 IP</Th>
                      <Th>포트 목록</Th>
                      <Th>패킷 수</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outboundConnections.map((conn) => (
                      <tr key={conn.peerIp}
                        className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => { setIpInput(conn.peerIp); setSubmittedIp(conn.peerIp); setTab("inbound"); }}
                            className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                            {conn.peerIp}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {conn.ports.map((p) => (
                              <span key={p}
                                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {conn.packetCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {data.outboundConnections.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                          아웃바운드 연결 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 연결 그래프 */}
          {tab === "graph" && (
            <EgoGraph
              data={data}
              onNodeClick={(ip) => { setIpInput(ip); setSubmittedIp(ip); setTab("inbound"); }}
            />
          )}

          {/* 인바운드 포트 그래프 */}
          {tab === "inbound-port-graph" && (
            <PortGraph
              targetIp={data.targetIp}
              portNodes={data.inboundPorts.map(p => ({
                id: `port-${p.port}`,
                label: String(p.port),
                value: p.packetCount,
                tooltip: `포트 ${p.port} · 패킷 ${p.packetCount.toLocaleString()} · 소스 ${p.uniqueSources}개`,
              }))}
              edgeDirection="to-target"
              color="#f97316"
              borderColor="#fed7aa"
            />
          )}

          {/* 아웃바운드 포트 그래프 */}
          {tab === "outbound-port-graph" && (
            <PortGraph
              targetIp={data.targetIp}
              portNodes={(() => {
                const stats = new Map<number, number>();
                data.outboundConnections.forEach(conn =>
                  conn.ports.forEach(p => stats.set(p, (stats.get(p) ?? 0) + 1))
                );
                return Array.from(stats.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([port, peerCount]) => ({
                    id: `port-${port}`,
                    label: String(port),
                    value: peerCount,
                    tooltip: `포트 ${port} · ${peerCount}개 서버로 연결`,
                  }));
              })()}
              edgeDirection="from-target"
              color="#22c55e"
              borderColor="#bbf7d0"
            />
          )}
        </>
      )}

      {/* 초기 상태 */}
      {!submittedIp && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-sm">분석할 서버 IP를 입력하세요</p>
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th onClick={onClick}
      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
      {children}
    </th>
  );
}

// ── Ego Graph ───────────────────────────────────────────────────────────────

function EgoGraph({
  data,
  onNodeClick,
}: {
  data: ServerTrafficAnalysis;
  onNodeClick: (ip: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<{
    source: string; target: string; ports: number[]; count: number;
  } | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodeSet = new Set<string>();
    nodeSet.add(data.targetIp);

    // 인바운드: topSources → targetIp
    const inboundMap = new Map<string, { ports: Set<number>; count: number }>();
    data.inboundPorts.forEach((portInfo) => {
      portInfo.topSources.forEach((srcIp) => {
        nodeSet.add(srcIp);
        const key = `${srcIp}|||${data.targetIp}`;
        const existing = inboundMap.get(key);
        if (existing) {
          existing.ports.add(portInfo.port);
          existing.count += portInfo.packetCount;
        } else {
          inboundMap.set(key, { ports: new Set([portInfo.port]), count: portInfo.packetCount });
        }
      });
    });

    // 아웃바운드: targetIp → peerIp
    data.outboundConnections.forEach((conn) => {
      nodeSet.add(conn.peerIp);
    });

    const inboundIps = new Set(
      data.inboundPorts.flatMap((p) => p.topSources)
    );
    const outboundIps = new Set(data.outboundConnections.map((c) => c.peerIp));

    const nodeList = Array.from(nodeSet).map((id) => {
      let role = "both";
      if (id === data.targetIp) role = "target";
      else if (inboundIps.has(id) && outboundIps.has(id)) role = "both";
      else if (inboundIps.has(id)) role = "inbound";
      else role = "outbound";
      return { data: { id, role } };
    });

    const edgeList: any[] = [];

    inboundMap.forEach((val, key) => {
      const [src, dst] = key.split("|||");
      edgeList.push({
        data: {
          id: key,
          source: src,
          target: dst,
          ports: Array.from(val.ports).sort((a, b) => a - b),
          count: val.count,
          type: "inbound",
        },
      });
    });

    data.outboundConnections.forEach((conn) => {
      edgeList.push({
        data: {
          id: `${data.targetIp}|||${conn.peerIp}`,
          source: data.targetIp,
          target: conn.peerIp,
          ports: conn.ports,
          count: conn.packetCount,
          type: "outbound",
        },
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, [data]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    import("cytoscape").then(({ default: Cytoscape }) => {
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

      // 동심원 3개 preset 위치 계산
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const positions: Record<string, { x: number; y: number }> = {};

      const inboundIds = nodes.filter(n => n.data.role === "inbound").map(n => n.data.id);
      const outboundIds = nodes.filter(n => n.data.role === "outbound").map(n => n.data.id);
      const bothIds = nodes.filter(n => n.data.role === "both").map(n => n.data.id);

      positions[data.targetIp] = { x: 0, y: 0 };

      const placeOnRing = (ids: string[], radius: number) => {
        ids.forEach((id, i) => {
          const angle = toRad(-90 + (360 / Math.max(ids.length, 1)) * i);
          positions[id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        });
      };

      placeOnRing(bothIds, 140);     // 1원: 양방향
      placeOnRing(outboundIds, 260); // 2원: 아웃바운드
      placeOnRing(inboundIds, 380);  // 3원: 인바운드

      const cy = Cytoscape({
        container: containerRef.current,
        elements: { nodes, edges },
        style: [
          {
            selector: 'node[role = "target"]',
            style: {
              "background-color": "#2563eb",
              "label": "data(id)",
              "color": "#1e40af",
              "font-size": "11px",
              "font-weight": "bold",
              "text-valign": "bottom",
              "text-margin-y": 5,
              "width": 40,
              "height": 40,
              "border-width": 3,
              "border-color": "#93c5fd",
            } as any,
          },
          {
            selector: 'node[role = "inbound"]',
            style: {
              "background-color": "#f97316",
              "label": "data(id)",
              "color": "#9a3412",
              "font-size": "10px",
              "text-valign": "bottom",
              "text-margin-y": 4,
              "width": 28,
              "height": 28,
              "border-width": 2,
              "border-color": "#fed7aa",
            } as any,
          },
          {
            selector: 'node[role = "outbound"]',
            style: {
              "background-color": "#22c55e",
              "label": "data(id)",
              "color": "#166534",
              "font-size": "10px",
              "text-valign": "bottom",
              "text-margin-y": 4,
              "width": 28,
              "height": 28,
              "border-width": 2,
              "border-color": "#bbf7d0",
            } as any,
          },
          {
            selector: 'node[role = "both"]',
            style: {
              "background-color": "#a855f7",
              "label": "data(id)",
              "color": "#6b21a8",
              "font-size": "10px",
              "text-valign": "bottom",
              "text-margin-y": 4,
              "width": 32,
              "height": 32,
              "border-width": 2,
              "border-color": "#e9d5ff",
            } as any,
          },
          {
            selector: 'edge[type = "inbound"]',
            style: {
              "width": 2,
              "line-color": "#fb923c",
              "target-arrow-color": "#fb923c",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "opacity": 0.7,
            } as any,
          },
          {
            selector: 'edge[type = "outbound"]',
            style: {
              "width": 2,
              "line-color": "#4ade80",
              "target-arrow-color": "#4ade80",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "opacity": 0.7,
            } as any,
          },
          {
            selector: "edge:selected, edge.highlighted",
            style: {
              "opacity": 1,
              "width": 3,
              "line-color": "#facc15",
              "target-arrow-color": "#facc15",
            } as any,
          },
        ],
        layout: {
          name: "preset",
          positions: (node: any) => positions[node.id()] ?? { x: 0, y: 0 },
          animate: false,
          fit: true,
          padding: 50,
        } as any,
      });

      cy.on("tap", "edge", (evt: any) => {
        const d = evt.target.data();
        setSelectedEdge({ source: d.source, target: d.target, ports: d.ports, count: d.count });
        cy.edges().removeClass("highlighted");
        evt.target.addClass("highlighted");
      });

      cy.on("tap", "node", (evt: any) => {
        const id = evt.target.data("id");
        if (id !== data.targetIp) onNodeClick(id);
      });

      cy.on("tap", (evt: any) => {
        if (evt.target === cy) {
          setSelectedEdge(null);
          cy.edges().removeClass("highlighted");
        }
      });

      cyRef.current = cy;
    });

    return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  return (
    <div className="flex flex-col flex-1 gap-2 min-h-0">
      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
          분석 대상
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
          인바운드 소스
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          아웃바운드 대상
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
          양방향
        </span>
        <span className="ml-auto flex items-center gap-1 text-gray-400">
          <Info className="w-3.5 h-3.5" />
          노드 클릭 시 해당 IP 분석
        </span>
      </div>

      <div className="flex flex-1 gap-3 min-h-0">
        <div
          ref={containerRef}
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-[500px]"
        />

        {selectedEdge && (
          <div className="w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">연결 상세</span>
              <button onClick={() => setSelectedEdge(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Source</p>
                <p className="font-mono font-medium text-gray-800 dark:text-gray-200">{selectedEdge.source}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Destination</p>
                <p className="font-mono font-medium text-gray-800 dark:text-gray-200">{selectedEdge.target}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">패킷 수</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{selectedEdge.count.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">포트 ({selectedEdge.ports.length}개)</p>
              <div className="flex flex-wrap gap-1">
                {selectedEdge.ports.map((p) => (
                  <span key={p}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Port Graph ───────────────────────────────────────────────────────────────

interface PortNode {
  id: string;
  label: string;
  value: number;
  tooltip: string;
}

function PortGraph({
  targetIp,
  portNodes,
  edgeDirection,
  color,
  borderColor,
}: {
  targetIp: string;
  portNodes: PortNode[];
  edgeDirection: "to-target" | "from-target";
  color: string;
  borderColor: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [selected, setSelected] = useState<PortNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const maxVal = Math.max(...portNodes.map(p => p.value), 1);
    const nodeList = [
      { data: { id: targetIp, label: targetIp, role: "target", size: 44 } },
      ...portNodes.map(p => ({
        data: {
          id: p.id,
          label: p.label,
          role: "port",
          value: p.value,
          tooltip: p.tooltip,
          size: Math.max(22, Math.round((Math.log(p.value + 1) / Math.log(maxVal + 1)) * 48) + 20),
        },
      })),
    ];
    const edgeList = portNodes.map(p => ({
      data: {
        id: `e-${p.id}`,
        source: edgeDirection === "to-target" ? p.id : targetIp,
        target: edgeDirection === "to-target" ? targetIp : p.id,
        weight: Math.max(1, Math.round((Math.log(p.value + 1) / Math.log(maxVal + 1)) * 4) + 1),
      },
    }));
    return { nodes: nodeList, edges: edgeList };
  }, [portNodes, targetIp, edgeDirection]);

  useEffect(() => {
    if (!containerRef.current || portNodes.length === 0) return;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const positions: Record<string, { x: number; y: number }> = {};
    positions[targetIp] = { x: 0, y: 0 };

    const R = Math.max(200, (portNodes.length * 32) / (2 * Math.PI));
    portNodes.forEach((p, i) => {
      const angle = toRad(-90 + (360 / portNodes.length) * i);
      positions[p.id] = { x: R * Math.cos(angle), y: R * Math.sin(angle) };
    });

    import("cytoscape").then(({ default: Cytoscape }) => {
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

      const cy = Cytoscape({
        container: containerRef.current,
        elements: { nodes, edges },
        style: [
          {
            selector: '[role = "target"]',
            style: {
              "background-color": "#2563eb",
              "label": "data(label)",
              "color": "#1e40af",
              "font-size": "10px",
              "font-weight": "bold",
              "text-valign": "bottom",
              "text-margin-y": 5,
              "width": 44,
              "height": 44,
              "border-width": 3,
              "border-color": "#93c5fd",
            } as any,
          },
          {
            selector: '[role = "port"]',
            style: {
              "background-color": color,
              "label": "data(label)",
              "color": "#374151",
              "font-size": "9px",
              "font-weight": "600",
              "text-valign": "center",
              "text-halign": "center",
              "width": "data(size)",
              "height": "data(size)",
              "border-width": 1.5,
              "border-color": borderColor,
            } as any,
          },
          {
            selector: '[role = "port"]:selected',
            style: {
              "border-width": 3,
              "border-color": "#facc15",
            } as any,
          },
          {
            selector: "edge",
            style: {
              "width": "data(weight)",
              "line-color": color,
              "target-arrow-color": color,
              "target-arrow-shape": "triangle",
              "curve-style": "straight",
              "opacity": 0.5,
            } as any,
          },
          {
            selector: "edge:selected",
            style: { "opacity": 1, "line-color": "#facc15", "target-arrow-color": "#facc15" } as any,
          },
        ],
        layout: {
          name: "preset",
          positions: (node: any) => positions[node.id()] ?? { x: 0, y: 0 },
          animate: false,
          fit: true,
          padding: 50,
        } as any,
      });

      cy.on("tap", '[role = "port"]', (evt: any) => {
        const id = evt.target.data("id");
        const found = portNodes.find(p => p.id === id) ?? null;
        setSelected(found);
      });
      cy.on("tap", (evt: any) => {
        if (evt.target === cy) setSelected(null);
      });

      cyRef.current = cy;
    });

    return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  return (
    <div className="flex flex-1 gap-3 min-h-0">
      <div
        ref={containerRef}
        className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-[500px]"
      />
      {selected && (
        <div className="w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">포트 상세</span>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-100">
            :{selected.label}
          </p>
          <p className="text-xs text-gray-500">{selected.tooltip}</p>
        </div>
      )}
    </div>
  );
}
