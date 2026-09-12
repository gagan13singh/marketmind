import "server-only";
import { generateTotp, secondsUntilNextWindow } from "./totp";
import {
  attemptsFor,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  type ProviderName,
} from "../circuit";

/**
 * Angel One SmartAPI transport layer.
 *
 * Responsibilities, in order of importance:
 *
 *  1. **Rate limiting.** SmartAPI enforces 3 requests/second and 180/minute on
 *     the historical endpoint, and it enforces them by returning errors rather
 *     than by queueing. A screener scan issues thousands of calls, so the
 *     limiter here is not a nicety — without it the scan simply fails.
 *  2. **Session management.** Login costs a TOTP and returns a JWT valid for
 *     roughly a trading day. Concurrent callers share one login rather than
 *     racing to authenticate, and a 401 mid-flight triggers exactly one
 *     re-login rather than one per in-flight request.
 *  3. **Honest failure.** Every helper reports why it failed so the health
 *     endpoint can tell you whether it is bad credentials, throttling, or a
 *     genuine outage — three problems with three different fixes.
 */

/**
 * Overridable so the integration can be pointed at a stand-in during testing
 * without touching application code. Unset in production, where it defaults to
 * the real gateway.
 */
const BASE = process.env.ANGEL_API_BASE?.trim() || "https://apiconnect.angelone.in";
const TIMEOUT_MS = 12_000;

/**
 * SmartAPI's documented ceilings for the historical endpoint. The per-second
 * budget is the binding one during a scan; the per-minute budget catches
 * sustained load.
 */
const RATE = {
  perSecond: 3,
  perMinute: 180,
};

export type AngelFailure =
  | "not-configured"
  /** Instrument master still downloading. Transient, and heals by itself. */
  | "loading"
  | "auth-failed"
  | "throttled"
  | "unauthorized"
  | "not-found"
  | "network"
  | "malformed";

export interface AngelCredentials {
  apiKey: string;
  clientCode: string;
  pin: string;
  totpSecret: string;
}

/** Read credentials from the environment. Returns null when unconfigured. */
export function readCredentials(): AngelCredentials | null {
  const apiKey = process.env.ANGEL_API_KEY?.trim();
  const clientCode = process.env.ANGEL_CLIENT_CODE?.trim();
  const pin = process.env.ANGEL_PIN?.trim();
  const totpSecret = process.env.ANGEL_TOTP_SECRET?.trim();

  if (!apiKey || !clientCode || !pin || !totpSecret) return null;
  return { apiKey, clientCode, pin, totpSecret };
}

export function isConfigured(): boolean {
  return readCredentials() !== null;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

class RateLimiter {
  private recent: number[] = [];
  private chain: Promise<void> = Promise.resolve();
  private readonly perSecond: number;
  private readonly perMinute: number;

  // Written out longhand rather than as constructor parameter properties,
  // which the plain Node type-stripping the test runner uses cannot parse.
  constructor(perSecond: number, perMinute: number) {
    this.perSecond = perSecond;
    this.perMinute = perMinute;
  }

  /**
   * Resolve when it is this caller's turn.
   *
   * Requests are serialised through a promise chain so that concurrent callers
   * queue in arrival order instead of all waking at once and immediately
   * breaching the limit again.
   */
  acquire(): Promise<void> {
    const turn = this.chain.then(() => this.waitForSlot());
    // Swallow errors so one rejection cannot poison the queue for everyone.
    this.chain = turn.catch(() => undefined);
    return turn;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.recent = this.recent.filter((t) => now - t < 60_000);

      const inLastSecond = this.recent.filter((t) => now - t < 1_000).length;
      const inLastMinute = this.recent.length;

      if (inLastSecond < this.perSecond && inLastMinute < this.perMinute) {
        this.recent.push(now);
        return;
      }

      // Sleep until the earliest relevant slot frees up.
      const waitForSecond =
        inLastSecond >= this.perSecond
          ? 1_000 - (now - this.recent[this.recent.length - this.perSecond])
          : 0;
      const waitForMinute = inLastMinute >= this.perMinute ? 60_000 - (now - this.recent[0]) : 0;

      await sleep(Math.max(25, waitForSecond, waitForMinute));
    }
  }

  /** How many requests are still available in the current minute. */
  remainingThisMinute(): number {
    const now = Date.now();
    this.recent = this.recent.filter((t) => now - t < 60_000);
    return Math.max(0, this.perMinute - this.recent.length);
  }
}

const limiter = new RateLimiter(RATE.perSecond, RATE.perMinute);

export function rateLimitHeadroom(): number {
  return limiter.remainingThisMinute();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

interface Session {
  jwt: string;
  feedToken: string | null;
  expires: number;
}

/** SmartAPI tokens last a trading day; refreshing hourly is comfortably safe. */
const SESSION_TTL_MS = 60 * 60 * 1000;

let session: Session | null = null;
let loginInFlight: Promise<Session | null> | null = null;
let lastLoginError: string | null = null;

export function lastAuthError(): string | null {
  return lastLoginError;
}

/**
 * SmartAPI requires these client-identity headers on every call. They are not
 * validated against anything real, but the gateway rejects requests that omit
 * them, so the values are static and deliberate.
 */
function baseHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": apiKey,
  };
}

async function login(creds: AngelCredentials): Promise<Session | null> {
  // A code generated in the last second of its window will be rejected by the
  // time it arrives. Waiting a moment is faster than a guaranteed failure.
  if (secondsUntilNextWindow() <= 2) await sleep(2_500);

  let totp: string;
  try {
    totp = generateTotp(creds.totpSecret);
  } catch (err) {
    lastLoginError = `TOTP secret is not valid base32: ${(err as Error).message}`;
    return null;
  }

  try {
    await limiter.acquire();
    const res = await fetch(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
      method: "POST",
      headers: baseHeaders(creds.apiKey),
      body: JSON.stringify({
        clientcode: creds.clientCode,
        password: creds.pin,
        totp,
        state: "marketmind",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    if (!text || text.trim().startsWith("<")) {
      lastLoginError = `Login returned a non-JSON response (HTTP ${res.status}).`;
      return null;
    }

    const json = JSON.parse(text) as {
      status?: boolean;
      message?: string;
      errorcode?: string;
      data?: { jwtToken?: string; feedToken?: string };
    };

    const jwt = json.data?.jwtToken;
    if (!json.status || !jwt) {
      lastLoginError = json.message
        ? `${json.message}${json.errorcode ? ` (${json.errorcode})` : ""}`
        : `Login rejected (HTTP ${res.status}).`;
      return null;
    }

    lastLoginError = null;
    return {
      // SmartAPI sometimes returns the token already prefixed with "Bearer ".
      jwt: jwt.replace(/^Bearer\s+/i, ""),
      feedToken: json.data?.feedToken ?? null,
      expires: Date.now() + SESSION_TTL_MS,
    };
  } catch (err) {
    lastLoginError = `Could not reach Angel One: ${(err as Error).message}`;
    return null;
  }
}

/** Get a valid session, logging in if needed. Concurrent callers share one login. */
async function getSession(creds: AngelCredentials, force = false): Promise<Session | null> {
  if (!force && session && Date.now() < session.expires) return session;
  if (loginInFlight) return loginInFlight;

  loginInFlight = login(creds)
    .then((s) => {
      session = s;
      return s;
    })
    .finally(() => {
      loginInFlight = null;
    });

  return loginInFlight;
}

/**
 * Force a login and report the outcome.
 *
 * Exists because the instrument master and the credentials fail independently,
 * and the health check used to conflate them: symbol resolution happens before
 * any authenticated call, so a failed scrip-master download meant login was
 * never attempted and the report said `authenticated: false, authError: null`
 * — which reads as "your credentials are wrong" when they may be perfect.
 */
export async function probeLogin(): Promise<{ ok: boolean; message: string }> {
  const creds = readCredentials();
  if (!creds) return { ok: false, message: "Credentials not set." };

  session = null;
  const active = await getSession(creds, true);

  return active
    ? { ok: true, message: "Login succeeded." }
    : { ok: false, message: lastLoginError ?? "Login failed." };
}

/** Drop the cached session. Used by the health endpoint to force a real login. */
export function clearSession(): void {
  session = null;
  lastLoginError = null;
}

export function hasSession(): boolean {
  return session !== null && Date.now() < session.expires;
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

export type AngelResult<T> = { ok: true; data: T } | { ok: false; reason: AngelFailure; message: string };

interface AngelEnvelope<T> {
  status?: boolean;
  message?: string;
  errorcode?: string;
  data?: T;
}

/**
 * Make an authenticated SmartAPI call.
 *
 * Retries are deliberately narrow: throttling and a stale token are worth
 * retrying, a rejected symbol is not. `attempts` stays low because the rate
 * limiter already paces the caller — piling retries on top of a throttle just
 * spends the minute budget faster.
 */
export async function angelRequest<T>(
  path: string,
  body: unknown,
  {
    attempts,
    method = "POST",
    circuit,
  }: { attempts?: number; method?: string; circuit?: ProviderName } = {},
): Promise<AngelResult<T>> {
  // During a full-universe scan the same failure would otherwise be rediscovered
  // thousands of times. Once a provider is known to be down, skipping is what
  // keeps the scan inside its time budget.
  if (circuit && isCircuitOpen(circuit)) {
    return { ok: false, reason: "throttled", message: "Skipping — Angel One is failing repeatedly." };
  }

  const maxAttempts = attempts ?? (circuit ? attemptsFor(circuit) : 3);
  const creds = readCredentials();
  if (!creds) {
    return {
      ok: false,
      reason: "not-configured",
      message: "Angel One credentials are not set. See .env.example.",
    };
  }

  let lastMessage = "Request failed.";
  let lastReason: AngelFailure = "network";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const active = await getSession(creds, attempt > 0 && lastReason === "unauthorized");
    if (!active) {
      return {
        ok: false,
        reason: "auth-failed",
        message: lastLoginError ?? "Angel One login failed.",
      };
    }

    try {
      await limiter.acquire();

      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...baseHeaders(creds.apiKey),
          Authorization: `Bearer ${active.jwt}`,
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        lastReason = "unauthorized";
        lastMessage = `Token rejected (HTTP ${res.status}).`;
        session = null;
        continue;
      }
      if (res.status === 429) {
        lastReason = "throttled";
        lastMessage = "Rate limited by Angel One.";
        await sleep(1_200 * (attempt + 1));
        continue;
      }

      const text = await res.text();
      if (!text || text.trim().startsWith("<")) {
        lastReason = "malformed";
        lastMessage = `Non-JSON response (HTTP ${res.status}).`;
        continue;
      }

      const json = JSON.parse(text) as AngelEnvelope<T>;

      if (json.status === false || json.data === undefined || json.data === null) {
        const code = json.errorcode ?? "";
        const message = json.message ?? "Angel One returned no data.";

        // AB1004 / AG8001 / AG8002 all mean the session is no longer valid.
        if (/AB1004|AG800[12]|Invalid Token|token.*expired/i.test(`${code} ${message}`)) {
          lastReason = "unauthorized";
          lastMessage = message;
          session = null;
          continue;
        }
        // Access-rate messages are worth backing off for.
        if (/rate|exceed|throttl/i.test(message)) {
          lastReason = "throttled";
          lastMessage = message;
          await sleep(1_200 * (attempt + 1));
          continue;
        }

        // Anything else is a legitimate "no such data" answer, not an outage:
        // the provider answered, so the circuit stays closed.
        if (circuit) recordSuccess(circuit);
        return { ok: false, reason: "not-found", message };
      }

      if (circuit) recordSuccess(circuit);
      return { ok: true, data: json.data };
    } catch (err) {
      lastReason = "network";
      lastMessage = (err as Error).message;
      await sleep(300 * (attempt + 1));
    }
  }

  if (circuit) recordFailure(circuit);
  return { ok: false, reason: lastReason, message: lastMessage };
}
