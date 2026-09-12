"use client";

import { useCallback, useEffect, useState } from "react";
import type { Candle, Quote, Sourced } from "@/types";

/**
 * Keeps the newest candle current while the page is open.
 *
 * The chart used to be a snapshot. Candles were serialised into the page by
 * the server and nothing on the client ever touched them again, so with a
 * ten-minute revalidate the chart could be ten minutes stale on arrival and
 * then stay frozen for as long as the tab stayed open — during a live session
 * the price moved underneath a bar that never redrew.
 *
 * This polls the quote endpoint and rebuilds today's bar from it. That is the
 * same trick the server uses for `withTodayBar`: open, high, low, last price
 * and volume are exactly a daily candle, and the quote endpoint has no
 * settlement lag.
 *
 * Three rules keep the polling honest rather than merely frequent:
 *
 *  1. **Only while the market is open.** Outside 09:15–15:30 IST on a weekday
 *     there is nothing new to fetch, so it does not ask.
 *  2. **Only while the tab is visible.** A backgrounded tab that keeps
 *     polling is spending someone's rate-limit budget on a chart nobody is
 *     looking at. It refreshes once on becoming visible again instead.
 *  3. **Never fabricate a session.** A quote whose OHLCV matches the last
 *     settled bar is stale data wearing a new timestamp — on a holiday the
 *     endpoint keeps returning the previous close — and is discarded.
 */

const POLL_MS = 30_000;

/** Civil time in IST, which is a fixed +05:30 with no daylight saving. */
function istParts(at = new Date()) {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
    weekday: ist.getUTCDay(),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

/**
 * True during NSE cash-market hours.
 *
 * A few minutes of slack on each side covers the pre-open session and the
 * closing-price window, where the quote still changes.
 */
export function isMarketOpen(at = new Date()): boolean {
  const { weekday, minutes } = istParts(at);
  if (weekday === 0 || weekday === 6) return false;
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 40;
}

/** Epoch ms for today's 09:15 IST open — where a settled daily bar is stamped. */
function sessionOpenMs(at = new Date()): number {
  const { year, month, day } = istParts(at);
  return Date.UTC(year, month - 1, day, 3, 45, 0);
}

function candleFromQuote(quote: Quote, time: number): Candle | null {
  const close = quote.price;
  if (!Number.isFinite(close) || close <= 0) return null;

  const open = quote.dayLow > 0 && quote.dayHigh > 0 ? quote.previousClose : close;
  const high = quote.dayHigh > 0 ? quote.dayHigh : close;
  const low = quote.dayLow > 0 ? quote.dayLow : close;

  return {
    time,
    open: Number.isFinite(open) && open > 0 ? open : close,
    high: Math.max(high, close),
    low: Math.min(low, close),
    close,
    volume: Number.isFinite(quote.volume) && quote.volume > 0 ? quote.volume : 0,
  };
}

/** Merge a freshly-built bar into a settled series. */
function withLatest(settled: Candle[], fresh: Candle | null): Candle[] {
  if (!fresh || settled.length === 0) return settled;

  const last = settled[settled.length - 1];
  const identical =
    last.open === fresh.open &&
    last.high === fresh.high &&
    last.low === fresh.low &&
    last.close === fresh.close &&
    last.volume === fresh.volume;

  if (identical) return settled;
  if (last.time === fresh.time) return [...settled.slice(0, -1), fresh];
  if (last.time > fresh.time) return settled;
  return [...settled, fresh];
}

export interface LiveCandles {
  candles: Candle[];
  /** When the last successful refresh landed. Null until the first one. */
  updatedAt: Date | null;
  /** True while a refresh is in flight. */
  refreshing: boolean;
  /** True when the hook is polling on a timer rather than sitting idle. */
  streaming: boolean;
  /** Set when the last refresh failed, so the UI can say so rather than lie. */
  error: string | null;
  /** Force a refresh regardless of session hours. */
  refresh: () => void;
}

export function useLiveCandles(symbol: string, initial: Candle[]): LiveCandles {
  const [candles, setCandles] = useState<Candle[]>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(() => isMarketOpen());

  /**
   * Reset when the symbol changes, during render rather than in an effect.
   *
   * A client-side navigation can reuse this component with a different stock's
   * candles. Patching the previous stock's history with the new stock's price
   * would draw a chart that never existed. Adjusting state directly while
   * rendering is the documented way to respond to a changed prop — doing it in
   * an effect instead costs an extra render and paints the stale series first.
   */
  const [renderedSymbol, setRenderedSymbol] = useState(symbol);
  if (renderedSymbol !== symbol) {
    setRenderedSymbol(symbol);
    setCandles(initial);
    setUpdatedAt(null);
    setError(null);
  }

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`quote responded ${res.status}`);

      const payload: Sourced<Quote> = await res.json();

      // A sample quote must never be merged into a live series. Doing so would
      // put a generated price on a real chart with nothing marking it.
      if (payload.origin !== "live") {
        setError("Live quote unavailable, so the chart is showing settled data only.");
        return;
      }

      const fresh = candleFromQuote(payload.data, sessionOpenMs());
      // `withLatest` returns the series untouched when it is empty, so there
      // is nothing to fall back to and no ref to keep in sync.
      setCandles((prev) => withLatest(prev, fresh));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh the quote.");
    } finally {
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function tick() {
      if (cancelled || document.visibilityState !== "visible") return;
      void refresh();
    }

    function schedule() {
      if (cancelled) return;
      stop();
      const active = isMarketOpen() && document.visibilityState === "visible";
      setStreaming(active);
      if (active) timer = setInterval(tick, POLL_MS);
    }

    // Deferred by a tick rather than run inline. Refreshing and scheduling both
    // set state, and doing that synchronously inside an effect body cascades an
    // extra render before the first paint has even settled.
    const kickoff = setTimeout(() => {
      if (isMarketOpen()) tick();
      schedule();
    }, 0);

    function onVisibility() {
      if (document.visibilityState === "visible" && isMarketOpen()) tick();
      schedule();
    }

    document.addEventListener("visibilitychange", onVisibility);

    // Re-evaluate at the top of each minute so the poller starts and stops on
    // its own across the opening and closing bells without a reload.
    const gate = setInterval(schedule, 60_000);

    return () => {
      cancelled = true;
      stop();
      clearTimeout(kickoff);
      clearInterval(gate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { candles, updatedAt, refreshing, streaming, error, refresh };
}
