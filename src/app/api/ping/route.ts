import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const results: number[] = [];

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        const elapsed = performance.now() - start;
        results.push(elapsed);
      } catch {
        results.push(-1);
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({ pings: results });
  } catch {
    return NextResponse.json({ error: "Ping failed" }, { status: 500 });
  }
}
