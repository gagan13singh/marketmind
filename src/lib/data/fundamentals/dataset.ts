import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FundamentalSnapshot } from "@/types";

/**
 * The committed fundamentals dataset.
 *
 * This is the answer to "where do 3,000+ companies' financials come from for
 * free", and the answer is deliberately not "fetch them when someone asks".
 *
 * Every free source for Indian statements — NSE's own API, BSE's, Yahoo —
 * either rate limits to a few requests per second, requires a browser-style
 * session, or refuses datacenter IP ranges outright. A Vercel function is a
 * datacenter IP. That combination is not a bug to be worked around at request
 * time; it is the reason the page has been showing sample data.
 *
 * So the fetching moves off the request path entirely. `npm run ingest:fundamentals`
 * walks the universe from a machine NSE will talk to — a laptop, or a GitHub
 * Actions runner — and writes this file. The app then reads it from disk with
 * no network call at all, which makes the fundamentals page the fastest page
 * in the product rather than the slowest, and costs nothing to run.
 *
 * The trade-off is honest and stated in the UI: figures are as of the last
 * ingest, not as of this second. For statements filed quarterly, that is the
 * correct granularity anyway — a balance sheet does not change between
 * page views.
 */

/** Where the ingest script writes, relative to the project root. */
const DATASET_PATH = path.join(process.cwd(), "data", "fundamentals.json");

export interface FundamentalsDataset {
  /** ISO timestamp of the ingest run that produced this file. */
  builtAt: string;
  /** Which sources contributed, for the provenance line in the UI. */
  sources: string[];
  /** Keyed by bare ticker, uppercase: `RELIANCE`, not `RELIANCE.NS`. */
  companies: Record<string, FundamentalSnapshot>;
}

type LoadState =
  | { status: "unloaded" }
  | { status: "missing"; reason: string }
  | { status: "ready"; dataset: FundamentalsDataset };

let state: LoadState = { status: "unloaded" };
let inFlight: Promise<LoadState> | null = null;

/**
 * Load the dataset once per instance.
 *
 * A missing file is a normal state, not an error: a fresh clone has not run
 * the ingest yet. It is recorded with a reason so `/api/health` can say
 * "run npm run ingest:fundamentals" instead of "unavailable".
 */
async function load(): Promise<LoadState> {
  try {
    const raw = await readFile(DATASET_PATH, "utf8");
    const parsed = JSON.parse(raw) as FundamentalsDataset;

    if (!parsed || typeof parsed !== "object" || !parsed.companies) {
      return { status: "missing", reason: "data/fundamentals.json is present but malformed." };
    }

    const count = Object.keys(parsed.companies).length;
    if (count === 0) {
      return { status: "missing", reason: "data/fundamentals.json contains no companies." };
    }

    return { status: "ready", dataset: parsed };
  } catch (err) {
    const message = (err as NodeJS.ErrnoException).code === "ENOENT"
      ? "No fundamentals dataset has been built yet. Run `npm run ingest:fundamentals` to create data/fundamentals.json."
      : `Could not read data/fundamentals.json: ${(err as Error).message}`;
    return { status: "missing", reason: message };
  }
}

async function ensureLoaded(): Promise<LoadState> {
  if (state.status !== "unloaded") return state;
  if (inFlight) return inFlight;

  inFlight = load()
    .then((next) => {
      state = next;
      return next;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Look up one company. Returns null when the dataset has no row for it. */
export async function datasetFundamentals(
  symbol: string,
): Promise<{ snapshot: FundamentalSnapshot; builtAt: string } | null> {
  const loaded = await ensureLoaded();
  if (loaded.status !== "ready") return null;

  const ticker = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const snapshot = loaded.dataset.companies[ticker];
  return snapshot ? { snapshot, builtAt: loaded.dataset.builtAt } : null;
}

/** Diagnostics for `/api/health`. Never throws, never fetches. */
export async function datasetStatus(): Promise<{
  available: boolean;
  companies: number;
  builtAt: string | null;
  ageDays: number | null;
  sources: string[];
  reason: string | null;
}> {
  const loaded = await ensureLoaded();

  if (loaded.status !== "ready") {
    return {
      available: false,
      companies: 0,
      builtAt: null,
      ageDays: null,
      sources: [],
      reason: loaded.status === "missing" ? loaded.reason : "Not loaded.",
    };
  }

  const builtAt = loaded.dataset.builtAt;
  const parsed = Date.parse(builtAt);

  return {
    available: true,
    companies: Object.keys(loaded.dataset.companies).length,
    builtAt,
    ageDays: Number.isFinite(parsed) ? Math.round((Date.now() - parsed) / 86_400_000) : null,
    sources: loaded.dataset.sources ?? [],
    reason: null,
  };
}

/** Test helper. Not used by application code. */
export function resetDataset(): void {
  state = { status: "unloaded" };
}
