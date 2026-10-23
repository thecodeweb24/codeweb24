import * as cheerio from "cheerio";

export type LogoCandidate = {
  url: string;
  source: string;
  width?: number;
  height?: number;
  score: number;
  alt?: string;
};

export type WebsiteImportResult = {
  websiteTitle: string;
  companyName: string;
  description: string;
  url: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterImage?: string;
  favicon?: string;
  themeColor?: string;
  category?: string;
  businessSummary?: string;
  services?: string[];
  logoCandidates: LogoCandidate[];
  screenshotUrl: string;
  siteImages: string[];
  statusMessages: string[];
  warnings: string[];
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A website URL is required.");
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const parsed = new URL(candidate);
  if (!parsed.hostname) {
    throw new Error("The website URL is invalid.");
  }

  return parsed.toString().replace(/\/$/, "");
};

const toAbsoluteUrl = (baseUrl: string, maybeRelative: string | undefined) => {
  if (!maybeRelative) return undefined;
  const candidate = maybeRelative.trim();
  if (!candidate) return undefined;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const getTextContent = ($: cheerio.CheerioAPI, selector: string) => {
  const value = $(selector).first().text().trim();
  return value || undefined;
};

const parseJsonLdObjects = ($: cheerio.CheerioAPI) => {
  const objects: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        objects.push(...(parsed.filter(Boolean) as Record<string, unknown>[]));
      } else if (parsed && typeof parsed === "object") {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore malformed JSON-LD and continue with the rest of the available metadata.
    }
  });

  return objects;
};

const flattenJsonLd = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenJsonLd(entry));
  }
  if (typeof value === "object") {
    return [value as Record<string, unknown>];
  }
  return [];
};

const findOrganization = (jsonLdObjects: Record<string, unknown>[]) => {
  const candidates = jsonLdObjects.flatMap((entry) => flattenJsonLd(entry));
  for (const candidate of candidates) {
    const rawTypes = candidate["@type"];
    const typeList = Array.isArray(rawTypes) ? rawTypes : [rawTypes];
    const types = typeList.filter(Boolean).map((value) => String(value));
    if (types.some((type) => /organization|localbusiness|business|company/i.test(type))) {
      return candidate;
    }
  }
  return candidates[0] ?? {};
};

const getCompanyName = (
  $: cheerio.CheerioAPI,
  organization: Record<string, unknown>,
  fallbackTitle: string,
) => {
  const fromOrg = typeof organization.name === "string" ? organization.name.trim() : "";
  const fromOgSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  const fromAppName = $('meta[name="application-name"]').attr("content")?.trim();

  return fromOrg || fromOgSiteName || fromAppName || fallbackTitle || "Company";
};

const getCategory = (
  organization: Record<string, unknown>,
  $: cheerio.CheerioAPI,
  fallbackDescription: string,
) => {
  const fromOrg =
    typeof organization.category === "string"
      ? organization.category.trim()
      : typeof organization["categoryName"] === "string"
        ? organization["categoryName"].trim()
        : "";

  const fromMeta = $('meta[name="category"]').attr("content")?.trim();
  const fromSchema = Array.isArray(organization["@type"]) ? organization["@type"].join(", ") : String(organization["@type"] || "");

  return fromOrg || fromMeta || (fromSchema ? fromSchema : undefined) || fallbackDescription || undefined;
};

const buildSummary = (companyName: string, description: string, text: string) => {
  const pageText = [description, text].filter(Boolean).join(" ");
  const cleaned = pageText
    .replace(/\s+/g, " ")
    .replace(/\b(?:visit|read|learn|more|website|home|about|contact|services)\b/gi, " ")
    .trim();

  if (!cleaned) {
    return description || `${companyName} website`;
  }

  return cleaned.length > 220 ? `${cleaned.slice(0, 220).trim()}...` : cleaned;
};

const extractServices = ($: cheerio.CheerioAPI) => {
  const serviceText = [
    ...$('h2, h3, li, p')
      .map((_, element) => $(element).text().trim())
      .get(),
  ]
    .filter((value) => value.length > 18)
    .slice(0, 15)
    .join(" ");

  if (!serviceText) return [];

  const words = serviceText
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .map((word) => word.replace(/[^a-zA-Z0-9&/ -]/g, ""));

  const unique = [...new Set(words)];
  return unique.slice(0, 8);
};

const collectLogoCandidates = (
  $: cheerio.CheerioAPI,
  url: string,
  companyName: string,
  organization: Record<string, unknown>,
) => {
  const seen = new Set<string>();
  const candidates: LogoCandidate[] = [];

  const addCandidate = (
    candidateUrl: string | undefined,
    source: string,
    scoreDelta: number,
    alt?: string,
    width?: number,
    height?: number,
  ) => {
    if (!candidateUrl) return;
    const normalized = toAbsoluteUrl(url, candidateUrl) || candidateUrl;
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);

    const score = Math.max(1, scoreDelta);
    candidates.push({ url: normalized, source, score, alt, width, height });
  };

  const logoValue = organization.logo;
  if (typeof logoValue === "string") addCandidate(logoValue, "structured-data", 40);
  if (logoValue && typeof logoValue === "object" && "url" in logoValue && typeof logoValue.url === "string") {
    addCandidate(logoValue.url, "structured-data", 40, "Logo");
  }

  const logoGraph = organization["logo"];
  if (logoGraph && typeof logoGraph === "object") {
    if (Array.isArray(logoGraph)) {
      logoGraph.forEach((entry) => {
        if (entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string") {
          addCandidate(entry.url, "structured-data", 35, "Logo");
        }
      });
    }
  }

  addCandidate($('meta[property="og:image"]').attr("content") || undefined, "open-graph", 30, "OpenGraph logo");
  addCandidate($('meta[name="twitter:image"]').attr("content") || undefined, "twitter-card", 25, "Twitter card image");
  addCandidate($('link[rel~="icon"]').first().attr("href") || undefined, "favicon", 18, "Favicon");
  addCandidate($('link[rel~="apple-touch-icon"]').first().attr("href") || undefined, "apple-icon", 18, "App icon");

  $('img').each((_index, element) => {
    const src = $(element).attr("src");
    const alt = $(element).attr("alt")?.trim() || "";
    const className = $(element).attr("class") || "";
    const id = $(element).attr("id") || "";
    const width = Number($(element).attr("width") || 0) || undefined;
    const height = Number($(element).attr("height") || 0) || undefined;
    const lowerAlt = alt.toLowerCase();
    const combined = `${alt} ${className} ${id}`.toLowerCase();
    const matchesBrand =
      lowerAlt.includes("logo") ||
      combined.includes("logo") ||
      lowerAlt.includes(companyName.toLowerCase()) ||
      combined.includes(companyName.toLowerCase());

    if (!src) return;

    const score = matchesBrand ? 26 : 12;
    if (src.includes("logo") || matchesBrand) {
      addCandidate(src, "image-asset", score, alt, width, height);
    }
  });

  return candidates
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);
};

const safeText = (value?: string) => value?.trim() || undefined;

export const extractWebsiteInfo = (rawHtml: string, inputUrl: string): WebsiteImportResult => {
  const url = normalizeUrl(inputUrl);
  const $ = cheerio.load(rawHtml);

  const jsonLdObjects = parseJsonLdObjects($);
  const organization = findOrganization(jsonLdObjects) as Record<string, unknown>;
  const websiteTitle = safeText($('meta[property="og:title"]').attr("content"))
    || safeText($('meta[name="twitter:title"]').attr("content"))
    || safeText($('title').text())
    || safeText(getTextContent($, "h1"))
    || "Website";

  const companyName = getCompanyName($, organization, websiteTitle);
  const description =
    safeText($('meta[name="description"]').attr("content")) ||
    safeText($('meta[property="og:description"]').attr("content")) ||
    safeText($('meta[name="twitter:description"]').attr("content")) ||
    safeText($('p').first().text()) ||
    "";

  const ogTitle = safeText($('meta[property="og:title"]').attr("content"));
  const ogDescription = safeText($('meta[property="og:description"]').attr("content"));
  const ogImage = safeText($('meta[property="og:image"]').attr("content"));
  const twitterImage = safeText($('meta[name="twitter:image"]').attr("content"));
  const favicon = safeText($('link[rel~="icon"]').first().attr("href")) || safeText($('link[rel~="shortcut icon"]').first().attr("href"));
  const themeColor = safeText($('meta[name="theme-color"]').attr("content")) || safeText($('meta[property="theme-color"]').attr("content"));
  const pageText = $('main, body')
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const category = getCategory(organization, $, description) || undefined;
  const services = extractServices($);
  const businessSummary = buildSummary(companyName, description, pageText);
  const extractedLogoCandidates = collectLogoCandidates($, url, companyName, organization);
  const siteImages = $('img[src]')
    .map((_index, element) => {
      const src = $(element).attr("src");
      return src ? String(src) : undefined;
    })
    .get()
    .filter(Boolean)
    .map((source) => toAbsoluteUrl(url, source) || source)
    .slice(0, 12);

  return {
    websiteTitle,
    companyName,
    description,
    url,
    ogTitle,
    ogDescription,
    ogImage: toAbsoluteUrl(url, ogImage) || ogImage,
    twitterImage: toAbsoluteUrl(url, twitterImage) || twitterImage,
    favicon: toAbsoluteUrl(url, favicon) || favicon,
    themeColor,
    category,
    businessSummary,
    services,
    logoCandidates: extractedLogoCandidates,
    screenshotUrl: `https://image.thum.io/get/width/1440/crop/0/${url}`,
    siteImages: [...new Set(siteImages)],
    statusMessages: [
      "Connecting to website...",
      "Reading website information...",
      "Finding the company logo...",
      "Capturing website preview...",
      "Preparing project details...",
    ],
    warnings:
      !description && !businessSummary ? ["No description metadata was found on the homepage. The project summary can be edited before publishing."] : [],
  };
};
