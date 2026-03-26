"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler
);

interface TestResults {
  ping: number;
  jitter: number;
  download: number;
  upload: number;
  destination: string;
}

interface ServerNode {
  id: string;
  name: string;
  location: string;
  ping: number;
  color: string;
  testUrl: string;
}

type TestPhase = "idle" | "ping" | "download" | "upload" | "complete";

function ArrowDownIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

function ArrowUpIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function getLatencyColor(ping: number): string {
  if (ping < 10) return "#22c55e";
  if (ping < 30) return "#eab308";
  if (ping < 60) return "#f97316";
  return "#ef4444";
}

const DESTINATIONS: ServerNode[] = [
  { id: "gold-data", name: "Gold Data", location: "Miami, US", color: "#f97316", testUrl: "https://speed.cloudflare.com/__down?bytes=25000000", ping: 0 },
  { id: "centurylink", name: "CenturyLink", location: "Miami, US", color: "#00d4ff", testUrl: "https://www.google.com.ve/generate_204", ping: 0 },
  { id: "inter", name: "Inter", location: "Valencia, VE", color: "#8b5cf6", testUrl: "https://www.inter.com.ve", ping: 0 },
  { id: "netuno", name: "Netuno", location: "Caracas, VE", color: "#22c55e", testUrl: "https://www.netuno.com.ve", ping: 0 },
  { id: "ewinet", name: "EWINET", location: "Valencia, VE", color: "#00d4ff", testUrl: "https://www.ewinet.com.ve", ping: 0 },
];

function abortableFetch(url: string, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeout ?? 10000);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function measureDownload(url: string, durationMs: number, onSpeed: (mbps: number) => void): Promise<number> {
  const startTime = performance.now();
  let totalBytes = 0;

  async function downloadChunk() {
    try {
      const res = await abortableFetch(url + (url.includes("?") ? "&" : "?") + `r=${Math.random()}`, {
        cache: "no-store",
        timeout: durationMs + 5000,
      });
      const reader = res.body?.getReader();
      if (!reader) {
        const blob = await res.blob();
        totalBytes += blob.size;
        return;
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > 0) onSpeed((totalBytes * 8) / elapsed / 1_000_000);
      }
    } catch {
      // ignore
    }
  }

  const promises: Promise<void>[] = [];
  while (performance.now() - startTime < durationMs) {
    promises.push(downloadChunk());
    await new Promise((r) => setTimeout(r, 200));
  }
  await Promise.allSettled(promises);

  const elapsed = (performance.now() - startTime) / 1000;
  return elapsed > 0 ? (totalBytes * 8) / elapsed / 1_000_000 : 0;
}

async function measureUpload(durationMs: number, onSpeed: (mbps: number) => void): Promise<number> {
  const startTime = performance.now();
  let totalBytes = 0;
  const chunkSize = 512 * 1024;

  async function uploadChunk() {
    try {
      const data = new Uint8Array(chunkSize);
      crypto.getRandomValues(data);
      const blob = new Blob([data]);
      await abortableFetch("https://httpbin.org/post", {
        method: "POST",
        body: blob,
        timeout: durationMs + 5000,
      });
      totalBytes += chunkSize;
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 0) onSpeed((totalBytes * 8) / elapsed / 1_000_000);
    } catch {
      // ignore
    }
  }

  const promises: Promise<void>[] = [];
  while (performance.now() - startTime < durationMs) {
    promises.push(uploadChunk());
    await new Promise((r) => setTimeout(r, 150));
  }
  await Promise.allSettled(promises);

  const elapsed = (performance.now() - startTime) / 1000;
  return elapsed > 0 ? (totalBytes * 8) / elapsed / 1_000_000 : 0;
}

export default function Home() {
  const [selectedDest, setSelectedDest] = useState<string>("gold-data");
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [liveJitter, setLiveJitter] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [latencyNodes, setLatencyNodes] = useState<ServerNode[]>(
    DESTINATIONS.map((d) => ({ ...d, ping: 0 }))
  );
  const [ipInfo, setIpInfo] = useState<{ ip: string; city: string; country: string; isp: string } | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dataRef = useRef<number[]>([]);
  const speedRef = useRef(0);

  const dest = DESTINATIONS.find((d) => d.id === selectedDest) ?? DESTINATIONS[0];

  const destroyChart = useCallback(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  }, []);

  useEffect(() => {
    return () => destroyChart();
  }, [destroyChart]);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        setIpInfo({ ip: data.ip, city: data.city || "", country: data.country_name || "", isp: data.org || "" });
      } catch {
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const data = await res.json();
          setIpInfo({ ip: data.ip, city: "", country: "", isp: "" });
        } catch {
          setIpInfo({ ip: "Unknown", city: "", country: "", isp: "" });
        }
      }
    };
    fetchIp();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    destroyChart();
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    if (dataRef.current.length === 0) dataRef.current = Array(120).fill(0);

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: dataRef.current.map((_, i) => i.toString()),
        datasets: [
          {
            data: dataRef.current,
            borderColor: phase === "upload" ? "#f97316" : "#00d4ff",
            backgroundColor: phase === "upload" ? "rgba(249, 115, 22, 0.08)" : "rgba(0, 212, 255, 0.08)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 150 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, beginAtZero: true } },
      },
    });
  }, [phase, destroyChart]);

  const updateChart = useCallback((speed: number) => {
    dataRef.current = [...dataRef.current.slice(1), speed];
    if (chartInstance.current) {
      chartInstance.current.data.datasets[0].data = dataRef.current;
      chartInstance.current.update();
    }
  }, []);

  const measureRealPing = useCallback(async () => {
    setLivePing(0);
    setLiveJitter(0);
    const pings: number[] = [];
    const samples = 15;

    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      try {
        await abortableFetch(dest.testUrl + (dest.testUrl.includes("?") ? "&" : "?") + `r=${Math.random()}`, {
          mode: "no-cors",
          cache: "no-store",
          timeout: 5000,
        });
        const elapsed = performance.now() - start;
        pings.push(elapsed);
        setLivePing(elapsed);
      } catch {
        pings.push(5000);
        setLivePing(5000);
      }
      if (pings.length >= 2) {
        const j = Math.abs(pings[pings.length - 1] - pings[pings.length - 2]);
        setLiveJitter(j);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const valid = pings.filter((t) => t < 5000);
    const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 999;
    const jitters = valid.slice(1).map((t, i) => Math.abs(t - valid[i]));
    const avgJitter = jitters.length > 0 ? Math.round(jitters.reduce((a, b) => a + b, 0) / jitters.length) : 0;
    return { ping: avg, jitter: avgJitter };
  }, [dest]);

  const startTest = async () => {
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = Array(120).fill(0);
    speedRef.current = 0;

    const pingResult = await measureRealPing();

    setPhase("download");
    setCurrentSpeed(0);
    dataRef.current = Array(120).fill(0);

    const downloadSpeed = await measureDownload(dest.testUrl, 10000, (mbps) => {
      speedRef.current = mbps;
      setCurrentSpeed(mbps);
      updateChart(mbps);
    });

    setPhase("upload");
    setCurrentSpeed(0);
    dataRef.current = Array(120).fill(0);

    const uploadSpeed = await measureUpload(8000, (mbps) => {
      speedRef.current = mbps;
      setCurrentSpeed(mbps);
      updateChart(mbps);
    });

    setResults({
      ping: pingResult.ping,
      jitter: pingResult.jitter,
      download: Math.round(downloadSpeed * 10) / 10,
      upload: Math.round(uploadSpeed * 10) / 10,
      destination: dest.name,
    });
    setPhase("complete");
  };

  const copyResults = () => {
    if (results) {
      const latencyText = latencyNodes.map((n) => `  ${n.name} (${n.location}): ${n.ping} ms`).join("\n");
      const ipText = ipInfo ? `Your IP: ${ipInfo.ip}${ipInfo.city ? ` (${ipInfo.city}, ${ipInfo.country})` : ""}${ipInfo.isp ? ` - ${ipInfo.isp}` : ""}` : "";
      const text = `Speed Test Results\n${ipText ? ipText + "\n" : ""}Origin: EWINET, Valencia, Venezuela\nDestination: ${results.destination}\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nLatency: ${results.ping} ms\nJitter: ${results.jitter} ms\n\nAll Latencies:\n${latencyText}`;
      navigator.clipboard.writeText(text);
    }
  };

  const handleDestChange = (id: string) => {
    if (phase !== "idle" && phase !== "complete") return;
    setSelectedDest(id);
    setResults(null);
    setPhase("idle");
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = [];
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case "ping": return "Measuring real latency...";
      case "download": return "Testing download (10s)...";
      case "upload": return "Testing upload (8s)...";
      case "complete": return "Test complete";
      default: return "";
    }
  };

  useEffect(() => {
    const runLatencies = async () => {
      setLatencyNodes(DESTINATIONS.map((s) => ({ ...s, ping: 0 })));
      for (const s of DESTINATIONS) {
        const start = performance.now();
        try {
          await abortableFetch(s.testUrl + (s.testUrl.includes("?") ? "&" : "?") + `r=${Math.random()}`, {
            mode: "no-cors",
            cache: "no-store",
            timeout: 5000,
          });
          const elapsed = Math.round(performance.now() - start);
          setLatencyNodes((prev) => prev.map((n) => (n.id === s.id ? { ...n, ping: elapsed } : n)));
        } catch {
          setLatencyNodes((prev) => prev.map((n) => (n.id === s.id ? { ...n, ping: 999 } : n)));
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    };
    runLatencies();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4 selection:bg-cyan-500/30">
      <div className="w-full max-w-xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs font-medium tracking-[0.3em] uppercase mb-2">
            <span className="text-cyan-400"><ArrowDownIcon size={16} /></span>
            <span className="text-orange-400"><ArrowUpIcon size={16} /></span>
            SPEED TEST
          </div>
          <h1 className="text-sm text-neutral-600">EWINET &rarr; {dest.name} ({dest.location})</h1>
        </div>

        {ipInfo && (
          <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GlobeIcon />
              <div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider">Your IP</div>
                <div className="text-sm font-semibold text-neutral-200 tabular-nums">{ipInfo.ip}</div>
              </div>
            </div>
            <div className="text-right">
              {ipInfo.city && <div className="text-xs text-neutral-400">{ipInfo.city}, {ipInfo.country}</div>}
              {ipInfo.isp && <div className="text-[10px] text-neutral-600">{ipInfo.isp}</div>}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-wider">
            <ServerIcon />
            <span>Destinations</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => handleDestChange(d.id)}
                className={`flex flex-col items-center px-3 py-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDest === d.id
                    ? "border-2"
                    : "bg-[#111] border border-neutral-800/50 text-neutral-400 hover:border-neutral-700"
                }`}
                style={selectedDest === d.id ? { backgroundColor: `${d.color}10`, borderColor: `${d.color}40`, color: d.color } : {}}
              >
                <span className="font-semibold">{d.name}</span>
                <span className="text-[9px] opacity-60 mt-0.5">{d.location}</span>
                {selectedDest === d.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {latencyNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleDestChange(node.id)}
              className={`bg-[#111] border rounded-lg p-3 text-center transition-all cursor-pointer ${
                selectedDest === node.id ? "border-neutral-600" : "border-neutral-800/50 hover:border-neutral-700"
              }`}
            >
              <div className="text-[10px] text-neutral-600 truncate">{node.name}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: getLatencyColor(node.ping) }}>
                {node.ping > 0 ? node.ping : "--"}
              </div>
              <div className="text-[9px] text-neutral-700">ms</div>
            </button>
          ))}
        </div>

        <div className="border-t border-neutral-800/50 pt-8">
          {phase === "idle" ? (
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={startTest}
                className="w-40 h-40 rounded-full bg-[#111] border border-neutral-800 text-white text-lg font-medium transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(0,212,255,0.15)] cursor-pointer"
              >
                GO
              </button>
              <p className="text-neutral-600 text-sm">Test to {dest.name} ({dest.location})</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5">
              <div className="text-sm font-medium tracking-widest uppercase text-neutral-500">{getPhaseLabel()}</div>

              <div className="relative w-full max-w-md aspect-video rounded-2xl bg-[#111] border border-neutral-800/50 overflow-hidden">
                <div className="absolute inset-0 p-2"><canvas ref={chartRef} /></div>
                {phase !== "complete" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl font-bold tracking-tight tabular-nums">
                        {phase === "ping" ? (
                          <span className="text-neutral-300">
                            {livePing.toFixed(0)}
                            <span className="text-2xl text-neutral-600 ml-1">ms</span>
                          </span>
                        ) : (
                          <span className={phase === "upload" ? "text-orange-400" : "text-cyan-400"}>
                            {currentSpeed.toFixed(1)}
                            <span className="text-2xl text-neutral-600 ml-1">Mbps</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-600 mt-1">&rarr; {dest.name}</div>
                    </div>
                  </div>
                )}
              </div>

              {phase !== "complete" && (
                <div className="w-full max-w-md grid grid-cols-3 gap-3">
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider"><ZapIcon />Latency</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {phase === "ping" ? livePing.toFixed(0) : results ? results.ping : "--"}
                      <span className="text-sm text-neutral-600 ml-1">ms</span>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider"><ActivityIcon />Jitter</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {phase === "ping" ? liveJitter.toFixed(0) : results ? results.jitter : "--"}
                      <span className="text-sm text-neutral-600 ml-1">ms</span>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                      {phase === "upload" ? <span className="text-orange-400"><ArrowUpIcon size={18} /></span> : <span className="text-cyan-400"><ArrowDownIcon size={18} /></span>}
                      {phase === "upload" ? "Upload" : "Download"}
                    </div>
                    <div className="text-xl font-semibold tabular-nums">
                      {phase === "download" || phase === "upload" ? currentSpeed.toFixed(1) : "--"}
                      <span className="text-sm text-neutral-600 ml-1">Mbps</span>
                    </div>
                  </div>
                </div>
              )}

              {phase === "complete" && results && (
                <div className="w-full max-w-md space-y-3">
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-6">
                    <div className="flex items-center gap-2 text-neutral-600 text-xs mb-3 uppercase tracking-wider"><span className="text-cyan-400"><ArrowDownIcon size={16} /></span>Download</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-cyan-400 tabular-nums">{results.download}</span>
                      <span className="text-lg text-neutral-500">Mbps</span>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-6">
                    <div className="flex items-center gap-2 text-neutral-600 text-xs mb-3 uppercase tracking-wider"><span className="text-orange-400"><ArrowUpIcon size={16} /></span>Upload</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-orange-400 tabular-nums">{results.upload}</span>
                      <span className="text-lg text-neutral-500">Mbps</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-5">
                      <div className="flex items-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider"><ZapIcon />Latency</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-neutral-200 tabular-nums">{results.ping}</span>
                        <span className="text-sm text-neutral-600">ms</span>
                      </div>
                    </div>
                    <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-5">
                      <div className="flex items-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider"><ActivityIcon />Jitter</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-neutral-200 tabular-nums">{results.jitter}</span>
                        <span className="text-sm text-neutral-600">ms</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={startTest} className="flex-1 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm font-medium border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer">Run Again</button>
                    <button onClick={copyResults} className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-neutral-400 text-sm font-medium border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer">Copy Results</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center text-neutral-700 text-xs pb-4 space-y-1">
          <div className="flex items-center justify-center gap-1">
            <GlobeIcon />
            <span>From {ipInfo?.city || "your location"} to {dest.name} ({dest.location})</span>
          </div>
          <div className="text-neutral-600">
            Powered by <span className="text-cyan-400">EWINET</span> &middot; Valencia, Venezuela
          </div>
        </div>
      </div>
    </main>
  );
}
