/**
 * Runs the ingest script end to end against a stand-in for NSE.
 *
 * Verifies three separate things that were previously untested:
 *   1. the script starts at all under plain Node (the server-only crash)
 *   2. the NSE field mappings actually produce a populated snapshot
 *   3. the app then reads the dataset as live rather than sample data
 *
 * Everything runs in one process with a hard timeout so a hung child cannot
 * wedge the session.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

const PORT = 4801;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hash = (s) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 97;
  return h + 3;
};

/** Eight consecutive quarters ending Jun-2026, in NSE's own shape. */
function quarters(seed) {
  const rows = [];
  const ends = [
    [2024, 8], [2024, 11], [2025, 2], [2025, 5],
    [2025, 8], [2025, 11], [2026, 2], [2026, 5],
  ];
  ends.forEach(([year, month], i) => {
    const day = [3, 5, 8, 10].includes(month) ? 30 : 31;
    const scale = 1 + i * 0.05;
    rows.push({
      re_to_dt: `${day}-${MONTHS[month]}-${year}`,
      re_total_inc: String(Math.round(seed * 1200 * scale)), // rupee lakhs
      re_pro_loss_bef_tax: String(Math.round(seed * 210 * scale)),
      re_pro_loss_aft_tax: String(Math.round(seed * 155 * scale)),
      re_basic_eps_for_cont_dis_opr: (seed * 0.9 * scale).toFixed(2),
      re_audited: i === 3 ? "Audited Consolidated" : "Unaudited Consolidated",
    });
  });
  return rows;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const symbol = (url.searchParams.get("symbol") ?? "X").toUpperCase();
  const seed = hash(symbol);

  // Any HTML page hands out the session cookie, as NSE does.
  if (!url.pathname.startsWith("/api/")) {
    res.writeHead(200, {
      "content-type": "text/html",
      "set-cookie": ["nsit=abc123; Path=/", "nseappid=xyz789; Path=/"],
    });
    res.end("<html></html>");
    return;
  }

  // And every /api call without one is refused, as NSE does.
  if (!(req.headers.cookie ?? "").includes("nseappid")) {
    res.writeHead(401).end("{}");
    return;
  }

  const json = (o) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(o));
  };

  if (url.pathname === "/api/results-comparision") return json({ resCmpData: quarters(seed) });

  if (url.pathname === "/api/corporate-share-holdings-master") {
    return json({
      data: [
        {
          date: "31-Mar-2026",
          pr_and_prgrp: "41.00", foreignInstitutions: "5.00",
          domesticInstitutions: "4.00", public_val: "50.00", pledged: "0.00",
        },
        {
          // Deliberately out of order — the client must sort to the newest.
          date: "30-Jun-2026",
          pr_and_prgrp: (40 + (seed % 30)).toFixed(2),
          foreignInstitutions: (seed % 18).toFixed(2),
          domesticInstitutions: (seed % 12).toFixed(2),
          public_val: (60 - (seed % 30)).toFixed(2),
          pledged: (seed % 5).toFixed(2),
        },
      ],
    });
  }

  if (url.pathname === "/api/equity-meta-info") {
    return json({
      companyName: `${symbol} Limited`,
      industryInfo: { macro: "Industrials", sector: "Capital Goods", basicIndustry: "Electronic Equipments" },
    });
  }

  res.writeHead(404).end("{}");
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`mock NSE listening on ${PORT}\n`);

await rm("data/fundamentals.json", { force: true });

function runIngest(args) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--conditions=react-server",
        "--experimental-loader",
        "./scripts/ts-loader.mjs",
        "scripts/ingest-fundamentals.mjs",
        ...args,
      ],
      { env: { ...process.env, NSE_API_BASE: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] },
    );

    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));

    const kill = setTimeout(() => child.kill("SIGKILL"), 90_000);
    child.on("close", (code) => {
      clearTimeout(kill);
      resolve({ code, out });
    });
  });
}

console.log("=== RUN 1: --limit 6 ===");
const first = await runIngest(["--limit", "6", "--delay", "0"]);
console.log(first.out.split("\n").filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)).join("\n"));
console.log(`exit code: ${first.code}`);

if (first.code === 0) {
  const dataset = JSON.parse(await readFile("data/fundamentals.json", "utf8"));
  const tickers = Object.keys(dataset.companies);
  console.log(`\n=== DATASET ===`);
  console.log(`builtAt: ${dataset.builtAt}`);
  console.log(`sources: ${dataset.sources.join(", ")}`);
  console.log(`companies: ${tickers.length} — ${tickers.join(", ")}`);

  if (tickers.length === 0) {
    console.log("\nNo companies were written — the run failed. Stopping here.");
    server.close();
    process.exit(1);
  }

  const one = dataset.companies[tickers[0]];
  console.log(`\n--- ${tickers[0]} ---`);
  console.log(`name           ${one.name}`);
  console.log(`sector         ${one.sector} / ${one.industry}`);
  console.log(`quarters       ${one.quarterly.length}  (${one.quarterly.map((q) => q.label).join(", ")})`);
  console.log(`annual (TTM)   ${one.annual.length}  (${one.annual.map((a) => a.label).join(", ")})`);
  const latest = one.annual[one.annual.length - 1];
  console.log(`latest revenue Rs ${(latest.revenue / 1e7).toFixed(1)} cr   net Rs ${(latest.netProfit / 1e7).toFixed(1)} cr`);
  console.log(`net margin     ${latest.netMargin?.toFixed(1)}%`);
  console.log(`revenue YoY    ${one.growth.revenueYoy?.toFixed(1)}%`);
  console.log(`profit YoY     ${one.growth.profitYoy?.toFixed(1)}%`);
  console.log(`shareholding   promoter ${one.shareholding.promoter}%  FII ${one.shareholding.fii}%  DII ${one.shareholding.dii}%  pledged ${one.shareholding.pledgedPercent}%  asOf ${one.shareholding.asOf}`);
  console.log(`balanceSheet   ${one.balanceSheet.length} rows (expected 0 — XBRL not walked)`);

  console.log("\n=== RUN 2: --resume should skip everything already present ===");
  const second = await runIngest(["--limit", "6", "--delay", "0", "--resume"]);
  const skipLine = second.out.split("\n").find((l) => /skipped/.test(l));
  console.log(skipLine?.trim() ?? "(no progress line)");

  console.log("\n=== DOES THE APP READ IT AS LIVE? ===");
  const { getFundamentals } = await import("@/lib/data/service");
  const { analyzeFundamental } = await import("@/lib/analysis/fundamental");
  const result = await getFundamentals(`${tickers[0]}.NS`);
  console.log(`origin:   ${result.origin}`);
  console.log(`provider: ${result.provider}`);
  console.log(`asOf:     ${result.asOf}`);
  const analysis = analyzeFundamental(result.data);
  console.log(`score:    ${analysis.compositeScore.toFixed(0)} / confidence ${analysis.confidence}%`);
  const gap = analysis.narrativePoints.find((p) => p.label === "Data gaps");
  console.log(`gap note: ${gap ? "present" : "MISSING"}`);
}

server.close();
console.log("");
process.exit(0);
