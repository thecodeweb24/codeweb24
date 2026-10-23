import { NextResponse } from "next/server";
import { extractWebsiteInfo } from "@/lib/website-import";

export async function POST(request: Request) {
  try {
    const { websiteUrl } = await request.json();
    const url = String(websiteUrl || "").trim();

    if (!url) {
      return NextResponse.json({ error: "Please provide a website URL." }, { status: 400 });
    }

    const normalizedUrl = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).toString().replace(/\/$/, "");

    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Unable to open the website (${response.status}).`);
    }

    const html = await response.text();
    const result = extractWebsiteInfo(html, normalizedUrl);

    return NextResponse.json({
      ...result,
      logoCandidates: result.logoCandidates.slice(0, 6),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be analyzed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
