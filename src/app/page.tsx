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

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

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
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
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
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
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

function getLatencyColor(ms: number): string {
  if (ms < 30) return "#22c55e";
  if (ms < 80) return "#eab308";
  if (ms < 150) return "#f97316";
  return "#ef4444";
}

const DESTINATIONS: ServerNode[] = [
  { id: "gold-data", name: "Gold Data", location: "Miami, US", color: "#f97316", ping: 0 },
  { id: "centurylink", name: "CenturyLink", location: "Miami, US", color: "#00d4ff", ping: 0 },
  { id: "inter", name: "Inter", location: "Valencia, VE", color: "#8b5cf6", ping: 0 },
  { id: "netuno", name: "Netuno", location: "Caracas, VE", color: "#22c55e", ping: 0 },
  { id: "ewinet", name: "EWINET", location: "Valencia, VE", color: "#00d4ff", ping: 0 },
];

const PING_URLS: Record<string, string> = {
  "gold-data": "https://speed.cloudflare.com/__down?bytes=0",
  "centurylink": "https://1.1.1.1/cdn-cgi/trace",
  "inter": "https://www.google.com.ve/generate_204",
  "netuno": "https://www.google.com/generate_204",
  "ewinet": "",
};

function getPingUrl(id: string): string {
  if (id === "ewinet") {
    return `${window.location.protocol}//${window.location.host}/favicon.ico`;
  }
  return PING_URLS[id];
}

function imgPing(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const start = performance.now();
    const timer = setTimeout(() => {
      img.src = "";
      resolve(9999);
    }, 5000);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve(performance.now() - start);
    };
    img.src = url + "?_=" + Date.now();
  });
}

async function measurePing(url: string): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = await imgPing(url);
    if (t > 0 && t < 5000) times.push(t);
    await new Promise((r) => setTimeout(r, 150));
  }
  if (times.length === 0) return 999;
  return Math.round(Math.min(...times));
}

export default function Home() {
  const [selectedDest, setSelectedDest] = useState("gold-data");
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [liveJitter, setLiveJitter] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [latencyNodes, setLatencyNodes] = useState<ServerNode[]>(DESTINATIONS.map((d) => ({ ...d, ping: 0 })));
  const [ipInfo, setIpInfo] = useState<{ ip: string; city: string; country: string; isp: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [cliMode, setCliMode] = useState(false);
  const [cliLog, setCliLog] = useState<string[]>([]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dataRef = useRef<number[]>([]);

  const dest = DESTINATIONS.find((d) => d.id === selectedDest) ?? DESTINATIONS[0];

  const destroyChart = useCallback(() => {
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
  }, []);

  useEffect(() => { return () => destroyChart(); }, [destroyChart]);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d) => setIpInfo({ ip: d.ip, city: d.city || "", country: d.country_name || "", isp: d.org || "" }))
      .catch(() => setIpInfo({ ip: "N/A", city: "", country: "", isp: "" }));
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    destroyChart();
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    dataRef.current = Array(60).fill(0);
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: { labels: dataRef.current.map((_, i) => i.toString()), datasets: [{ data: dataRef.current, borderColor: phase === "upload" ? "#f97316" : "#00d4ff", backgroundColor: phase === "upload" ? "rgba(249,115,22,0.08)" : "rgba(0,212,255,0.08)", fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 100 }, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: 0, beginAtZero: true } } },
    });
  }, [phase, destroyChart]);

  const pushSpeed = useCallback((mbps: number) => {
    dataRef.current = [...dataRef.current.slice(1), mbps];
    if (chartInstance.current) { chartInstance.current.data.datasets[0].data = [...dataRef.current]; chartInstance.current.update(); }
    setCurrentSpeed(mbps);
  }, []);

  useEffect(() => {
    const run = async () => {
      for (const s of DESTINATIONS) {
        const url = getPingUrl(s.id);
        const ping = await measurePing(url);
        setLatencyNodes((prev) => prev.map((n) => (n.id === s.id ? { ...n, ping } : n)));
      }
    };
    run();
  }, []);

  const startTest = async () => {
    setRunning(true);
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = Array(60).fill(0);

    let avgPing = 0;
    let avgJitter = 0;
    let dlSpeed = 0;
    let ulSpeed = 0;

    try {
      // Ping
      const pings: number[] = [];
      const pingUrl = getPingUrl(dest.id);
      for (let i = 0; i < 5; i++) {
        const t = await imgPing(pingUrl);
        const ms = t < 5000 ? t : 5000;
        pings.push(ms);
        setLivePing(ms);
        if (pings.length >= 2) setLiveJitter(Math.abs(pings[pings.length - 1] - pings[pings.length - 2]));
        await new Promise((r) => setTimeout(r, 150));
      }
      const valid = pings.filter((t) => t < 5000);
      const minPing = valid.length > 0 ? Math.round(Math.min(...valid)) : 999;
      avgPing = minPing;
      avgJitter = valid.length >= 2 ? Math.round(valid.slice(1).reduce((acc, t, i) => acc + Math.abs(t - valid[i]), 0) / (valid.length - 1)) : 0;
    } catch { /* ping failed */ }

    try {
      // Download — 4 parallel connections like Speedtest
      setPhase("download");
      setCurrentSpeed(0);
      dataRef.current = Array(60).fill(0);

      const dlDuration = 10000;
      const startTime = performance.now();
      let totalLoaded = 0;
      let lastTime = startTime;
      let lastLoaded = 0;
      const speeds: number[] = [];
      const masterController = new AbortController();
      const masterTimer = setTimeout(() => masterController.abort(), dlDuration + 5000);

      const downloadWorker = async (threadId: number) => {
        const r = Date.now() + threadId;
        try {
          const res = await fetch(
            `https://speed.cloudflare.com/__down?bytes=100000000&r=${r}`,
            { signal: masterController.signal }
          );
          const reader = res.body?.getReader();
          if (!reader) return;
          while (true) {
            if (masterController.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;
            totalLoaded += value.length;
            const now = performance.now();
            const intervalSec = (now - lastTime) / 1000;
            if (intervalSec > 0.5) {
              const bytesInInterval = totalLoaded - lastLoaded;
              const instantSpeed = (bytesInInterval * 8) / intervalSec / 1_000_000;
              speeds.push(instantSpeed);
              pushSpeed(instantSpeed);
              lastLoaded = totalLoaded;
              lastTime = now;
            }
            if ((now - startTime) / 1000 > dlDuration / 1000) break;
          }
          reader.cancel();
        } catch { /* thread failed */ }
      };

      const workers = [0, 1, 2, 3].map((i) => downloadWorker(i));
      await Promise.all(workers);
      clearTimeout(masterTimer);

      const totalSec = (performance.now() - startTime) / 1000;
      if (speeds.length > 2) {
        speeds.sort((a, b) => b - a);
        const trimmed = speeds.slice(2, Math.ceil(speeds.length * 0.75));
        dlSpeed = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      } else {
        dlSpeed = totalSec > 0 ? (totalLoaded * 8) / totalSec / 1_000_000 : 0;
      }
    } catch { /* download failed, dlSpeed stays 0 */ }

    try {
      // Upload — 4 parallel connections like Speedtest
      setPhase("upload");
      setCurrentSpeed(0);
      dataRef.current = Array(60).fill(0);

      const ulDuration = 10000;
      const startTime = performance.now();
      const sharedSent = { value: 0 };
      const chunkSize = 256 * 1024;

      const uploadWorker = async () => {
        while (true) {
          const elapsed = performance.now() - startTime;
          if (elapsed > ulDuration) break;
          const data = new Uint8Array(chunkSize);
          crypto.getRandomValues(data);
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            await fetch("https://speed.cloudflare.com/__up", {
              method: "POST",
              body: data,
              signal: ctrl.signal,
            });
            clearTimeout(t);
            sharedSent.value += chunkSize;
          } catch { /* chunk failed, try next */ }
        }
      };

      let lastSnapshot = 0;
      let lastSnapshotTime = performance.now();
      const speeds: number[] = [];
      const tickInterval = setInterval(() => {
        const now = performance.now();
        const sec = (now - lastSnapshotTime) / 1000;
        if (sec >= 0.5) {
          const bytes = sharedSent.value - lastSnapshot;
          if (bytes > 0) {
            const mbps = (bytes * 8) / sec / 1_000_000;
            speeds.push(mbps);
            pushSpeed(mbps);
          }
          lastSnapshot = sharedSent.value;
          lastSnapshotTime = now;
        }
      }, 500);

      await Promise.all([0, 1, 2, 3].map(() => uploadWorker()));
      clearInterval(tickInterval);

      const totalSec = (performance.now() - startTime) / 1000;
      if (speeds.length > 2) {
        speeds.sort((a, b) => b - a);
        const trimmed = speeds.slice(2, Math.ceil(speeds.length * 0.75));
        ulSpeed = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      } else {
        ulSpeed = totalSec > 0 ? (sharedSent.value * 8) / totalSec / 1_000_000 : 0;
      }
    } catch { /* upload failed, ulSpeed stays 0 */ }

    setResults({
      ping: avgPing,
      jitter: avgJitter,
      download: Math.round(dlSpeed * 10) / 10,
      upload: Math.round(ulSpeed * 10) / 10,
      destination: dest.name,
    });
    setPhase("complete");
    setRunning(false);
  };

  const copyResults = () => {
    if (!results) return;
    const lat = latencyNodes.map((n) => `  ${n.name} (${n.location}): ${n.ping} ms`).join("\n");
    const ip = ipInfo ? `Your IP: ${ipInfo.ip}${ipInfo.city ? ` (${ipInfo.city}, ${ipInfo.country})` : ""}${ipInfo.isp ? ` - ${ipInfo.isp}` : ""}` : "";
    navigator.clipboard.writeText(`Speed Test Results\n${ip ? ip + "\n" : ""}Destination: ${results.destination}\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nLatency: ${results.ping} ms\nJitter: ${results.jitter} ms\n\nAll Latencies:\n${lat}`);
  };

  const handleDest = (id: string) => {
    if (running) return;
    setSelectedDest(id);
    setResults(null);
    setPhase("idle");
    setCurrentSpeed(0);
  };

  const cliLogAdd = (msg: string) => setCliLog((prev) => [...prev, msg]);

  const runCliTest = async () => {
    setRunning(true);
    setCliLog([`> Testing to ${dest.name} (${dest.location})`, `> IP: ${ipInfo?.ip || "..."}`, ""]);

    cliLogAdd("[1/3] Ping...");
    const pings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = await imgPing(getPingUrl(dest.id));
      pings.push(t < 5000 ? t : 5000);
      cliLogAdd(`  ${i + 1}/5: ${Math.round(pings[pings.length - 1])} ms`);
    }
    const valid = pings.filter((t) => t < 5000);
    const minPing = valid.length > 0 ? Math.round(Math.min(...valid)) : 999;
    const avgJitter = valid.length >= 2 ? Math.round(valid.slice(1).reduce((acc, t, i) => acc + Math.abs(t - valid[i]), 0) / (valid.length - 1)) : 0;
    cliLogAdd(`  Min: ${minPing} ms | Jitter: ${avgJitter} ms\n`);

    cliLogAdd("[2/3] Download (4 threads)...");
    let dlSpeed = 0;
    try {
      const dlDuration = 8000;
      const start = performance.now();
      let totalLoaded = 0;
      const masterController = new AbortController();
      const masterTimer = setTimeout(() => masterController.abort(), dlDuration + 3000);

      const downloadWorker = async (threadId: number) => {
        const r = Date.now() + threadId;
        try {
          const res = await fetch(
            `https://speed.cloudflare.com/__down?bytes=100000000&r=${r}`,
            { signal: masterController.signal }
          );
          const reader = res.body?.getReader();
          if (!reader) return;
          while (true) {
            if (masterController.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;
            totalLoaded += value.length;
            if ((performance.now() - start) / 1000 > dlDuration / 1000) break;
          }
          reader.cancel();
        } catch { /* thread failed */ }
      };

      await Promise.all([0, 1, 2, 3].map((i) => downloadWorker(i)));
      clearTimeout(masterTimer);
      const sec = (performance.now() - start) / 1000;
      dlSpeed = sec > 0 ? (totalLoaded * 8) / sec / 1_000_000 : 0;
    } catch { /* */ }
    cliLogAdd(`  ${Math.round(dlSpeed * 10) / 10} Mbps\n`);

    cliLogAdd("[3/3] Upload (4 threads)...");
    let ulSpeed = 0;
    try {
      const ulDuration = 8000;
      const start = performance.now();
      const sharedSent = { value: 0 };
      const chunkSize = 256 * 1024;

      const uploadWorker = async () => {
        while (true) {
          const elapsed = performance.now() - start;
          if (elapsed > ulDuration) break;
          const data = new Uint8Array(chunkSize);
          crypto.getRandomValues(data);
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            await fetch("https://speed.cloudflare.com/__up", {
              method: "POST",
              body: data,
              signal: ctrl.signal,
            });
            clearTimeout(t);
            sharedSent.value += chunkSize;
          } catch { /* chunk failed */ }
        }
      };

      await Promise.all([0, 1, 2, 3].map(() => uploadWorker()));
      const sec = (performance.now() - start) / 1000;
      ulSpeed = sec > 0 ? (sharedSent.value * 8) / sec / 1_000_000 : 0;
    } catch { /* */ }
    cliLogAdd(`  ${Math.round(ulSpeed * 10) / 10} Mbps\n`);

    cliLogAdd("");
    cliLogAdd("=== Results ===");
    cliLogAdd(`Ping: ${minPing} ms  |  Jitter: ${avgJitter} ms`);
    cliLogAdd(`Download: ${Math.round(dlSpeed * 10) / 10} Mbps`);
    cliLogAdd(`Upload: ${Math.round(ulSpeed * 10) / 10} Mbps`);

    setResults({
      ping: minPing,
      jitter: avgJitter,
      download: Math.round(dlSpeed * 10) / 10,
      upload: Math.round(ulSpeed * 10) / 10,
      destination: dest.name,
    });
    setRunning(false);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4 selection:bg-cyan-500/30 relative">
      {/* CLI Toggle Button */}
      <button
        onClick={() => setCliMode(!cliMode)}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-lg bg-[#111] border border-neutral-800 text-neutral-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center text-xs font-mono z-50"
        title="Toggle CLI mode"
      >
        {cliMode ? "GUI" : "CLI"}
      </button>

      {cliMode ? (
        /* CLI Mode */
        <div className="w-full max-w-2xl mx-auto space-y-4 font-mono text-sm">
          <div className="text-neutral-600 text-xs">EWINET Speed Test &middot; CLI Mode</div>
          <div className="text-neutral-500 text-xs">{ipInfo?.ip || "..."} &middot; {ipInfo?.city}, {ipInfo?.country}</div>

          <div className="flex gap-2 flex-wrap">
            {DESTINATIONS.map((d) => (
              <button key={d.id} onClick={() => handleDest(d.id)}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-all ${selectedDest === d.id ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-[#111] text-neutral-500 border border-neutral-800 hover:text-neutral-300"}`}>
                {d.name}
              </button>
            ))}
          </div>

          <div className="bg-black rounded-lg border border-neutral-800 p-4 h-80 overflow-y-auto">
            {cliLog.length === 0 ? (
              <div className="text-neutral-600 text-xs">Click Run to start test to {dest.name}</div>
            ) : (
              cliLog.map((line, i) => (
                <div key={i} className={`text-xs ${line.startsWith("===") ? "text-cyan-400 font-bold mt-1" : line.startsWith("[") ? "text-neutral-300" : line.startsWith("  ") ? "text-neutral-500" : "text-neutral-400"}`}>
                  {line || "\u00A0"}
                </div>
              ))
            )}
            {running && <div className="text-cyan-400 text-xs animate-pulse mt-1">_</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={runCliTest} disabled={running}
              className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-medium border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {running ? "Running..." : "Run"}
            </button>
            <button onClick={() => setCliLog([])}
              className="px-4 py-2 rounded-lg bg-[#111] text-neutral-500 text-xs border border-neutral-800 hover:text-neutral-300 transition-colors cursor-pointer">
              Clear
            </button>
            {results && (
              <button onClick={copyResults}
                className="px-4 py-2 rounded-lg bg-[#111] text-neutral-500 text-xs border border-neutral-800 hover:text-neutral-300 transition-colors cursor-pointer">
                Copy
              </button>
            )}
          </div>
        </div>
      ) : (
        /* GUI Mode - existing UI */
        <div className="w-full max-w-xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs font-medium tracking-[0.3em] uppercase mb-2">
            <span className="text-cyan-400"><ArrowDownIcon size={16} /></span>
            <span className="text-orange-400"><ArrowUpIcon size={16} /></span>
            SPEED TEST
          </div>
        </div>

        {/* GO Button - Top */}
        {phase === "idle" ? (
          <div className="flex flex-col items-center gap-4">
            <button onClick={startTest} disabled={running}
              className="w-36 h-36 rounded-full bg-[#111] border border-neutral-800 text-white text-lg font-medium transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(0,212,255,0.15)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              GO
            </button>
            <h1 className="text-sm text-neutral-600">EWINET &rarr; {dest.name} ({dest.location})</h1>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className="text-sm font-medium tracking-widest uppercase text-neutral-500">
              {phase === "ping" && "Measuring latency..."}
              {phase === "download" && "Testing download..."}
              {phase === "upload" && "Testing upload..."}
              {phase === "complete" && "Test complete"}
            </div>

            <div className="relative w-full max-w-md aspect-video rounded-2xl bg-[#111] border border-neutral-800/50 overflow-hidden">
              <div className="absolute inset-0 p-2"><canvas ref={chartRef} /></div>
              {phase !== "complete" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl font-bold tracking-tight tabular-nums">
                      {phase === "ping" ? (
                        <span className="text-neutral-300">{livePing.toFixed(0)}<span className="text-2xl text-neutral-600 ml-1">ms</span></span>
                      ) : (
                        <span className={phase === "upload" ? "text-orange-400" : "text-cyan-400"}>{currentSpeed.toFixed(1)}<span className="text-2xl text-neutral-600 ml-1">Mbps</span></span>
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
                  <div className="text-xl font-semibold tabular-nums">{phase === "ping" ? livePing.toFixed(0) : results ? results.ping : "--"}<span className="text-sm text-neutral-600 ml-1">ms</span></div>
                </div>
                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider"><ActivityIcon />Jitter</div>
                  <div className="text-xl font-semibold tabular-nums">{phase === "ping" ? liveJitter.toFixed(0) : results ? results.jitter : "--"}<span className="text-sm text-neutral-600 ml-1">ms</span></div>
                </div>
                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                    {phase === "upload" ? <span className="text-orange-400"><ArrowUpIcon size={18} /></span> : <span className="text-cyan-400"><ArrowDownIcon size={18} /></span>}
                    {phase === "upload" ? "Upload" : "Download"}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">{currentSpeed > 0 ? currentSpeed.toFixed(1) : "--"}<span className="text-sm text-neutral-600 ml-1">Mbps</span></div>
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

        {/* IP Info */}
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

        {/* Destinations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-wider">
            <ServerIcon /><span>Destinations</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DESTINATIONS.map((d) => (
              <button key={d.id} onClick={() => handleDest(d.id)}
                className={`flex flex-col items-center px-3 py-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${selectedDest === d.id ? "border-2" : "bg-[#111] border border-neutral-800/50 text-neutral-400 hover:border-neutral-700"}`}
                style={selectedDest === d.id ? { backgroundColor: `${d.color}10`, borderColor: `${d.color}40`, color: d.color } : {}}>
                <span className="font-semibold">{d.name}</span>
                <span className="text-[9px] opacity-60 mt-0.5">{d.location}</span>
                {selectedDest === d.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>

        {/* Latency Grid */}
        <div className="grid grid-cols-5 gap-2">
          {latencyNodes.map((node) => (
            <button key={node.id} onClick={() => handleDest(node.id)}
              className={`bg-[#111] border rounded-lg p-3 text-center transition-all cursor-pointer ${selectedDest === node.id ? "border-neutral-600" : "border-neutral-800/50 hover:border-neutral-700"}`}>
              <div className="text-[10px] text-neutral-600 truncate">{node.name}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: getLatencyColor(node.ping) }}>{node.ping > 0 ? node.ping : "--"}</div>
              <div className="text-[9px] text-neutral-700">ms</div>
            </button>
          ))}
        </div>

        <div className="text-center text-neutral-700 text-xs pb-4 space-y-1">
          <div className="flex items-center justify-center gap-1">
            <GlobeIcon /><span>From your PC ({ipInfo?.ip || "..."}) to {dest.name}</span>
          </div>
          <div className="text-neutral-600">Powered by <span className="text-cyan-400">EWINET</span> &middot; Valencia, Venezuela</div>
        </div>
        </div>
      )}
    </main>
  );
}
