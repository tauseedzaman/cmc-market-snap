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
    const cards = [
      { label: "Market Cap", value: payload.marketCap || "—" },
      { label: "CMC20", value: payload.cmc20 || "—" },
      { label: "Fear & Greed", value: payload.fearGreed || "—" },
      { label: "Avg RSI", value: payload.avgRsi || "—" },
      { label: "Alt Season", value: payload.altSeason || "—" }
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
    drawText(ctx, "Price", hx + 420, hy, 20, muted, 800);
    drawText(ctx, "24h", hx + 700, hy, 20, muted, 800);
    drawText(ctx, "7d", hx + 860, hy, 20, muted, 800);
  
    // rows
    const coins = Array.isArray(payload.coins) ? payload.coins : [];
    const rowY0 = hy + 46;
    const rowH = 78;
  
    for (let i = 0; i < Math.min(coins.length, 7); i++) {
      const c = coins[i];
      const y = rowY0 + i * rowH;
  
      // divider
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 24, y - 14);
      ctx.lineTo(panelX + panelW - 24, y - 14);
      ctx.stroke();
  
      const asset = `${c.name || "—"}${c.symbol ? "  (" + c.symbol + ")" : ""}`;
      drawText(ctx, asset, hx, y, 26, text, 900);
      drawText(ctx, c.price || "—", hx + 420, y + 2, 24, text, 800);
  
      const c24 = c.change24h || "—";
      const c7 = c.change7d || "—";
  
      drawText(ctx, c24, hx + 700, y + 2, 24, isNegative(c24) ? "#ff6b6b" : "#5CFFB1", 900);
      drawText(ctx, c7, hx + 860, y + 2, 24, isNegative(c7) ? "#ff6b6b" : "#5CFFB1", 900);
    }
  
    ctx.restore();
  
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
  