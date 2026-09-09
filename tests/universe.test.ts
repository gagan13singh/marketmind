import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NSE_UNIVERSE, BY_TICKER } from "@/lib/data/nse-universe";
import { displaySymbol, normalizeSymbol, SECTORS, SCAN_TIER_OPTIONS } from "@/lib/data/symbols";
import {
  INDICATORS,
  INDICATOR_PRESETS,
  OVERLAY_INDICATORS,
  PANE_INDICATORS,
  getIndicator,
  isIndicatorId,
} from "@/lib/indicators/catalog";
import { PRESETS, SCREENER_FIELDS, FIELD_MAP, presetToRules } from "@/lib/screener";
import { STRATEGIES } from "@/lib/backtest";

/**
 * These guard the two things most likely to rot: the symbol table (which is
 * generated, so a bad regeneration should fail loudly) and the client/server
 * constant pairs that have to stay in sync by hand.
 */

describe("NSE universe", () => {
  test("carries the full listed universe, not a curated shortlist", () => {
    // The bug this replaced shipped 110 names. Anything near that is a regression.
    assert.ok(NSE_UNIVERSE.length > 2500, `expected >2500 symbols, got ${NSE_UNIVERSE.length}`);
  });

  test("includes the household names a user would try first", () => {
    for (const ticker of ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ETERNAL", "BSE"]) {
      assert.ok(BY_TICKER.has(ticker), `${ticker} should be in the universe`);
    }
  });

  test("every row is well formed", () => {
    for (const u of NSE_UNIVERSE) {
      assert.match(u.ticker, /^[A-Z0-9&-]+$/, `bad ticker: ${u.ticker}`);
      assert.equal(u.symbol, `${u.ticker}.NS`);
      assert.ok(u.name.length > 0, `empty name for ${u.ticker}`);
      assert.ok(SECTORS.includes(u.sector), `unknown sector "${u.sector}" on ${u.ticker}`);
      assert.ok(["equity", "etf", "sme"].includes(u.kind));
      assert.ok(Number.isFinite(u.turnoverLacs) && u.turnoverLacs >= 0);
    }
  });

  test("has no duplicate tickers", () => {
    assert.equal(BY_TICKER.size, NSE_UNIVERSE.length);
  });

  test("is ordered by descending liquidity", () => {
    for (let i = 1; i < NSE_UNIVERSE.length; i += 1) {
      assert.ok(
        NSE_UNIVERSE[i - 1].turnoverLacs >= NSE_UNIVERSE[i].turnoverLacs,
        `order breaks at index ${i}`,
      );
    }
  });

  test("SECTORS covers exactly the sectors in use", () => {
    const used = new Set(NSE_UNIVERSE.map((u) => u.sector));
    for (const s of used) assert.ok(SECTORS.includes(s), `SECTORS is missing "${s}"`);
    for (const s of SECTORS) assert.ok(used.has(s), `SECTORS lists unused sector "${s}"`);
  });
});

describe("symbol normalisation", () => {
  test("defaults bare tickers to NSE", () => {
    assert.equal(normalizeSymbol("reliance"), "RELIANCE.NS");
    assert.equal(normalizeSymbol("  tcs  "), "TCS.NS");
  });

  test("leaves qualified symbols and indices alone", () => {
    assert.equal(normalizeSymbol("RELIANCE.NS"), "RELIANCE.NS");
    assert.equal(normalizeSymbol("TCS.BO"), "TCS.BO");
    assert.equal(normalizeSymbol("^NSEI"), "^NSEI");
  });

  test("is idempotent", () => {
    for (const input of ["reliance", "RELIANCE.NS", "^NSEI", "M&M"]) {
      assert.equal(normalizeSymbol(normalizeSymbol(input)), normalizeSymbol(input));
    }
  });

  test("displaySymbol strips only exchange suffixes", () => {
    assert.equal(displaySymbol("RELIANCE.NS"), "RELIANCE");
    assert.equal(displaySymbol("TCS.BO"), "TCS");
    assert.equal(displaySymbol("^NSEI"), "^NSEI");
  });
});

describe("indicator catalogue", () => {
  test("splits cleanly into overlays and panes", () => {
    assert.equal(OVERLAY_INDICATORS.length + PANE_INDICATORS.length, INDICATORS.length);
    assert.ok(OVERLAY_INDICATORS.length > 0);
    assert.ok(PANE_INDICATORS.length > 0);
  });

  test("ids are unique and resolvable", () => {
    const ids = INDICATORS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.ok(isIndicatorId(id));
      assert.ok(getIndicator(id));
    }
  });

  test("rejects unknown ids", () => {
    assert.equal(isIndicatorId("not-an-indicator"), false);
    assert.equal(isIndicatorId(undefined), false);
  });

  test("every preset references real indicators", () => {
    for (const preset of INDICATOR_PRESETS) {
      for (const id of preset.ids) {
        assert.ok(isIndicatorId(id), `preset "${preset.id}" references unknown "${id}"`);
      }
    }
  });

  test("a naked chart is an available preset", () => {
    const naked = INDICATOR_PRESETS.find((p) => p.ids.length === 0);
    assert.ok(naked, "there must be a zero-indicator preset");
  });
});

describe("screener presets", () => {
  test("there are as many ready-made screens as backtest strategies", () => {
    assert.equal(PRESETS.length, STRATEGIES.length);
  });

  test("preset ids are unique", () => {
    const ids = PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("every rule targets a field the engine computes", () => {
    for (const preset of PRESETS) {
      for (const rule of preset.rules) {
        assert.ok(FIELD_MAP.has(rule.field), `preset "${preset.id}" uses unknown field "${rule.field}"`);
      }
    }
  });

  test("between rules always carry an upper bound", () => {
    for (const preset of PRESETS) {
      for (const rule of preset.rules) {
        if (rule.operator === "between") {
          assert.equal(typeof rule.value2, "number", `preset "${preset.id}" has an open-ended between`);
        }
      }
    }
  });

  test("presetToRules assigns stable unique ids", () => {
    for (const preset of PRESETS) {
      const rules = presetToRules(preset);
      assert.equal(rules.length, preset.rules.length);
      assert.equal(new Set(rules.map((r) => r.id)).size, rules.length);
    }
  });

  test("field keys are unique", () => {
    const keys = SCREENER_FIELDS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("full-universe scan is actually reachable", () => {
  /**
   * The "everything" tier is only meaningful if a resumed scan can converge.
   * Two settings quietly prevented that: a cache smaller than the universe
   * evicted its own earliest results, and a history TTL shorter than the scan
   * expired them. Either one makes the scan run forever without finishing, and
   * neither shows up as an error — so both are pinned here.
   */
  test("cache capacity exceeds the universe size", async () => {
    const { cacheStats } = await import("@/lib/data/service");
    const { screenerUniverse } = await import("@/lib/data/universe");

    const universe = screenerUniverse("all").length;
    const { capacity } = cacheStats();

    assert.ok(
      capacity > universe,
      `cache holds ${capacity} entries but the full scan needs ${universe}; it can never converge`,
    );
  });

  test("the all tier really means all — nothing is silently dropped", async () => {
    const { screenerUniverse } = await import("@/lib/data/universe");
    const { NSE_UNIVERSE: full } = await import("@/lib/data/nse-universe");

    assert.equal(screenerUniverse("all").length, full.length);
    // The ranked tiers stay equity-only, which is the deliberate difference.
    assert.ok(screenerUniverse("full").length < full.length);
  });

  test("ranked tiers are strictly nested and ordered", async () => {
    const { screenerUniverse } = await import("@/lib/data/universe");
    const liquid = screenerUniverse("liquid");
    const broad = screenerUniverse("broad");
    const deep = screenerUniverse("full");

    assert.ok(liquid.length < broad.length && broad.length < deep.length);
    // A deeper tier must extend the shallower one, not reshuffle it.
    assert.deepEqual(
      broad.slice(0, liquid.length).map((u) => u.symbol),
      liquid.map((u) => u.symbol),
    );
  });
});

describe("client/server constant pairs", () => {
  test("scan tiers match the server definition", async () => {
    // Imported lazily: the server module pulls in the full symbol table.
    const { SCAN_TIERS } = await import("@/lib/data/universe");
    const serverIds = Object.keys(SCAN_TIERS).sort();
    const clientIds = SCAN_TIER_OPTIONS.map((t) => t.id).sort();
    assert.deepEqual(clientIds, serverIds);

    for (const option of SCAN_TIER_OPTIONS) {
      const server = SCAN_TIERS[option.id];
      assert.equal(option.label, server.label, `label drift on "${option.id}"`);
      assert.equal(option.description, server.description, `description drift on "${option.id}"`);
    }
  });
});
