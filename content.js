function cleanText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function text(el) {
  return cleanText(el?.textContent || "");
}

function waitFor(selector, { timeout = 8000, interval = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(t);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(t);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, interval);
  });
}

function buildHeaderIndexMap(table) {
  // Map header text -> column index
  const map = {};
  const thead = table.querySelector("thead");
  const ths = Array.from(thead?.querySelectorAll("tr th") || []);

  ths.forEach((th, idx) => {
    const label = cleanText(th.innerText || th.textContent || "");
    if (!label) return;
    map[label.toLowerCase()] = idx;
  });

  return map;
}

function findCol(map, variants) {
  // variants: ["1h", "1 h", "hour", "1 hour"] etc.
  const keys = Object.keys(map);
  for (const v of variants) {
    const k = v.toLowerCase();
    // exact match
    if (map[k] != null) return map[k];
    // fuzzy contains match
    const hit = keys.find(x => x.includes(k));
    if (hit) return map[hit];
  }
  return null;
}

function parsePercentFromCell(cellText) {
  const m = String(cellText || "").match(/[-+]?\d+(\.\d+)?%/);
  return m ? m[0] : "";
}

function parsePriceFromCell(cellText) {
  // keep exactly as seen, but try to extract a nice $... string when possible
  const t = String(cellText || "").trim();
  const m = t.match(/\$\s?[\d,.]+/);
  return m ? m[0].replace(/\s+/g, "") : t;
}

function collectFromTopTable({ limit = 20 } = {}) {
  const table = document.querySelector("table");
  if (!table) throw new Error("Table not found");

  const headerMap = buildHeaderIndexMap(table);

  // Try to detect columns by label
  const colRank = findCol(headerMap, ["#", "rank"]);
  const colName = findCol(headerMap, ["name"]);
  const colPrice = findCol(headerMap, ["price"]);
  const col1h = findCol(headerMap, ["1h", "1 h", "1 hour"]);
  const col24h = findCol(headerMap, ["24h", "24 h", "24 hours"]);
  const col7d = findCol(headerMap, ["7d", "7 d", "7 days"]);
  const col30d = findCol(headerMap, ["30d", "30 d", "30 days"]);
  const col90d = findCol(headerMap, ["90d", "90 d", "90 days"]);

  const tbodyRows = Array.from(table.querySelectorAll("tbody tr")).slice(0, limit);

  const coins = tbodyRows.map(tr => {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (!tds.length) return null;

    // Symbol & Name are often inside these classes
    const name = text(tr.querySelector(".coin-item-name")) || text(tr.querySelector('a[href*="/currencies/"]')) || "";
    const symbol = text(tr.querySelector(".coin-item-symbol")) || "";

    // fallback: sometimes rank is in td[1] etc. We'll use detected index when available
    const rank = colRank != null ? text(tds[colRank]) : "";

    const priceCell = colPrice != null ? text(tds[colPrice]) : "";
    const price = parsePriceFromCell(priceCell);

    const c1h  = col1h  != null ? parsePercentFromCell(text(tds[col1h]))  : "";
    const c24h = col24h != null ? parsePercentFromCell(text(tds[col24h])) : "";
    const c7d  = col7d  != null ? parsePercentFromCell(text(tds[col7d]))  : "";
    const c30d = col30d != null ? parsePercentFromCell(text(tds[col30d])) : "";
    const c90d = col90d != null ? parsePercentFromCell(text(tds[col90d])) : "";

    return {
      rank,
      name: name || symbol || "—",
      symbol: symbol || "",
      price: price || "",
      change1h: c1h || "",
      change24h: c24h || "",
      change7d: c7d || "",
      change30d: c30d || "",
      change90d: c90d || ""
    };
  }).filter(Boolean);

  // Tell renderer what exists on THIS page right now
  const tableColumns = {
    has1h: col1h != null,
    has24h: col24h != null,
    has7d: col7d != null,
    has30d: col30d != null,
    has90d: col90d != null
  };

  return { coins, tableColumns };
}

function parseNumberPct(v) {
  const m = String(v || "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function computeMovers(coins, { limit = 5 } = {}) {
  const withPct = coins
    .map(c => ({ ...c, _pct: parseNumberPct(c.change24h) }))
    .filter(c => typeof c._pct === "number");

  const gainers = [...withPct].sort((a,b) => b._pct - a._pct).slice(0, limit).map(({_pct, ...rest}) => rest);
  const losers  = [...withPct].sort((a,b) => a._pct - b._pct).slice(0, limit).map(({_pct, ...rest}) => rest);

  return { gainers, losers };
}

async function collectCMC() {
  // Wait for global stats or table to exist (helps with “DOM not ready”)
  await waitFor('table', { timeout: 8000 });

  const global = document.querySelector('[data-test="global-stats"]');

  const data = {
    source: "coinmarketcap.com",
    capturedAt: new Date().toISOString(),

    marketCap: global ? text(global.querySelector('[data-test="mkt-cap-num"]')) : "",
    marketCapChange: global ? text(global.querySelector('[data-test="mkt-cap-percentage-change"]')) : "",
    volume24h: global ? text(global.querySelector('[data-test="24h-vol-num"]')) : "",
    volumeChange: global ? text(global.querySelector('[data-test="24h-vol-percentage-change"]')) : "",
    btcDominance: global ? text(global.querySelector('[data-test="btc-dominance-num"]')) : "",
    ethDominance: global ? text(global.querySelector('[data-test="eth-dominance-num"]')) : "",
    fearGreed: global ? text(global.querySelector('[data-test="fear-greed-index-num"]')) : "",

    // Table data
    coins: [],
    tableColumns: {}
  };

  const { coins, tableColumns } = collectFromTopTable({ limit: 25 });
  data.coins = coins;
  data.tableColumns = tableColumns;

  // Movers computed from captured coins (renderer can filter ignore/stables later)
  const { gainers, losers } = computeMovers(coins, { limit: 5 });
  data.movers = { gainers, losers };

  return data;
}

// Message handler from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "CMC_CAPTURE") {
    (async () => {
      try {
        const data = await collectCMC();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true; // keep the message channel open for async
  }
});
