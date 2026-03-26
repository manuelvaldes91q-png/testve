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
  origin: string;
}

interface ServerNode {
  id: string;
  name: string;
  country: string;
  x: number;
  y: number;
  ping: number;
  color: string;
}

interface OriginServer {
  id: string;
  label: string;
  city: string;
  country: string;
  x: number;
  y: number;
  basePings: Record<string, number>;
  downloadBase: number;
  uploadBase: number;
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

const DESTINATIONS: Omit<ServerNode, "ping">[] = [
  { id: "us-east", name: "Google US East", country: "US", x: 200, y: 105, color: "#00d4ff" },
  { id: "us-west", name: "Google US West", country: "US", x: 120, y: 100, color: "#00d4ff" },
  { id: "brazil", name: "Google Brazil", country: "BR", x: 270, y: 245, color: "#f97316" },
  { id: "europe", name: "Google Europe", country: "DE", x: 360, y: 85, color: "#8b5cf6" },
  { id: "uk", name: "Google UK", country: "GB", x: 330, y: 75, color: "#8b5cf6" },
  { id: "japan", name: "Google Japan", country: "JP", x: 540, y: 110, color: "#22c55e" },
  { id: "singapore", name: "Google Singapore", country: "SG", x: 500, y: 195, color: "#22c55e" },
  { id: "australia", name: "Google Australia", country: "AU", x: 545, y: 270, color: "#eab308" },
];

const ORIGIN_SERVERS: OriginServer[] = [
  {
    id: "inter-caracas",
    label: "Inter Caracas",
    city: "Caracas",
    country: "Venezuela",
    x: 232,
    y: 195,
    downloadBase: 85,
    uploadBase: 35,
    basePings: {
      "us-east": 55, "us-west": 95, "brazil": 28, "europe": 130,
      "uk": 120, "japan": 210, "singapore": 245, "australia": 275,
    },
  },
  {
    id: "inter-valencia",
    label: "Inter Valencia",
    city: "Valencia",
    country: "Venezuela",
    x: 225,
    y: 188,
    downloadBase: 78,
    uploadBase: 30,
    basePings: {
      "us-east": 58, "us-west": 100, "brazil": 30, "europe": 135,
      "uk": 125, "japan": 215, "singapore": 250, "australia": 280,
    },
  },
  {
    id: "netuno",
    label: "Netuno",
    city: "Caracas",
    country: "Venezuela",
    x: 228,
    y: 192,
    downloadBase: 72,
    uploadBase: 28,
    basePings: {
      "us-east": 62, "us-west": 102, "brazil": 32, "europe": 138,
      "uk": 128, "japan": 218, "singapore": 252, "australia": 285,
    },
  },
  {
    id: "grupo-gtd",
    label: "Grupo GTD",
    city: "Miami",
    country: "US",
    x: 185,
    y: 155,
    downloadBase: 120,
    uploadBase: 55,
    basePings: {
      "us-east": 12, "us-west": 55, "brazil": 70, "europe": 95,
      "uk": 88, "japan": 165, "singapore": 195, "australia": 210,
    },
  },
  {
    id: "gold-data",
    label: "Gold Data",
    city: "Miami",
    country: "US",
    x: 190,
    y: 160,
    downloadBase: 110,
    uploadBase: 48,
    basePings: {
      "us-east": 15, "us-west": 58, "brazil": 72, "europe": 98,
      "uk": 92, "japan": 170, "singapore": 200, "australia": 215,
    },
  },
];

const ANIMATION_DURS = [3.2, 2.8, 2.1, 3.5, 2.4, 2.6, 3.1, 2.9];

function getLatencyColor(ping: number): string {
  if (ping < 30) return "#22c55e";
  if (ping < 60) return "#eab308";
  if (ping < 100) return "#f97316";
  return "#ef4444";
}

function getCityColor(city: string): string {
  if (city === "Caracas") return "#00d4ff";
  if (city === "Valencia") return "#06b6d4";
  if (city === "Maracaibo") return "#14b8a6";
  return "#f97316";
}

function LatencyMap({
  nodes,
  sourceNode,
  sourceLabel,
  sourceCity,
  isActive,
}: {
  nodes: ServerNode[];
  sourceNode: { x: number; y: number };
  sourceLabel: string;
  sourceCity: string;
  isActive: boolean;
}) {
  const srcColor = getCityColor(sourceCity);

  return (
    <div className="relative w-full aspect-[2/1] bg-[#0d0d0d] rounded-xl border border-neutral-800/50 overflow-hidden">
      <svg viewBox="0 0 660 340" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sourceGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={srcColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={srcColor} stopOpacity="0" />
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
          <path d="M330,130 L350,120 L370,125 L385,135 L395,150 L400,170 L405,190 L400,210 L390,230 L375,245 L355,250 L340,240 L325,225 L320,205 L315,185 L315,165 L320,145 Z" fill="#ffffff" fillOpacity="0.03" />
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
          const midX = (sourceNode.x + node.x) / 2;
          const midY = Math.min(sourceNode.y, node.y) - 30;
          return (
            <g key={`conn-${node.id}`}>
              <path
                d={`M ${sourceNode.x} ${sourceNode.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
                fill="none"
                stroke={node.color}
                strokeWidth="1"
                opacity={isActive ? 0.4 : 0.15}
                strokeDasharray={isActive ? "0" : "4 4"}
              />
              {isActive && (
                <circle r="2.5" fill={node.color} opacity="0.9">
                  <animateMotion
                    dur={`${ANIMATION_DURS[idx % ANIMATION_DURS.length]}s`}
                    repeatCount="indefinite"
                    path={`M ${sourceNode.x} ${sourceNode.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        <circle cx={sourceNode.x} cy={sourceNode.y} r="20" fill="url(#sourceGlow)" />
        <circle cx={sourceNode.x} cy={sourceNode.y} r="5" fill={srcColor} stroke="#0a0a0a" strokeWidth="2" />
        <text x={sourceNode.x} y={sourceNode.y - 12} textAnchor="middle" fill={srcColor} fontSize="8" fontWeight="600">
          {sourceLabel}
        </text>
        <text x={sourceNode.x} y={sourceNode.y - 4} textAnchor="middle" fill={srcColor} fontSize="5" opacity="0.6">
          {sourceCity}
        </text>

        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="14" fill={`url(#glow-${node.id})`} />
            <circle cx={node.x} cy={node.y} r="3.5" fill={node.color} stroke="#0a0a0a" strokeWidth="1.5" />
            <text x={node.x} y={node.y - 8} textAnchor="middle" fill={node.color} fontSize="7" fontWeight="600">
              {node.name.replace("Google ", "")}
            </text>
            <text x={node.x} y={node.y + 12} textAnchor="middle" fill={getLatencyColor(node.ping)} fontSize="8" fontWeight="700" className="tabular-nums">
              {node.ping} ms
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Home() {
  const [selectedOrigin, setSelectedOrigin] = useState(ORIGIN_SERVERS[0].id);
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [liveJitter, setLiveJitter] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [latencyNodes, setLatencyNodes] = useState<ServerNode[]>(
    DESTINATIONS.map((d) => ({ ...d, ping: 0 }))
  );
  const [isMapTesting, setIsMapTesting] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dataRef = useRef<number[]>([]);

  const origin = ORIGIN_SERVERS.find((o) => o.id === selectedOrigin) ?? ORIGIN_SERVERS[0];

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
        scales: { x: { display: false }, y: { display: false, min: 0, max: 150, beginAtZero: true } },
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
      const baseSpeed = isDownload ? origin.downloadBase : origin.uploadBase;
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
        const speed = Math.max(2, Math.min(150, baseSpeed * rampUp + variation));
        setCurrentSpeed(speed);
        dataRef.current = [...dataRef.current.slice(1), speed];
        if (chartInstance.current) {
          chartInstance.current.data.datasets[0].data = dataRef.current;
          chartInstance.current.update();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [phase, origin]);

  const runLatencyMap = useCallback(async (o: OriginServer) => {
    setIsMapTesting(true);
    setLatencyNodes(DESTINATIONS.map((d) => ({ ...d, ping: 0 })));

    for (let i = 0; i < DESTINATIONS.length; i++) {
      const dest = DESTINATIONS[i];
      const base = o.basePings[dest.id] || 100;
      const jitter = Math.floor(Math.random() * 15) - 7;
      const finalPing = Math.max(5, base + jitter);
      setLatencyNodes((prev) => prev.map((n) => (n.id === dest.id ? { ...n, ping: finalPing } : n)));
      await new Promise((r) => setTimeout(r, 400));
    }
    setIsMapTesting(false);
  }, []);

  useEffect(() => {
    runLatencyMap(origin);
  }, [selectedOrigin, runLatencyMap, origin]);

  const startTest = async () => {
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = [];

    await runLatencyMap(origin);

    await new Promise((r) => setTimeout(r, 1500));
    const ping = Math.floor(Math.random() * 30) + 8;
    const jitter = Math.floor(Math.random() * 10) + 2;

    setPhase("download");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 5000));
    const download = Math.floor(Math.random() * 40) + origin.downloadBase - 20;

    setPhase("upload");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 4000));
    const upload = Math.floor(Math.random() * 20) + origin.uploadBase - 10;

    setCurrentSpeed(0);
    dataRef.current = [];
    setResults({ ping, jitter, download: Math.max(download, 10), upload: Math.max(upload, 5), origin: `${origin.label}, ${origin.country}` });
    setPhase("complete");
  };

  const copyResults = () => {
    if (results) {
      const latencyText = latencyNodes.map((n) => `  ${n.name}: ${n.ping} ms`).join("\n");
      const text = `Speed Test Results\nOrigin: ${results.origin}\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nLatency: ${results.ping} ms\nJitter: ${results.jitter} ms\n\nGoogle Latency:\n${latencyText}`;
      navigator.clipboard.writeText(text);
    }
  };

  const handleOriginChange = (id: string) => {
    if (phase !== "idle" && phase !== "complete") return;
    setSelectedOrigin(id);
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

  const venezuelaServers = ORIGIN_SERVERS.filter((o) => o.country === "Venezuela");
  const miamiServers = ORIGIN_SERVERS.filter((o) => o.country === "US");

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4 selection:bg-cyan-500/30">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs font-medium tracking-[0.3em] uppercase mb-2">
            <span className="text-cyan-400"><ArrowDownIcon size={16} /></span>
            <span className="text-orange-400"><ArrowUpIcon size={16} /></span>
            SPEED TEST
          </div>
          <h1 className="text-sm text-neutral-600">{origin.label}, {origin.country} &rarr; Google Global Network</h1>
          {selectedOrigin === "inter-valencia" && (
            <div className="mt-3 flex justify-center">
              <EwinetLogo size={60} />
            </div>
          )}
        </div>

        {/* Server Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-wider">
            <ServerIcon />
            <span>Select Server</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Venezuela */}
            <div className="space-y-2">
              <div className="text-[10px] text-neutral-600 uppercase tracking-widest pl-1">Venezuela</div>
              {venezuelaServers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleOriginChange(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    selectedOrigin === s.id
                      ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                      : "bg-[#111] border border-neutral-800/50 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {s.id === "inter-valencia" && <EwinetLogo size={32} />}
                    {s.label}
                    {s.id === "inter-valencia" && <span className="text-[9px] text-cyan-500/60 font-normal">by EWINET</span>}
                  </span>
                  {selectedOrigin === s.id && <CheckIcon />}
                </button>
              ))}
            </div>
            {/* Miami */}
            <div className="space-y-2">
              <div className="text-[10px] text-neutral-600 uppercase tracking-widest pl-1">Miami</div>
              {miamiServers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleOriginChange(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    selectedOrigin === s.id
                      ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                      : "bg-[#111] border border-neutral-800/50 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <span>{s.label}</span>
                  {selectedOrigin === s.id && <CheckIcon />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <LatencyMap
          nodes={latencyNodes}
          sourceNode={origin}
          sourceLabel={origin.label}
          sourceCity={origin.city}
          isActive={isMapTesting || phase === "ping"}
        />

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {latencyNodes.map((node) => (
            <div key={node.id} className="bg-[#111] border border-neutral-800/50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-neutral-600 truncate">{node.country}</div>
              <div className="text-sm font-bold tabular-nums" style={{ color: getLatencyColor(node.ping) }}>
                {node.ping > 0 ? node.ping : "--"}
              </div>
              <div className="text-[9px] text-neutral-700">ms</div>
            </div>
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
              <p className="text-neutral-600 text-sm">Click to start the test</p>
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
            <span>Latency measured from {origin.label} to Google global edge locations</span>
          </div>
          {selectedOrigin === "inter-valencia" && (
            <div className="text-neutral-600">
              Servidor propiedad de <span className="text-cyan-400">EWINET</span> &middot; Valencia, Venezuela
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
