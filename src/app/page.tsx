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
}

type TestPhase = "idle" | "ping" | "download" | "upload" | "complete";

function ArrowDownIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [liveJitter, setLiveJitter] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dataRef = useRef<number[]>([]);

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

    if (dataRef.current.length === 0) {
      dataRef.current = Array(60).fill(0);
    }

    const labels = dataRef.current.map((_, i) => i.toString());

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: dataRef.current,
            borderColor: phase === "upload" ? "#f97316" : "#00d4ff",
            backgroundColor:
              phase === "upload"
                ? "rgba(249, 115, 22, 0.08)"
                : "rgba(0, 212, 255, 0.08)",
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
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 150, beginAtZero: true },
        },
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
      const baseSpeed = isDownload ? 85 : 35;
      let tick = 0;

      dataRef.current = Array(60).fill(0);
      if (chartInstance.current) {
        chartInstance.current.data.labels = dataRef.current.map((_, i) =>
          i.toString()
        );
        chartInstance.current.data.datasets[0].data = dataRef.current;
        chartInstance.current.update();
      }

      const interval = setInterval(() => {
        tick++;
        const rampUp = Math.min(1, tick / 12);
        const variation = Math.random() * 20 - 10;
        const speed = Math.max(
          2,
          Math.min(150, baseSpeed * rampUp + variation)
        );
        setCurrentSpeed(speed);

        dataRef.current = [...dataRef.current.slice(1), speed];
        if (chartInstance.current) {
          chartInstance.current.data.datasets[0].data = dataRef.current;
          chartInstance.current.update();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const startTest = async () => {
    setPhase("ping");
    setResults(null);
    setCurrentSpeed(0);
    setLivePing(0);
    setLiveJitter(0);
    dataRef.current = [];

    await new Promise((r) => setTimeout(r, 2000));
    const ping = Math.floor(Math.random() * 30) + 8;
    const jitter = Math.floor(Math.random() * 10) + 2;

    setPhase("download");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 5000));
    const download = Math.floor(Math.random() * 80) + 80;

    setPhase("upload");
    setCurrentSpeed(0);
    dataRef.current = [];
    await new Promise((r) => setTimeout(r, 4000));
    const upload = Math.floor(Math.random() * 50) + 25;

    setCurrentSpeed(0);
    dataRef.current = [];
    setResults({ ping, jitter, download, upload });
    setPhase("complete");
  };

  const copyResults = () => {
    if (results) {
      const text = `Speed Test Results\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nLatency: ${results.ping} ms\nJitter: ${results.jitter} ms`;
      navigator.clipboard.writeText(text);
    }
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case "ping":
        return "Testing latency...";
      case "download":
        return "Testing download speed...";
      case "upload":
        return "Testing upload speed...";
      case "complete":
        return "Test complete";
      default:
        return "";
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 selection:bg-cyan-500/30">
      <div className="w-full max-w-xl mx-auto">
        {phase === "idle" ? (
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center gap-2 text-neutral-500 text-sm font-medium tracking-widest uppercase">
              <span className="text-cyan-400">
                <ArrowDownIcon />
              </span>
              <span className="text-orange-400">
                <ArrowUpIcon />
              </span>
              SPEED TEST
            </div>

            <button
              onClick={startTest}
              className="w-44 h-44 rounded-full bg-[#111] border border-neutral-800 text-white text-lg font-medium transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(0,212,255,0.15)] cursor-pointer"
            >
              GO
            </button>

            <p className="text-neutral-600 text-sm">
              Click to start the test
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="text-sm font-medium tracking-widest uppercase text-neutral-500">
              {getPhaseLabel()}
            </div>

            <div className="relative w-full max-w-md aspect-video rounded-2xl bg-[#111] border border-neutral-800/50 overflow-hidden">
              <div className="absolute inset-0 p-2">
                <canvas ref={chartRef} />
              </div>

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
                  <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                    <ZapIcon />
                    Latency
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {phase === "ping"
                      ? livePing.toFixed(0)
                      : results
                      ? results.ping
                      : "--"}
                    <span className="text-sm text-neutral-600 ml-1">ms</span>
                  </div>
                </div>
                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                    <ActivityIcon />
                    Jitter
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {phase === "ping"
                      ? liveJitter.toFixed(1)
                      : results
                      ? results.jitter
                      : "--"}
                    <span className="text-sm text-neutral-600 ml-1">ms</span>
                  </div>
                </div>
                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                    {phase === "upload" ? (
                      <span className="text-orange-400">
                        <ArrowUpIcon />
                      </span>
                    ) : (
                      <span className="text-cyan-400">
                        <ArrowDownIcon />
                      </span>
                    )}
                    {phase === "upload" ? "Upload" : "Download"}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {phase === "download" || phase === "upload"
                      ? currentSpeed.toFixed(1)
                      : "--"}
                    <span className="text-sm text-neutral-600 ml-1">Mbps</span>
                  </div>
                </div>
              </div>
            )}

            {phase === "complete" && results && (
              <div className="w-full max-w-md space-y-3">
                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-neutral-600 text-xs mb-3 uppercase tracking-wider">
                    <span className="text-cyan-400">
                      <ArrowDownIcon />
                    </span>
                    Download
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-cyan-400 tabular-nums">
                      {results.download}
                    </span>
                    <span className="text-lg text-neutral-500">Mbps</span>
                  </div>
                </div>

                <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-neutral-600 text-xs mb-3 uppercase tracking-wider">
                    <span className="text-orange-400">
                      <ArrowUpIcon />
                    </span>
                    Upload
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-orange-400 tabular-nums">
                      {results.upload}
                    </span>
                    <span className="text-lg text-neutral-500">Mbps</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-5">
                    <div className="flex items-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                      <ZapIcon />
                      Latency
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-neutral-200 tabular-nums">
                        {results.ping}
                      </span>
                      <span className="text-sm text-neutral-600">ms</span>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-neutral-800/50 rounded-xl p-5">
                    <div className="flex items-center gap-1 text-neutral-600 text-xs mb-2 uppercase tracking-wider">
                      <ActivityIcon />
                      Jitter
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-neutral-200 tabular-nums">
                        {results.jitter}
                      </span>
                      <span className="text-sm text-neutral-600">ms</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={startTest}
                    className="flex-1 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm font-medium border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
                  >
                    Run Again
                  </button>
                  <button
                    onClick={copyResults}
                    className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-neutral-400 text-sm font-medium border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    Copy Results
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
