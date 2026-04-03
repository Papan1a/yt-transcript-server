const PROMPT =
  "Please summarize this video transcript into bullet points " +
  "and highlight key insights and any action items:\n\n";

const SERVER = "https://web-production-27cf37.up.railway.app";

const btn = document.getElementById("btn");
const status = document.getElementById("status");

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = type;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

btn.addEventListener("click", async () => {
  const tab = await getCurrentTab();

  if (!tab.url || !tab.url.includes("youtube.com/watch")) {
    setStatus("Please open a YouTube video first.", "error");
    return;
  }

  const videoId = new URL(tab.url).searchParams.get("v");
  if (!videoId) {
    setStatus("Could not get video ID.", "error");
    return;
  }

  btn.disabled = true;
  setStatus("Loading transcript…");

  try {
    const res = await fetch(SERVER + "/transcript?v=" + videoId, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    if (!res.ok || data.error) {
      setStatus(data.error || "Server error " + res.status, "error");
      btn.disabled = false;
      return;
    }

    const fullText = PROMPT + data.transcript;
    await navigator.clipboard.writeText(fullText);
    chrome.tabs.create({ url: "https://claude.ai/new" });
    setStatus("Copied! Paste with Ctrl+V in Claude.", "success");

  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }

  btn.disabled = false;
});
