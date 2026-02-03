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
    drawText(ctx, "Asset", hx, hy, 20, muted, 800);
    drawText(ctx, "Price", hx + 250, hy, 20, muted, 800, "right");
    drawText(ctx, "1h", hx + 330, hy, 20, muted, 800, "right");
    drawText(ctx, "24h", hx + 420, hy, 20, muted, 800, "right");
    drawText(ctx, "7d", hx + 540, hy, 20, muted, 800, "right");

    // rows
    // const coins = Array.isArray(payload.coins) ? payload.coins : [];
    const ignoreSet = buildIgnoreSet(payload.ignoreSymbols || []);

    const rowY0 = hy + 46;
    const rowH = 78;

    const coins = filterCoins(payload.coins, { ignoreSet, ignoreStables: true });

    for (let i = 0; i < Math.min(coins.length, 6); i++) {
        const c = coins[i];
        const y = rowY0 + i * rowH;

        const asset = `${c.symbol ? c.symbol : "-"}`;

        // Asset: ellipsis to avoid overlap
        const colAssetW = 360;
        drawTextEllipsis(ctx, asset, hx, y, colAssetW, 26, text, 900);

        // Price right-aligned
        drawText(ctx, c.price || "—", hx + 250, y + 2, 24, text, 800, "right");

        // Changes (string expected like "0.44%" or "-1.02%")
        const c1h = c.change1h || "—";
        const c24h = c.change24h || "—";
        const c7d = c.change7d || "—";

        drawText(ctx, c1h, hx + 330, y + 2, 24, changeColor(c1h), 900, "right");
        drawText(ctx, c24h, hx + 460, y + 2, 24, changeColor(c24h), 900, "right");
        drawText(ctx, c7d, hx + 580, y + 2, 24, changeColor(c7d), 900, "right");
    }


    // ===== Movers Panel =====
    const movers = filterCoins(payload.movers, { ignoreSet, ignoreStables: true });

    const gainers = topMovers(payload.coins || [], "up", 3);
    const losers = topMovers(payload.coins || [], "down", 3);

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

    drawText(ctx, "Generated by CMC Market Snap", 70, H - 58, 18, "rgba(232,240,255,0.45)", 700);

    // drawText(
    //     ctx,
    //     `Market Mood: ${marketMood} • BTC ${btc?.change24h || "N/A"} • Breadth ${breadth.up}/${breadth.down}`,
    //     70,
    //     H - 95,
    //     22,
    //     muted,
    //     700
    // );

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
