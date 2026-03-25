"use client";

import { useState, useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
);

interface TestResults {
  ping: number;
  jitter: number;
  download: number;
  upload: number;
}

type TestPhase = "idle" | "ping" | "download" | "upload" | "complete";

export default function Home() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (phase === "download" || phase === "upload") {
      const interval = setInterval(() => {
        const baseSpeed = phase === "download" ? 85 : 35;
        const variation = Math.random() * 30 - 15;
        const speed = Math.max(5, Math.min(150, baseSpeed + variation));
        setCurrentSpeed(speed);
        setSpeedHistory((prev) => [...prev.slice(-20), speed]);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [phase]);

  useEffect(() => {
    if (chartRef.current && speedHistory.length > 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      const ctx = chartRef.current.getContext("2d");
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: speedHistory.map((_, i) => i.toString()),
            datasets: [
              {
                data: speedHistory,
                borderColor: phase === "upload" ? "#f97316" : "#3b82f6",
                backgroundColor:
                  phase === "upload"
                    ? "rgba(249, 115, 22, 0.1)"
                    : "rgba(59, 130, 246, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 200 },
            plugins: { tooltip: { enabled: false } },
            scales: {
              x: { display: false },
              y: {
                display: false,
                min: 0,
                max: 160,
              },
            },
          },
        });
      }
    }
  }, [speedHistory, phase]);

  const startTest = async () => {
    setPhase("ping");
    setSpeedHistory([]);
    setResults(null);

    await new Promise((r) => setTimeout(r, 1500));
    const ping = Math.floor(Math.random() * 30) + 8;
    const jitter = Math.floor(Math.random() * 10) + 2;

    setPhase("download");
    await new Promise((r) => setTimeout(r, 4000));
    const download = Math.floor(Math.random() * 60) + 60;

    setPhase("upload");
    await new Promise((r) => setTimeout(r, 3000));
    const upload = Math.floor(Math.random() * 40) + 15;

    setResults({ ping, jitter, download, upload });
    setPhase("complete");
  };

  const copyResults = () => {
    if (results) {
      const text = `Speed Test Results:\nDownload: ${results.download} Mbps\nUpload: ${results.upload} Mbps\nPing: ${results.ping} ms\nJitter: ${results.jitter} ms`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-400">
            Speed Test
          </h1>
        </div>

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 mb-6">
          <div className="text-center mb-8">
            {phase === "idle" || phase === "complete" ? (
              <div className="text-6xl font-bold tracking-tight">
                {results ? results.download : "--"}
                <span className="text-2xl text-neutral-500 ml-1">Mbps</span>
              </div>
            ) : (
              <div className="text-6xl font-bold tracking-tight animate-pulse">
                {currentSpeed.toFixed(1)}
                <span className="text-2xl text-neutral-500 ml-1">Mbps</span>
              </div>
            )}
            <div className="text-sm text-neutral-500 mt-2 capitalize">
              {phase === "ping" && "Measuring latency..."}
              {phase === "download" && "Testing download..."}
              {phase === "upload" && "Testing upload..."}
              {phase === "complete" && "Test complete"}
            </div>
          </div>

          <div className="h-32 mb-6">
            <canvas ref={chartRef} />
          </div>

          {phase !== "idle" && phase !== "complete" && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Ping", value: phase === "ping" ? currentSpeed.toFixed(0) : "--", unit: "ms" },
                { label: "Jitter", value: phase === "ping" ? (currentSpeed * 0.3).toFixed(1) : "--", unit: "ms" },
                { label: "Download", value: phase === "download" ? currentSpeed.toFixed(1) : "--", unit: "Mbps" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-neutral-800/50 rounded-lg p-3 text-center"
                >
                  <div className="text-xs text-neutral-500">{item.label}</div>
                  <div className="text-lg font-medium">
                    {item.value}
                    <span className="text-xs text-neutral-600 ml-1">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {phase === "complete" && results && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-4 text-center">
              <div className="text-xs text-neutral-500 mb-1">Download</div>
              <div className="text-2xl font-bold text-blue-400">{results.download} Mbps</div>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-4 text-center">
              <div className="text-xs text-neutral-500 mb-1">Upload</div>
              <div className="text-2xl font-bold text-orange-400">{results.upload} Mbps</div>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-4 text-center">
              <div className="text-xs text-neutral-500 mb-1">Ping</div>
              <div className="text-2xl font-bold text-neutral-300">{results.ping} ms</div>
              <div className="text-xs text-neutral-600">Jitter: {results.jitter} ms</div>
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          {phase === "idle" || phase === "complete" ? (
            <button
              onClick={startTest}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]"
            >
              {phase === "idle" ? "Start Test" : "Run Again"}
            </button>
          ) : (
            <div className="px-8 py-3 bg-neutral-800 text-neutral-500 rounded-lg font-medium">
              Running...
            </div>
          )}

          {phase === "complete" && (
            <button
              onClick={copyResults}
              className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
            >
              Copy Results
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
