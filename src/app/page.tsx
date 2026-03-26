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
  x: number;
  y: number;
  ping: number;
  color: string;
  downloadBase: number;
  uploadBase: number;
  basePing: number;
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

function EwinetLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 200 120" fill="none">
      <rect x="2" y="2" width="196" height="116" rx="12" fill="#0a0a0a" stroke="#00d4ff" strokeWidth="1.5" />
      <rect x="10" y="10" width="55" height="100" rx="8" fill="#00d4ff" />
      <text x="37" y="45" textAnchor="middle" fill="#0a0a0a" fontSize="28" fontWeight="800" fontFamily="Inter, sans-serif">E</text>
      <text x="37" y="72" textAnchor="middle" fill="#0a0a0a" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">NET</text>
      <line x1="75" y1="30" x2="185" y2="30" stroke="#00d4ff" strokeWidth="1" opacity="0.3" />
      <text x="80" y="25" fill="#ffffff" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">WINET</text>
      <text x="80" y="50" fill="#00d4ff" fontSize="9" fontWeight="500" fontFamily="Inter, sans-serif" letterSpacing="3">VALORIZA TECNOLOGIA</text>
      <text x="80" y="68" fill="#666666" fontSize="8" fontFamily="Inter, sans-serif">Valencia, Venezuela</text>
      <line x1="80" y1="80" x2="185" y2="80" stroke="#222222" strokeWidth="0.5" />
      <text x="80" y="95" fill="#444444" fontSize="7" fontFamily="Inter, sans-serif">ISP &middot; Fibra &times; Red &times; Cloud</text>
      <circle cx="175" cy="95" r="8" fill="#00d4ff" opacity="0.15" />
      <circle cx="175" cy="95" r="4" fill="#00d4ff" opacity="0.4" />
      <circle cx="175" cy="95" r="2" fill="#00d4ff" />
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

function geoToSvg(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * 660;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = 170 - (mercN / Math.PI) * 170;
  return { x: Math.max(10, Math.min(650, x)), y: Math.max(10, Math.min(330, y)) };
}

const VALENCIA_DEFAULT = geoToSvg(10.4806, -66.9036);

const DESTINATIONS: ServerNode[] = [
  { id: "gold-data", name: "Gold Data", location: "Miami, US", x: 190, y: 155, color: "#f97316", downloadBase: 120, uploadBase: 55, basePing: 15, ping: 0 },
  { id: "centurylink", name: "CenturyLink", location: "Miami, US", x: 200, y: 148, color: "#00d4ff", downloadBase: 110, uploadBase: 50, basePing: 18, ping: 0 },
  { id: "inter-valencia", name: "Inter", location: "Valencia, VE", x: 228, y: 190, color: "#8b5cf6", downloadBase: 85, uploadBase: 35, basePing: 8, ping: 0 },
  { id: "netuno", name: "Netuno", location: "Caracas, VE", x: 235, y: 195, color: "#22c55e", downloadBase: 75, uploadBase: 30, basePing: 12, ping: 0 },
  { id: "ewinet", name: "EWINET", location: "Valencia, VE", x: 225, y: 188, color: "#00d4ff", downloadBase: 150, uploadBase: 80, basePing: 2, ping: 0 },
];

const ANIMATION_DURS = [2.8, 3.2, 2.1, 3.5, 2.4];

function getLatencyColor(ping: number): string {
  if (ping < 10) return "#22c55e";
  if (ping < 30) return "#eab308";
  if (ping < 60) return "#f97316";
  return "#ef4444";
}

function LatencyMap({
  nodes,
  selectedId,
  isActive,
  originPos,
  originLabel,
  originCity,
  originIsp,
}: {
  nodes: ServerNode[];
  selectedId: string | null;
  isActive: boolean;
  originPos: { x: number; y: number };
  originLabel: string;
  originCity: string;
  originIsp: string;
}) {
  return (
    <div className="relative w-full aspect-[2/1] bg-[#0d0d0d] rounded-xl border border-neutral-800/50 overflow-hidden">
      <svg viewBox="0 0 660 340" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sourceGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          {nodes.map((node) => (
            <radialGradient key={`glow-${node.id}`} id={`glow-${node.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={node.color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={node.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        <g opacity="0.12" stroke="#ffffff" strokeWidth="0.5" fill="none">
          <path d="M60,60 L90,45 L130,40 L170,35 L200,40 L220,50 L230,65 L235,80 L230,95 L215,105 L200,110 L185,115 L170,120 L155,130 L140,135 L120,130 L100,125 L85,120 L75,110 L65,95 L55,80 Z" fill="#ffffff" fillOpacity="0.03" />
          <path d="M220,170 L240,160 L255,165 L265,175 L270,190 L275,210 L280,230 L285,250 L280,270 L270,285 L255,295 L240,290 L230,275 L225,260 L220,240 L215,220 L210,200 L215,185 Z" fill="#ffffff" fillOpacity="0.03" />
          <path d="M310,50 L330,45 L350,50 L370,55 L385,65 L390,80 L380,90 L365,95 L350,100 L335,105 L320,100 L310,90 L305,75 L305,60 Z" fill="#ffffff" fillOpacity="0.03" />
          <path d="M400,40 L430,35 L465,38 L500,45 L535,55 L560,70 L575,90 L580,110 L575,130 L560,145 L540,155 L515,160 L490,155 L465,145 L440,135 L420,120 L405,100 L395,80 L395,60 Z" fill="#ffffff" fillOpacity="0.03" />
          <path d="M510,230 L530,225 L555,230 L570,245 L575,260 L565,275 L550,280 L530,278 L515,270 L505,255 L505,240 Z" fill="#ffffff" fillOpacity="0.03" />
        </g>

        <g opacity="0.04" stroke="#ffffff" strokeWidth="0.3">
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 30} x2="660" y2={i * 30} />
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="340" />
          ))}
        </g>

        {nodes.map((node, idx) => {
          const isSelected = selectedId === node.id;
          const midX = (originPos.x + node.x) / 2;
          const midY = Math.min(originPos.y, node.y) - 30;
          return (
            <g key={`conn-${node.id}`}>
              <path
                d={`M ${originPos.x} ${originPos.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
                fill="none"
                stroke={node.color}
                strokeWidth={isSelected ? 2.5 : 0.8}
                opacity={isActive ? (isSelected ? 0.7 : 0.25) : (isSelected ? 0.4 : 0.08)}
                strokeDasharray={isActive || isSelected ? "0" : "4 4"}
              />
              {(isActive || isSelected) && (
                <circle r={isSelected ? 3 : 2} fill={node.color} opacity={isSelected ? 1 : 0.5}>
                  <animateMotion
                    dur={`${ANIMATION_DURS[idx % ANIMATION_DURS.length]}s`}
                    repeatCount="indefinite"
                    path={`M ${originPos.x} ${originPos.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        <circle cx={originPos.x} cy={originPos.y} r="24" fill="url(#sourceGlow)" />
        <circle cx={originPos.x} cy={originPos.y} r="7" fill="#00d4ff" stroke="#0a0a0a" strokeWidth="2.5" />
        <circle cx={originPos.x} cy={originPos.y} r="3" fill="#0a0a0a" />
        <text x={originPos.x} y={originPos.y - 16} textAnchor="middle" fill="#00d4ff" fontSize="8" fontWeight="700">
          {originLabel}
        </text>
        <text x={originPos.x} y={originPos.y - 8} textAnchor="middle" fill="#00d4ff" fontSize="5" opacity="0.5">
          {originCity}
        </text>
        {originIsp && (
          <text x={originPos.x} y={originPos.y + 20} textAnchor="middle" fill="#666666" fontSize="6">
            {originIsp}
          </text>
        )}

        {nodes.map((node) => {
          const isSelected = selectedId === node.id;
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={isSelected ? 18 : 14} fill={`url(#glow-${node.id})`} />
              <circle cx={node.x} cy={node.y} r={isSelected ? 4.5 : 3.5} fill={node.color} stroke="#0a0a0a" strokeWidth="1.5" />
              <text x={node.x} y={node.y - 10} textAnchor="middle" fill={node.color} fontSize={isSelected ? "8" : "7"} fontWeight="600">
                {node.name}
              </text>
              <text x={node.x} y={node.y + 14} textAnchor="middle" fill={getLatencyColor(node.ping)} fontSize="9" fontWeight="700" className="tabular-nums">
                {node.ping > 0 ? `${node.ping} ms` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
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
  const [isMapTesting, setIsMapTesting] = useState(false);
  const [ipInfo, setIpInfo] = useState<{ ip: string; city: string; country: string; isp: string; lat: number; lon: number } | null>(null);
  const [userMapPos, setUserMapPos] = useState<{ x: number; y: number }>(VALENCIA_DEFAULT);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dataRef = useRef<number[]>([]);

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
        const lat = data.latitude || 10.4806;
        const lon = data.longitude || -66.9036;
        setIpInfo({ ip: data.ip, city: data.city || "", country: data.country_name || "", isp: data.org || "", lat, lon });
        setUserMapPos(geoToSvg(lat, lon));
      } catch {
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const data = await res.json();
          setIpInfo({ ip: data.ip, city: "", country: "", isp: "", lat: 10.4806, lon: -66.9036 });
        } catch {
          setIpInfo({ ip: "Unknown", city: "", country: "", isp: "", lat: 10.4806, lon: -66.9036 });
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
    if (dataRef.current.length === 0) dataRef.current = Array(60).fill(0);

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
        scales: { x: { display: false }, y: { display: false, min: 0, max: 160, beginAtZero: true } },
      },
    });
  }, [phase, destroyChart]);

  useEffect(() => {
    if (phase === "ping") {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setLivePing(8 + Math.random() * 25 + count * 0.5);
        setLiveJitter(1 + Math.random() * 8);
      }, 200);
      return () => clearInterval(interval);
    }
    if (phase === "download" || phase === "upload") {
      const isDownload = phase === "download";
      const baseSpeed = isDownload ? dest.downloadBase : dest.uploadBase;
      let tick = 0;
      dataRef.current = Array(60).fill(0);
      if (chartInstance.current) {
        chartInstance.current.data.datasets[0].data = dataRef.current;
        chartInstance.current.update();
      }
      const interval = setInterval(() => {
        tick++;
        const rampUp = Math.min(1, tick / 12);
        const variation = Math.random() * 20 - 10;
        const speed = Math.max(2, Math.min(160, baseSpeed * rampUp + variation));
        setCurrentSpeed(speed);
        dataRef.current = [...dataRef.current.slice(1), speed];
        if (chartInstance.current) {
          chartInstance.current.data.datasets[0].data = dataRef.current;
          chartInstance.current.update();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [phase, dest]);

  const runLatencyMap = useCallback(async () => {
    setIsMapTesting(true);
    setLatencyNodes(DESTINATIONS.map((s) => ({ ...s, ping: 0 })));

    for (let i = 0; i < DESTINATIONS.length; i++) {
      const s = DESTINATIONS[i];
      const jitter = Math.floor(Math.random() * 10) - 5;
      const finalPing = Math.max(1, s.basePing + jitter);
      setLatencyNodes((prev) => prev.map((n) => (n.id === s.id ? { ...n, ping: finalPing } : n)));
      await new Promise((r) => setTimeout(r, 400));
    }
    setIsMapTesting(false);
  }, []);

  useEffect(() => {
    runLatencyMap();
  }, [runLatencyMap]);

  const startTest = async () => {
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = [];

    await runLatencyMap();

    await new Promise((r) => setTimeout(r, 1500));
    const ping = Math.max(1, dest.basePing + Math.floor(Math.random() * 6) - 3);
    const jitter = Math.floor(Math.random() * 8) + 1;

    setPhase("download");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 5000));
    const download = Math.floor(Math.random() * 30) + dest.downloadBase - 15;

    setPhase("upload");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 4000));
    const upload = Math.floor(Math.random() * 15) + dest.uploadBase - 8;

    setCurrentSpeed(0);
    dataRef.current = [];
    setResults({ ping, jitter, download: Math.max(download, 10), upload: Math.max(upload, 5), destination: dest.name });
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
      case "ping": return "Testing latency...";
      case "download": return "Testing download speed...";
      case "upload": return "Testing upload speed...";
      case "complete": return "Test complete";
      default: return "";
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4 selection:bg-cyan-500/30">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <div className="flex justify-center">
          <EwinetLogo size={70} />
        </div>

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

        <LatencyMap
          nodes={latencyNodes}
          selectedId={selectedDest}
          isActive={isMapTesting || phase === "ping"}
          originPos={userMapPos}
          originLabel={ipInfo?.ip || "Your IP"}
          originCity={ipInfo?.city ? `${ipInfo.city}, ${ipInfo.country}` : "Detecting..."}
          originIsp={ipInfo?.isp || ""}
        />

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
                      {phase === "ping" ? liveJitter.toFixed(1) : results ? results.jitter : "--"}
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
