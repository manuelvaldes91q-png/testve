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
  pingUrl: string;
  downloadUrl: string;
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
  { id: "gold-data", name: "Gold Data", location: "Miami, US", color: "#f97316", ping: 0, pingUrl: "https://speed.cloudflare.com/__down?bytes=0", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000" },
  { id: "centurylink", name: "CenturyLink", location: "Miami, US", color: "#00d4ff", ping: 0, pingUrl: "https://1.1.1.1/cdn-cgi/trace", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000" },
  { id: "inter", name: "Inter", location: "Valencia, VE", color: "#8b5cf6", ping: 0, pingUrl: "https://www.google.com.ve/generate_204", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000" },
  { id: "netuno", name: "Netuno", location: "Caracas, VE", color: "#22c55e", ping: 0, pingUrl: "https://www.google.com/generate_204", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000" },
  { id: "ewinet", name: "EWINET", location: "Valencia, VE", color: "#00d4ff", ping: 0, pingUrl: "https://www.cloudflare.com/cdn-cgi/trace", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000" },
];

function imagePing(url: string, timeout: number): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      resolve(timeout);
    }, timeout);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve(performance.now() - start);
    };
    img.src = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  });
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
  const abortRef = useRef(false);

  const dest = DESTINATIONS.find((d) => d.id === selectedDest) ?? DESTINATIONS[0];

  const destroyChart = useCallback(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { destroyChart(); abortRef.current = true; };
  }, [destroyChart]);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d) => setIpInfo({ ip: d.ip, city: d.city || "", country: d.country_name || "", isp: d.org || "" }))
      .catch(() => {
        fetch("https://api.ipify.org?format=json")
          .then((r) => r.json())
          .then((d) => setIpInfo({ ip: d.ip, city: "", country: "", isp: "" }))
          .catch(() => setIpInfo({ ip: "Unknown", city: "", country: "", isp: "" }));
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    destroyChart();
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    dataRef.current = Array(100).fill(0);

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
        animation: { duration: 100 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, beginAtZero: true } },
      },
    });
  }, [phase, destroyChart]);

  const pushSpeed = useCallback((speed: number) => {
    dataRef.current = [...dataRef.current.slice(1), speed];
    if (chartInstance.current) {
      chartInstance.current.data.datasets[0].data = [...dataRef.current];
      chartInstance.current.update();
    }
    setCurrentSpeed(speed);
  }, []);

  useEffect(() => {
    const runAll = async () => {
      const nodes: ServerNode[] = DESTINATIONS.map((d) => ({ ...d, ping: 0 }));
      for (const s of DESTINATIONS) {
        const times: number[] = [];
        for (let i = 0; i < 3; i++) {
          const t = await imagePing(s.pingUrl, 5000);
          if (t < 5000) times.push(t);
        }
        const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0;
        nodes[nodes.findIndex((n) => n.id === s.id)].ping = avg;
        setLatencyNodes([...nodes]);
      }
    };
    runAll();
  }, []);

  const runPing = useCallback(async () => {
    const pings: number[] = [];
    for (let i = 0; i < 10; i++) {
      if (abortRef.current) break;
      const t = await imagePing(dest.pingUrl, 5000);
      pings.push(t < 5000 ? t : 5000);
      setLivePing(pings[pings.length - 1]);
      if (pings.length >= 2) setLiveJitter(Math.abs(pings[pings.length - 1] - pings[pings.length - 2]));
      await new Promise((r) => setTimeout(r, 200));
    }
    const valid = pings.filter((t) => t < 5000);
    return {
      ping: valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b) / valid.length) : 999,
      jitter: valid.length >= 2 ? Math.round(valid.slice(1).reduce((acc, t, i) => acc + Math.abs(t - valid[i]), 0) / (valid.length - 1)) : 0,
    };
  }, [dest]);

  const runDownload = useCallback(async (): Promise<number> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let totalBytes = 0;
      const xhr = new XMLHttpRequest();
      xhr.open("GET", dest.downloadUrl + "&r=" + Date.now(), true);
      xhr.responseType = "arraybuffer";
      xhr.onprogress = (e) => {
        totalBytes = e.loaded;
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > 0.5) {
          const mbps = (totalBytes * 8) / elapsed / 1_000_000;
          pushSpeed(mbps);
        }
      };
      xhr.onload = () => {
        totalBytes = xhr.response.byteLength;
        const elapsed = (performance.now() - startTime) / 1000;
        resolve(elapsed > 0 ? (totalBytes * 8) / elapsed / 1_000_000 : 0);
      };
      xhr.onerror = () => resolve(0);
      xhr.timeout = 15000;
      xhr.ontimeout = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        resolve(elapsed > 0 ? (totalBytes * 8) / elapsed / 1_000_000 : 0);
      };
      xhr.send();
    });
  }, [dest, pushSpeed]);

  const runUpload = useCallback(async (): Promise<number> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let totalBytes = 0;
      const chunkSize = 1024 * 1024;
      const chunks = 10;

      function sendChunk(index: number) {
        if (index >= chunks || abortRef.current) {
          const elapsed = (performance.now() - startTime) / 1000;
          resolve(elapsed > 0 ? (totalBytes * 8) / elapsed / 1_000_000 : 0);
          return;
        }
        const data = new Uint8Array(chunkSize);
        crypto.getRandomValues(data);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://httpbin.org/post", true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.onload = () => {
          totalBytes += chunkSize;
          const elapsed = (performance.now() - startTime) / 1000;
          if (elapsed > 0.3) pushSpeed((totalBytes * 8) / elapsed / 1_000_000);
          sendChunk(index + 1);
        };
        xhr.onerror = () => sendChunk(index + 1);
        xhr.timeout = 10000;
        xhr.ontimeout = () => sendChunk(index + 1);
        xhr.send(data);
      }
      sendChunk(0);
    });
  }, [pushSpeed]);

  const startTest = async () => {
    abortRef.current = false;
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = Array(100).fill(0);

    const pingResult = await runPing();

    setPhase("download");
    setCurrentSpeed(0);
    dataRef.current = Array(100).fill(0);
    const dl = await runDownload();

    setPhase("upload");
    setCurrentSpeed(0);
    dataRef.current = Array(100).fill(0);
    const ul = await runUpload();

    setResults({ ping: pingResult.ping, jitter: pingResult.jitter, download: Math.round(dl * 10) / 10, upload: Math.round(ul * 10) / 10, destination: dest.name });
    setPhase("complete");
  };

  const copyResults = () => {
    if (!results) return;
    const lat = latencyNodes.map((n) => `  ${n.name} (${n.location}): ${n.ping} ms`).join("\n");
    const ip = ipInfo ? `Your IP: ${ipInfo.ip}${ipInfo.city ? ` (${ipInfo.city}, ${ipInfo.country})` : ""}${ipInfo.isp ? ` - ${ipInfo.isp}` : ""}` : "";
    navigator.clipboard.writeText(`Speed Test Results\n${ip ? ip + "\n" : ""}Origin: EWINET, Valencia, Venezuela\nDestination: ${results.destination}\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nLatency: ${results.ping} ms\nJitter: ${results.jitter} ms\n\nAll Latencies:\n${lat}`);
  };

  const handleDestChange = (id: string) => {
    if (phase !== "idle" && phase !== "complete") return;
    abortRef.current = true;
    setSelectedDest(id);
    setResults(null);
    setPhase("idle");
    setCurrentSpeed(0);
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case "ping": return "Measuring latency...";
      case "download": return "Testing download...";
      case "upload": return "Testing upload...";
      case "complete": return "Test complete";
      default: return "";
    }
  };

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
                  selectedDest === d.id ? "border-2" : "bg-[#111] border border-neutral-800/50 text-neutral-400 hover:border-neutral-700"
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
