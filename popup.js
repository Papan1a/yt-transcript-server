const PROMPT =
  "Please summarize this video transcript into bullet points " +
  "and highlight key insights and any action items:\n\n";

const btn = document.getElementById("btn");
const statusEl = document.getElementById("status");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Matches youtube-transcript-api: b'\n\x0b' + video_id.encode()
function encodeParams(videoId) {
  return btoa(String.fromCharCode(0x0a, videoId.length) + videoId);
}

function parseSegments(data) {
  const segments = data?.actions?.[0]
    ?.updateEngagementPanelAction?.content
    ?.transcriptRenderer?.content
    ?.transcriptSearchPanelRenderer?.body
    ?.transcriptSegmentListRenderer?.initialSegments;

  if (!segments) return null;

  const lines = segments
    .map(s => s.transcriptSegmentRenderer?.snippet?.runs?.map(r => r.text).join("") || "")
    .filter(t => t.trim());

  return lines.join(" ").replace(/\s+/g, " ").trim() || null;
}

async function fetchTranscript(videoId) {
  // Same API key used by youtube-transcript-api Python library
  const API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  const params = encodeParams(videoId);
  const endpoint = `https://www.youtube.com/youtubei/v1/get_transcript?key=${API_KEY}`;

  const clients = [
    {
      clientName: "WEB",
      clientVersion: "2.9415.1",
      hl: "en",
      gl: "US",
    },
    {
      clientName: "ANDROID",
      clientVersion: "19.09.37",
      androidSdkVersion: 30,
      hl: "en",
      gl: "US",
    },
  ];

  let lastError = "";
  for (const client of clients) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client }, params }),
    });

    if (!res.ok) {
      lastError = `${client.clientName} HTTP ${res.status}`;
      continue;
    }

    const data = await res.json();
    const transcript = parseSegments(data);
    if (transcript) return { transcript };
    lastError = `${client.clientName}: no segments. Keys: ${Object.keys(data).join(", ")}`;
  }

  return { error: lastError };
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
    const { transcript, error } = await fetchTranscript(videoId);

    if (error) {
      setStatus("Error: " + error, "error");
      btn.disabled = false;
      return;
    }

    await navigator.clipboard.writeText(PROMPT + transcript);
    chrome.tabs.create({ url: "https://claude.ai/new" });
    setStatus("Copied! Paste with Ctrl+V in Claude.", "success");

  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }

  btn.disabled = false;
});
