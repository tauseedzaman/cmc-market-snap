function cleanText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }
  
  function pickFirstText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = cleanText(el?.textContent);
      if (t) return t;
    }
    return "";
  }
  
  function findValueNearLabel(labelRegex) {
    // Scan for elements containing label text, then look around for a value.
    const all = Array.from(document.querySelectorAll("div,span,p,li"));
    const labelEl = all.find((el) => labelRegex.test(cleanText(el.textContent)));
    if (!labelEl) return "";
  
    // try next siblings / parent region
    const candidates = [];
    if (labelEl.nextElementSibling) candidates.push(labelEl.nextElementSibling);
    if (labelEl.parentElement) candidates.push(labelEl.parentElement);
    if (labelEl.closest("section")) candidates.push(labelEl.closest("section"));
  
    for (const c of candidates) {
      const text = cleanText(c.textContent);
      // pick something that looks like a number / money / percent
      const m = text.match(/(\$?\d[\d,]*\.?\d*\s?[TBM]?)\s*(?:\(([-+]\d+\.?\d*)%\))?/);
      if (m && m[1]) return m[1];
    }
  
    return "";
  }
  
  function parseTopCoins(limit = 5) {
    // On CMC top page, there is a table. We'll pick first rows and extract:
    // name, symbol, price, 24h, 7d
    const rows = Array.from(document.querySelectorAll("table tbody tr")).slice(0, limit);
    const coins = [];
  
    for (const r of rows) {
      const tds = Array.from(r.querySelectorAll("td"));
      const rowText = cleanText(r.textContent);
  
      // naive extraction by looking at common patterns
      // Try to find symbol like BTC, ETH etc.
      const sym = (rowText.match(/\b[A-Z0-9]{2,6}\b/) || [])[0] || "";
  
      // Price usually has $ and digits
      const price = (rowText.match(/\$\s?\d[\d,]*\.?\d*/) || [])[0] || "";
  
      // 24h and 7d percentages (first two % occurrences)
      const perc = rowText.match(/[-+]?[\d.]+%/g) || [];
      const p24 = perc[0] || "";
      const p7 = perc[1] || "";
  
      // Name: try first anchor text in row
      const name = cleanText(r.querySelector("a")?.textContent) || "";
  
      coins.push({
        name: name || sym || "—",
        symbol: sym,
        price,
        change24h: p24,
        change7d: p7
      });
    }
  
    return coins;
  }
  function collectCMC() {
    const global = document.querySelector('[data-test="global-stats"]');
  
    if (!global) {
      throw new Error("Global stats not found (wrong page or DOM not ready)");
    }
  
    const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  
    const data = {
      source: "coinmarketcap.com",
      capturedAt: new Date().toISOString(),
      marketCap: text(global.querySelector('[data-test="mkt-cap-num"]')),
      marketCapChange: text(global.querySelector('[data-test="mkt-cap-percentage-change"]')),
      volume24h: text(global.querySelector('[data-test="24h-vol-num"]')),
      volumeChange: text(global.querySelector('[data-test="24h-vol-percentage-change"]')),
      btcDominance: text(global.querySelector('[data-test="btc-dominance-num"]')),
      ethDominance: text(global.querySelector('[data-test="eth-dominance-num"]')),
      fearGreed: text(global.querySelector('[data-test="fear-greed-index-num"]')),
      coins: []
    };
  
    document.querySelectorAll("tbody tr").forEach((tr, i) => {
      if (i >= 5) return;
  
      const tds = tr.querySelectorAll("td");
      if (!tds.length) return;
  
      data.coins.push({
        rank: text(tds[1]),
        name: text(tr.querySelector(".coin-item-name")),
        symbol: text(tr.querySelector(".coin-item-symbol")),
        price: text(tds[3]),
        change24h: text(tds[5]),
        change7d: text(tds[6])
      });
    });
  
    return data;
  }
  
  function xcollectCMC() {
    // These selectors may break over time — that's why we also have label-fallback.
    const marketCap = pickFirstText([
      '[data-role="market-cap"]',
      'a[href="/charts/"] + div',
      'div:has(> div:contains("Market Cap"))' // not supported in all browsers
    ]) || findValueNearLabel(/market cap/i);
  
    const fearGreed = pickFirstText([
      'div:contains("Fear & Greed")',
    ]);
  
    const fearValue =
      (document.body.innerText.match(/\bFear\s*&\s*Greed\b[\s\S]{0,80}\b(\d{1,3})\b/i) || [])[1] || "";
  
    const rsiValue =
      (document.body.innerText.match(/\bAverage Crypto RSI\b[\s\S]{0,80}\b(\d{1,3}\.?\d*)\b/i) || [])[1] || "";
  
    const cmc20 =
      (document.body.innerText.match(/\bCMC20\b[\s\S]{0,80}\b(\$?\d[\d,.]*)\b/i) || [])[1] || "";
  
    // altcoin season index often shown like 29/100
    const altSeason =
      (document.body.innerText.match(/\bAltcoin Season\b[\s\S]{0,80}\b(\d{1,3})\s*\/\s*100\b/i) || [])[1] || "";
  
    const coins = parseTopCoins(5);
  
    return {
      source: "coinmarketcap.com",
      capturedAt: new Date().toISOString(),
      marketCap: marketCap || "",
      cmc20: cmc20 || "",
      fearGreed: fearValue ? `${fearValue}/100` : "",
      avgRsi: rsiValue || "",
      altSeason: altSeason ? `${altSeason}/100` : "",
      coins
    };
  }
  
  // Message handler from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CMC_CAPTURE") {
      try {
        const data = collectCMC();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    }
    return true;
  });
  