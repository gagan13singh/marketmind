import { NextResponse } from "next/server";
import { cacheStats, getHistory, getQuote } from "@/lib/data/service";
import { angelProbe, angelStatus, clearAngelSession } from "@/lib/data/angel";
import { UNIVERSE_SIZE } from "@/lib/data/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Live-data diagnostics.
 *
 * The most confusing failure mode of this app is silently serving generated
 * numbers. Hit `/api/health` to find out exactly why that is happening — the
 * four likely causes (missing credentials, a rejected login, an unloaded
 * instrument master, and rate limiting) need four different fixes, so the
 * response names which one you have.
 *
 * `RELIANCE.NS` is the probe symbol: the most liquid name on the exchange, so
 * a failure there is a connection problem rather than a symbol problem.
 */

const PROBE = "RELIANCE.NS";

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const started = Date.now();
  const value = await fn();
  return { ms: Date.now() - started, value };
}

export async function GET(request: Request) {
  const startedAt = new Date().toISOString();
  const deep = new URL(request.url).searchParams.get("deep") !== "false";

  const forced = process.env.MARKETMIND_FORCE_SAMPLE === "true";
  const before = angelStatus();

  // A health check answers "does this work RIGHT NOW", so by default it forces
  // a fresh login rather than reporting on a cached session.
  if (deep && before.configured && !forced) clearAngelSession();

  const skipped = {
    ok: false,
    message: "Skipped.",
    login: { ok: false, message: "Skipped." },
    instruments: { ok: false, pending: false, count: 0, message: "Skipped." },
  };

  const probe =
    deep && before.configured && !forced
      ? await timed(() =>
          angelProbe().catch((e: Error) => ({ ...skipped, message: e.message })),
        )
      : { ms: 0, value: skipped };

  const [history, quote] = await Promise.all([
    timed(() => getHistory(PROBE, "daily", "1y")),
    timed(() => getQuote(PROBE)),
  ]);

  const status = angelStatus();
  const live = history.value.origin === "live";

  return NextResponse.json(
    {
      status: forced ? "forced-sample" : live ? "live" : "degraded",
      startedAt,
      universeSize: UNIVERSE_SIZE,
      forceSample: forced,
      probe: PROBE,

      angelOne: {
        configured: status.configured,
        missingEnvVars: status.missing,
        authenticated: status.authenticated,
        authError: status.authError,
        probeOk: probe.value.ok,
        probeMessage: probe.value.message,
        probeMs: probe.ms,

        // Login and the instrument master fail independently and need
        // different fixes, so they are reported separately rather than
        // collapsed into one "it didn't work".
        login: probe.value.login,
        instrumentMaster: probe.value.instruments,

        instruments: status.instruments,
        requestsLeftThisMinute: status.rateLimitHeadroom,
      },

      cache: cacheStats(),

      resolved: {
        history: {
          origin: history.value.origin,
          provider: history.value.provider ?? null,
          bars: history.value.data.length,
          asOf: history.value.asOf ?? null,
          notice: history.value.notice ?? null,
          ms: history.ms,
        },
        quote: {
          origin: quote.value.origin,
          provider: quote.value.provider ?? null,
          price: quote.value.data.price,
          ms: quote.ms,
        },
      },

      advice: buildAdvice({ forced, live, status, probe: probe.value }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Name the specific problem, because each one has a different fix. */
function buildAdvice({
  forced,
  live,
  status,
  probe,
}: {
  forced: boolean;
  live: boolean;
  status: ReturnType<typeof angelStatus>;
  probe: { login: { ok: boolean; message: string }; instruments: { ok: boolean; pending: boolean; message: string } };
}): string | undefined {
  if (forced) {
    return "MARKETMIND_FORCE_SAMPLE is set to true. Unset it to fetch live data from Angel One.";
  }
  if (live) return undefined;

  if (!status.configured) {
    return `Angel One is not configured. Set ${status.missing.join(", ")} in your environment, then restart. See .env.example for where each value comes from.`;
  }

  // Credentials first: it is the question people actually want answered, and
  // it is independent of everything else.
  if (!probe.login.ok) {
    return `Login is failing: ${probe.login.message} Check the client code and PIN, and that ANGEL_TOTP_SECRET is the base32 secret behind the QR code rather than a six-digit code.`;
  }

  if (probe.instruments.pending) {
    return "Your credentials are fine — login succeeded. The instrument master is still downloading; it is tens of megabytes and continues in the background. Reload this endpoint in a minute. If it keeps timing out, raise ANGEL_SCRIP_TIMEOUT_MS.";
  }

  if (!probe.instruments.ok) {
    return `Your credentials are fine — login succeeded. The instrument master could not be loaded: ${probe.instruments.message} Without it, tickers cannot be resolved to tokens. Check outbound access to margincalculator.angelone.in, and raise ANGEL_SCRIP_TIMEOUT_MS if this is a timeout.`;
  }

  return `Login and instruments are both fine, but the data request returned nothing: ${probe.login.message} Check that Historical Data is enabled for this API key in the SmartAPI dashboard.`;
}
