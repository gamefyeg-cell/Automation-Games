/**
 * Thin client for the Anakin.io URL Scraper (https://anakin.io/docs/api-reference/url-scraper).
 *
 * Async job pattern: POST submits a job and returns { jobId, status: "pending" };
 * GET /v1/url-scraper/{jobId} is polled until status is "completed" or "failed".
 */

const ANAKIN_BASE_URL = "https://api.anakin.io/v1/url-scraper";

export type AnakinFormat =
  | "markdown"
  | "html"
  | "cleanedHtml"
  | "links"
  | "images"
  | "summary"
  | "screenshot"
  | "screenshotFullPage"
  | "json";

export interface AnakinScrapeRequest {
  url: string;
  formats?: AnakinFormat[];
  /** ISO-3166 country code for proxy routing — determines the IP region Steam sees. Default "us". */
  country?: string;
  useBrowser?: boolean;
  /** AI-extracts structured JSON matching outputSchema; implies formats includes "json". */
  generateJson?: boolean;
  outputSchema?: Record<string, unknown>;
}

export interface AnakinJob {
  id?: string;
  jobId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  url?: string;
  country?: string;
  html?: string;
  cleanedHtml?: string;
  markdown?: string;
  generatedJson?: { data?: unknown };
  links?: { href: string; text: string }[];
  images?: { src: string; alt: string }[];
  summary?: string;
  error?: string | null;
  createdAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export class AnakinError extends Error {}

function apiKey(): string {
  const key = process.env.ANAKIN_API_KEY;
  if (!key) throw new AnakinError("ANAKIN_API_KEY is not set.");
  return key;
}

async function submitScrapeJob(request: AnakinScrapeRequest): Promise<string> {
  const res = await fetch(ANAKIN_BASE_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new AnakinError(`Anakin submit failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as { jobId?: string };
  if (!body.jobId) throw new AnakinError("Anakin submit response had no jobId.");
  return body.jobId;
}

async function getScrapeJob(jobId: string): Promise<AnakinJob> {
  const res = await fetch(`${ANAKIN_BASE_URL}/${jobId}`, {
    headers: { "X-API-Key": apiKey() },
  });

  if (!res.ok) {
    throw new AnakinError(`Anakin job fetch failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface ScrapeUrlOptions {
  /** Max time to wait for the job to finish. Default 120_000ms, matching Anakin's own ~2min budget. */
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Submits a scrape job and polls until it completes or fails.
 * Throws AnakinError on failure, timeout, or transport errors.
 */
export async function scrapeUrl(
  request: AnakinScrapeRequest,
  { timeoutMs = 120_000, pollIntervalMs = 2_000 }: ScrapeUrlOptions = {},
): Promise<AnakinJob> {
  const jobId = await submitScrapeJob(request);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getScrapeJob(jobId);
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      throw new AnakinError(`Anakin job ${jobId} failed: ${job.error ?? "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new AnakinError(`Anakin job ${jobId} did not complete within ${timeoutMs}ms.`);
}
