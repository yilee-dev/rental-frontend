import { fetchApi } from "@/lib/http-client";

export interface PortInfo {
  port: number;
  packetCount: number;
  uniqueSources: number;
  topSources: string[];
}

export interface PeerConnection {
  peerIp: string;
  ports: number[];
  packetCount: number;
}

export interface ServerTrafficAnalysis {
  targetIp: string;
  inboundPorts: PortInfo[];
  outboundConnections: PeerConnection[];
  fromCache: boolean;
}

export const networkTrafficApi = {
  getServerAnalysis: (ip: string): Promise<ServerTrafficAnalysis> =>
    fetchApi(`/api/bff/network-traffic/server-analysis?ip=${encodeURIComponent(ip)}`),

  invalidateCache: (ip?: string): Promise<boolean> =>
    fetchApi(
      `/api/bff/network-traffic/cache${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`,
      { method: "DELETE" },
    ),
};
