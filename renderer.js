// 1) Manual ignore (you can extend anytime)
const DEFAULT_IGNORE_SYMBOLS = new Set([
    "USDT", "USDC", "DAI", "TUSD", "FDUSD", "USDE", "BUSD", "PYUSD", "FRAX", "LUSD",
    "USDP", "GUSD", "SUSD", "USDD", "EURT", "EURS", "XAUT", "CMC20"
]);


function drawRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawText(ctx, text, x, y, size, color, weight = 700, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
}

function isNegative(str) {
    return typeof str === "string" && str.trim().startsWith("-");
}
function changeColor(v) {
    if (v == null || v === "—") return "rgba(232,240,255,0.68)";
    return isNegative(v) ? "#ff6b6b" : "#5CFFB1";
}

function parsePct(v) {
    if (!v) return null;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}

function computeBreadth(coins) {
    let up = 0, down = 0, flat = 0;
    coins.forEach(c => {
        const p = parsePct(c.change24h);
        if (p > 0) up++;
        else if (p < 0) down++;
        else flat++;
    });
    return { up, down, flat };
}

function topMovers(coins, dir = "up", limit = 3) {
    return [...coins]
        .map(c => ({ ...c, pct: parsePct(c.change24h) }))
        .filter(c => typeof c.pct === "number")
        .sort((a, b) => dir === "up" ? b.pct - a.pct : a.pct - b.pct)
        .slice(0, limit);
}


// 2) Heuristic stablecoin detection (symbol + name)
function isStableLike(coin) {
    const s = String(coin?.symbol || "").toUpperCase();
    const n = String(coin?.name || "").toLowerCase();

    // common stable symbols / patterns
    if (DEFAULT_IGNORE_SYMBOLS.has(s)) return true;

    // catches lots of stablecoin tickers: USDT, USDC, FDUSD, USDe, etc
    if (/^(USD|USDT|USDC|DAI|TUSD|FDUSD|USDE|PYUSD|FRAX|LUSD|GUSD|USDP|SUSD|USDD)/.test(s)) return true;

    // name-based
    if (n.includes("usd") && (n.includes("tether") || n.includes("coin") || n.includes("stable"))) return true;
    if (n.includes("stablecoin")) return true;

    // gold stables (optional)
    if (s === "XAUT" || n.includes("tether gold")) return true;

    return false;
}

// combine: manual ignore + stable filter
function buildIgnoreSet(customList = []) {
    const set = new Set(DEFAULT_IGNORE_SYMBOLS);
    customList.forEach(x => set.add(String(x).toUpperCase().trim()));
    return set;
}

function filterCoins(list, { ignoreSet, ignoreStables = true } = {}) {
    const arr = Array.isArray(list) ? list : [];
    return arr.filter(c => {
        const sym = String(c?.symbol || "").toUpperCase().trim();
        if (ignoreSet?.has(sym)) return false;
        if (ignoreStables && isStableLike(c)) return false;
        return true;
    });
}

function drawTextEllipsis(ctx, text, x, y, maxW, size, color, weight = 800, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";

    let t = String(text ?? "");
    if (ctx.measureText(t).width <= maxW) {
        ctx.fillText(t, x, y);
        return;
    }

    const ell = "…";
    while (t.length > 0 && ctx.measureText(t + ell).width > maxW) {
        t = t.slice(0, -1);
    }
    ctx.fillText(t + ell, x, y);
}
function safeIntel(payload, sym) {
    const m = payload?.coinIntel?.[String(sym || "").toUpperCase()];
    return {
        etfNet: m?.etfNet ?? "—",
        liq24h: m?.liq24h ?? "—",
        oi24h: m?.oi24h ?? "—",
        funding: m?.funding ?? "—"
    };
}

// optional: color funding if negative/positive like percent
function intelColor(v) {
    // treat values like "-$120M" or "+$50M" or "-0.01%"
    if (v == null || v === "—") return "rgba(232,240,255,0.68)";
    const s = String(v).trim();
    if (s.startsWith("-")) return "#ff6b6b";
    if (s.startsWith("+")) return "#5CFFB1";
    return "rgba(232,240,255,0.88)";
}

function renderMarketImage(canvas, payload, options) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const accent = options.accent || "#ec6714";
    const bg1 = "#070b14";
    const bg2 = "#0b1220";
    const panel = "rgba(255,255,255,0.06)";
    const stroke = "rgba(255,255,255,0.08)";
    const text = "#e8f0ff";
    const muted = "rgba(232,240,255,0.68)";

    // background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg2);
    g.addColorStop(1, bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // top title
    drawText(ctx, options.headline || "Crypto Market Update", 70, 60, 54, text, 900);

    const ts = new Date(payload.capturedAt || Date.now());
    const timeLabel = `Source: ${payload.source || "CoinMarketCap"} • ${ts.toLocaleString()}`;
    drawText(ctx, timeLabel, 70, 125, 22, muted, 600);
    payload.coinIntel = {
        BTC: { etfNet: "—", liq24h: "—", oi24h: "—", funding: "—" },
        ETH: { etfNet: "—", liq24h: "—", oi24h: "—", funding: "—" },
        BNB: { etfNet: "—", liq24h: "—", oi24h: "—", funding: "—" }
    };

    // Stat cards row
    const breadth = computeBreadth(payload.coins || []);
    const btc = (payload.coins || []).find(c => c.symbol === "BTC");

    const cards = [
        { label: "Market Cap", value: payload.marketCap || "N/A" },
        { label: "BTC Price", value: btc?.price || "N/A" },
        { label: "BTC 24h", value: btc?.change24h || "N/A" },
        { label: "Fear & Greed", value: payload.fearGreed || "N/A" },
        { label: "Breadth", value: `↑ ${breadth.up}  ↓ ${breadth.down}` }
    ];

    const startX = 70, startY = 175;
    const gap = 18;
    const cardW = (W - startX * 2 - gap * 4) / 5;
    const cardH = 140;

    cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        const y = startY;

        ctx.save();
        drawRoundedRect(ctx, x, y, cardW, cardH, 22);
        ctx.fillStyle = panel;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // accent bar
        drawRoundedRect(ctx, x + 14, y + 14, 10, cardH - 28, 8);
        ctx.fillStyle = accent;
        ctx.fill();

        drawText(ctx, c.label, x + 32, y + 22, 22, muted, 700);
        drawText(ctx, c.value, x + 32, y + 60, 30, text, 900);

        ctx.restore();
    });

    // Coins table panel
    const panelX = 70, panelY = 350, panelW = W - 140, panelH = 560;
    ctx.save();
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 28);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawText(ctx, "Top Coins", panelX + 30, panelY + 26, 28, text, 900);

    // header row
    const hx = panelX + 30;
    const hy = panelY + 78;
    const COL_PRICE = hx + 250;
    const COL_1H = hx + 330;
    const COL_24H = hx + 420;
    const COL_7D = hx + 540;

    drawText(ctx, "Asset", hx, hy, 20, muted, 800);
    drawText(ctx, "Price", COL_PRICE, hy, 20, muted, 800, "right");
    drawText(ctx, "1h", COL_1H, hy, 20, muted, 800, "right");
    drawText(ctx, "24h", COL_24H, hy, 20, muted, 800, "right");
    drawText(ctx, "7d", COL_7D, hy, 20, muted, 800, "right");

    // rows
    // const coins = Array.isArray(payload.coins) ? payload.coins : [];


    // rows
    const ignoreSet = buildIgnoreSet(payload.ignoreSymbols || []);
    const coins = filterCoins(payload.coins, { ignoreSet, ignoreStables: true });

    const rowY0 = hy + 46;
    const rowH = 88;            // taller row (was 78)
    const intelOffsetY = 36;    // second line inside row

    for (let i = 0; i < Math.min(coins.length, 5); i++) {
        const c = coins[i];
        const y = rowY0 + i * rowH;

        // divider
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 24, y - 14);
        ctx.lineTo(panelX + panelW - 24, y - 14);
        ctx.stroke();

        // ===== Line 1: main row =====
        const asset = `${c.symbol || "—"}`;
        const colAssetW = 200;
        drawTextEllipsis(ctx, asset, hx, y, colAssetW, 28, text, 900);

        const c1h = c.change1h || "—";
        const c24h = c.change24h || "—";
        const c7d = c.change7d || "—";

        drawText(ctx, c.price || "—", COL_PRICE, y + 2, 24, text, 800, "right");
        drawText(ctx, c1h, COL_1H, y + 2, 24, changeColor(c1h), 900, "right");
        drawText(ctx, c24h, COL_24H, y + 2, 24, changeColor(c24h), 900, "right");
        drawText(ctx, c7d, COL_7D, y + 2, 24, changeColor(c7d), 900, "right");

        // ===== Line 2: intel row (per coin) =====
        const intel = safeIntel(payload, c.symbol);

        // Layout for intel chips (spans across the row under main values)
        // You can change labels anytime without breaking layout.
        const intelY = y + intelOffsetY;

        // left aligned under asset, spanning toward right
        drawText(ctx, "ETF", hx, intelY, 14, muted, 900);
        drawText(ctx, intel.etfNet, hx + 42, intelY, 14, intelColor(intel.etfNet), 900);

        drawText(ctx, "Liq", hx + 170, intelY, 14, muted, 900);
        drawText(ctx, intel.liq24h, hx + 212, intelY, 14, intelColor(intel.liq24h), 900);

        drawText(ctx, "OI", hx + 340, intelY, 14, muted, 900);
        drawText(ctx, intel.oi24h, hx + 372, intelY, 14, intelColor(intel.oi24h), 900);

        drawText(ctx, "Fund", hx + 490, intelY, 14, muted, 900);
        drawText(ctx, intel.funding, hx + 548, intelY, 14, intelColor(intel.funding), 900);
    }



    // ===== Movers Panel =====
    const coinsFiltered = filterCoins(payload.coins, { ignoreSet, ignoreStables: true });

    const gainers = topMovers(coinsFiltered, "up", 3);
    const losers = topMovers(coinsFiltered, "down", 3);


    const mpX = panelX;
    const mpY = panelY + panelH + 20;
    const mpW = panelW;
    const mpH = 200;

    ctx.save();
    drawRoundedRect(ctx, mpX, mpY, mpW, mpH, 26);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();

    drawText(ctx, "Top Movers (24h)", mpX + 30, mpY + 24, 26, text, 900);

    // headers
    drawText(ctx, "Gainers", mpX + 30, mpY + 70, 20, muted, 800);
    drawText(ctx, "Losers", mpX + mpW / 2 + 10, mpY + 70, 20, muted, 800);

    // gainers
    gainers.forEach((c, i) => {
        drawText(
            ctx,
            `${c.symbol}  ${c.change24h}`,
            mpX + 30,
            mpY + 100 + i * 32,
            22,
            "#5CFFB1",
            900
        );
    });

    // losers
    losers.forEach((c, i) => {
        drawText(
            ctx,
            `${c.symbol}  ${c.change24h}`,
            mpX + mpW / 2 + 10,
            mpY + 100 + i * 32,
            22,
            "#ff6b6b",
            900
        );
    });

    ctx.restore();
    let marketMood = "Neutral";
    if (breadth.up > breadth.down * 1.3) marketMood = "Risk-On";
    if (breadth.down > breadth.up * 1.3) marketMood = "Risk-Off";


    // watermark footer
    const wm = options.watermark?.trim();
    if (wm) {
        drawText(ctx, wm, W - 70, H - 58, 22, "rgba(232,240,255,0.6)", 800, "right");
    }
    drawText(ctx, "Generated by CMC Market Snap", 70, H - 58, 18, "rgba(232,240,255,0.45)", 700);

    // little accent line
    ctx.fillStyle = accent;
    ctx.fillRect(70, H - 30, 220, 6);
}

function xrenderMarketImage(canvas, payload, options) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const accent = options.accent || "#ec6714";
    const bg1 = "#070b14";
    const bg2 = "#0b1220";
    const panel = "rgba(255,255,255,0.06)";
    const stroke = "rgba(255,255,255,0.08)";
    const text = "#e8f0ff";
    const muted = "rgba(232,240,255,0.68)";
    const faint = "rgba(232,240,255,0.42)";

    // =========================
    // Background
    // =========================
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg2);
    g.addColorStop(1, bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Title + meta
    drawText(ctx, options.headline || "Crypto Market Update", 70, 60, 54, text, 900);
    const ts = new Date(payload.capturedAt || Date.now());
    drawText(
        ctx,
        `Source: ${payload.source || "CoinMarketCap"} • ${ts.toLocaleString()}`,
        70,
        125,
        22,
        muted,
        600
    );

    // =========================
    // Global cards
    // =========================
    const ignoreSet = buildIgnoreSet(payload.ignoreSymbols || []);
    const coinsFiltered = filterCoins(payload.coins, { ignoreSet, ignoreStables: true });

    const breadth = computeBreadth(coinsFiltered || []);
    const btc = (payload.coins || []).find(c => c.symbol === "BTC");
    const mood =
        breadth.up > breadth.down * 1.3 ? "Risk-On" :
            breadth.down > breadth.up * 1.3 ? "Risk-Off" :
                "Neutral";

    const cards = [
        { label: "Market Cap", value: payload.marketCap || "—" },
        { label: "BTC Price", value: btc?.price || "—" },
        { label: "BTC 24h", value: btc?.change24h || "—" },
        { label: "Fear & Greed", value: payload.fearGreed || "—" },
        { label: "Breadth", value: `↑ ${breadth.up}  ↓ ${breadth.down}` }
    ];

    const startX = 70, startY = 175;
    const gap = 18;
    const cardW = (W - startX * 2 - gap * 4) / 5;
    const cardH = 140;

    cards.forEach((c, i) => {
        const x = startX + i * (cardW + gap);
        const y = startY;

        ctx.save();
        drawRoundedRect(ctx, x, y, cardW, cardH, 22);
        ctx.fillStyle = panel;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        drawRoundedRect(ctx, x + 14, y + 14, 10, cardH - 28, 8);
        ctx.fillStyle = accent;
        ctx.fill();

        drawText(ctx, c.label, x + 32, y + 22, 22, muted, 700);

        // For percent values, colorize (BTC 24h etc.)
        const v = c.value || "—";
        const vColor =
            String(c.label).toLowerCase().includes("24h") ? changeColor(v) : text;

        drawText(ctx, v, x + 32, y + 60, 30, vColor, 900);
        ctx.restore();
    });

    // =========================
    // Top coins panel (dynamic columns)
    // =========================
    const panelX = 70, panelY = 350, panelW = W - 140, panelH = 520; // slightly shorter to make room for intel panels
    ctx.save();
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 28);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawText(ctx, "Top Coins", panelX + 30, panelY + 26, 28, text, 900);
    drawText(ctx, `Market Mood: ${mood}`, panelX + panelW - 30, panelY + 30, 18, faint, 800, "right");

    // Column availability (from upgraded content.js)
    const cols = payload.tableColumns || {};
    const colDefs = [
        { key: "price", label: "Price", get: c => c.price || "—", color: () => text, always: true },
        { key: "1h", label: "1h", get: c => c.change1h || "—", color: v => changeColor(v), enabled: !!cols.has1h },
        { key: "24h", label: "24h", get: c => c.change24h || "—", color: v => changeColor(v), enabled: true },
        { key: "7d", label: "7d", get: c => c.change7d || "—", color: v => changeColor(v), enabled: true },
        { key: "30d", label: "30d", get: c => c.change30d || "—", color: v => changeColor(v), enabled: !!cols.has30d },
        { key: "90d", label: "90d", get: c => c.change90d || "—", color: v => changeColor(v), enabled: !!cols.has90d }
    ].filter(d => d.always || d.enabled);

    const hx = panelX + 30;
    const hy = panelY + 78;

    // Layout math: asset column + N numeric columns (right-aligned)
    const assetW = 220;
    const rightPad = 30;
    const colGap = 18;
    const numericAreaW = panelW - (assetW + 30 + rightPad);
    const numCols = colDefs.length;
    const colW = Math.floor((numericAreaW - colGap * (numCols - 1)) / numCols);

    // Headers
    drawText(ctx, "Asset", hx, hy, 20, muted, 800);

    colDefs.forEach((d, i) => {
        const x = hx + assetW + 30 + i * (colW + colGap) + colW; // right edge
        drawText(ctx, d.label, x, hy, 20, muted, 800, "right");
    });

    // Rows
    const rowY0 = hy + 46;
    const rowH = 78;
    const showRows = Math.min(coinsFiltered.length, 6);

    for (let i = 0; i < showRows; i++) {
        const c = coinsFiltered[i];
        const y = rowY0 + i * rowH;

        // divider
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 24, y - 14);
        ctx.lineTo(panelX + panelW - 24, y - 14);
        ctx.stroke();

        // Asset
        drawTextEllipsis(ctx, c.symbol || "—", hx, y, assetW, 28, text, 900);

        // Cells
        colDefs.forEach((d, j) => {
            const raw = d.get(c);
            const x = hx + assetW + 30 + j * (colW + colGap) + colW;
            drawText(ctx, raw, x, y + 2, 24, d.color(raw), 900, "right");
        });
    }

    ctx.restore();

    // =========================
    // Movers panel
    // =========================
    const gainers = topMovers(coinsFiltered, "up", 4);
    const losers = topMovers(coinsFiltered, "down", 4);

    const mpX = panelX;
    const mpY = panelY + panelH + 18;
    const mpW = panelW;
    const mpH = 170;

    ctx.save();
    drawRoundedRect(ctx, mpX, mpY, mpW, mpH, 26);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();

    drawText(ctx, "Top Movers (24h)", mpX + 30, mpY + 20, 26, text, 900);

    drawText(ctx, "Gainers", mpX + 30, mpY + 64, 18, muted, 800);
    drawText(ctx, "Losers", mpX + mpW / 2 + 10, mpY + 64, 18, muted, 800);

    gainers.forEach((c, i) => {
        drawText(ctx, `${c.symbol}  ${c.change24h || "—"}`, mpX + 30, mpY + 90 + i * 30, 22, "#5CFFB1", 900);
    });
    losers.forEach((c, i) => {
        drawText(ctx, `${c.symbol}  ${c.change24h || "—"}`, mpX + mpW / 2 + 10, mpY + 90 + i * 30, 22, "#ff6b6b", 900);
    });

    ctx.restore();

    // =========================
    // NEW: Market Intel panel (static placeholders for now)
    // =========================
    const ipX = panelX;
    const ipY = mpY + mpH + 14;
    const ipW = panelW;
    const ipH = 220;

    // Helper to draw small "metric cards" inside intel panel
    function drawMiniMetric(x, y, w, h, title, value, sub = "") {
        ctx.save();
        drawRoundedRect(ctx, x, y, w, h, 18);
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.stroke();

        // small accent tick
        drawRoundedRect(ctx, x + 12, y + 14, 6, h - 28, 8);
        ctx.fillStyle = accent;
        ctx.fill();

        drawText(ctx, title, x + 26, y + 16, 16, muted, 800);
        drawText(ctx, value, x + 26, y + 40, 22, text, 900);
        if (sub) drawText(ctx, sub, x + 26, y + 68, 14, faint, 800);

        ctx.restore();
    }

    ctx.save();
    drawRoundedRect(ctx, ipX, ipY, ipW, ipH, 26);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();

    drawText(ctx, "Market Intel (Coming Soon)", ipX + 30, ipY + 20, 26, text, 900);
    drawText(ctx, "These values will be filled via APIs later.", ipX + 30, ipY + 52, 16, faint, 700);

    // Mini metrics grid (2 rows x 3 cols)
    const mx = ipX + 30;
    const my = ipY + 86;
    const mg = 14;
    const miniW = Math.floor((ipW - 60 - mg * 2) / 3);
    const miniH = 92;

    // Row 1
    drawMiniMetric(mx + (miniW + mg) * 0, my, miniW, miniH, "BTC ETF Net Flow", "—", "daily net");
    drawMiniMetric(mx + (miniW + mg) * 1, my, miniW, miniH, "ETH ETF Net Flow", "—", "daily net");
    drawMiniMetric(mx + (miniW + mg) * 2, my, miniW, miniH, "Liquidations (24h)", "—", "total / long / short");

    // Row 2
    drawMiniMetric(mx + (miniW + mg) * 0, my + miniH + mg, miniW, miniH, "Open Interest (24h)", "—", "total + change");
    drawMiniMetric(mx + (miniW + mg) * 1, my + miniH + mg, miniW, miniH, "Funding Rate", "—", "BTC / ETH");
    drawMiniMetric(mx + (miniW + mg) * 2, my + miniH + mg, miniW, miniH, "Volatility / Heat", "—", "index or label");

    ctx.restore();

    // =========================
    // Footer + watermark
    // =========================
    const wm = options.watermark?.trim();
    if (wm) drawText(ctx, wm, W - 70, H - 58, 22, "rgba(232,240,255,0.6)", 800, "right");

    drawText(ctx, "Generated by CMC Market Snap", 70, H - 58, 18, "rgba(232,240,255,0.45)", 700);

    ctx.fillStyle = accent;
    ctx.fillRect(70, H - 30, 220, 6);
}
