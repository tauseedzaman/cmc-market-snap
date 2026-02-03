const canvas = document.getElementById("preview");
const statusEl = document.getElementById("status");
const btnCapture = document.getElementById("btnCapture");
const btnDownload = document.getElementById("btnDownload");

const watermarkEl = document.getElementById("watermark");
const accentEl = document.getElementById("accent");
const headlineEl = document.getElementById("headline");

let lastPayload = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function getOptions() {
  return {
    watermark: watermarkEl.value,
    accent: accentEl.value,
    headline: headlineEl.value
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function captureFromCMC() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab?.url?.includes("coinmarketcap.com")) {
    setStatus("Open coinmarketcap.com (Top page) and try again.");
    return;
  }

  setStatus("Capturing data from page...");
  const resp = await chrome.tabs.sendMessage(tab.id, { type: "CMC_CAPTURE" }).catch(() => null);

  if (!resp?.ok) {
    setStatus("Capture failed. Reload the page and try again.");
    return;
  }

  lastPayload = resp.data;

  // Render
  canvas.width = 1080;
canvas.height = 1400; // was 1080
  renderMarketImage(canvas, lastPayload, getOptions());
  btnDownload.disabled = false;

  // Quick quality hint
  const missing = [];
  if (!lastPayload.marketCap) missing.push("Market Cap");
  if (!lastPayload.fearGreed) missing.push("Fear & Greed");
  if (!lastPayload.avgRsi) missing.push("Avg RSI");
  if (!lastPayload.coins?.length) missing.push("Coins table");

  setStatus(
    missing.length
      ? `Rendered (some missing: ${missing.join(", ")}). You can still download.`
      : "Rendered successfully. Ready to download."
  );
}

function downloadPNG() {
  if (!lastPayload) return;

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: `crypto-market-update-${Date.now()}.png`,
      saveAs: true
    });
  }, "image/png");
}

// re-render on option change (if already captured)
function rerenderIfReady() {
  if (!lastPayload) return;
  renderMarketImage(canvas, lastPayload, getOptions());
}

btnCapture.addEventListener("click", captureFromCMC);
btnDownload.addEventListener("click", downloadPNG);

watermarkEl.addEventListener("input", rerenderIfReady);
accentEl.addEventListener("input", rerenderIfReady);
headlineEl.addEventListener("input", rerenderIfReady);

// defaults
headlineEl.value = "Crypto Market Update";
watermarkEl.value = "@thebenefactor"; // change as you want
