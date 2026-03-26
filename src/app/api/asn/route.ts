import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { hostname } = await req.json();
    if (!hostname || typeof hostname !== "string") {
      return NextResponse.json({ error: "Missing hostname" }, { status: 400 });
    }

    const cleanHost = hostname
      .replace(/^https?:\/\//, "")
      .replace(/:\d+.*$/, "")
      .replace(/\/.*$/, "");

    let ip = cleanHost;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
      try {
        const dnsRes = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanHost)}&type=A`,
          { headers: { accept: "application/dns-json" } }
        );
        const dnsData = await dnsRes.json();
        if (dnsData.Answer?.length) {
          const aRecord = dnsData.Answer.find((a: { type: number }) => a.type === 1);
          ip = aRecord?.data || cleanHost;
        }
      } catch {
        ip = cleanHost;
      }
    }

    try {
      const infoRes = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(5000) });
      const info = await infoRes.json();
      const org = info.org || "";
      const asnMatch = org.match(/^(AS\d+)/);
      return NextResponse.json({
        ip: info.ip || ip,
        asn: asnMatch ? asnMatch[1] : "",
        org: org.replace(/^AS\d+\s*/, ""),
        country: info.country || "",
        city: info.city || "",
        region: info.region || "",
        hostname: cleanHost,
      });
    } catch {
      return NextResponse.json({ ip, asn: "", org: "", country: "", hostname: cleanHost });
    }
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
