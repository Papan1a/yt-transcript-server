const PROMPT =
  "Please summarize this video transcript into bullet points " +
  "and highlight key insights and any action items:\n\n";

const btn = document.getElementById("btn");
const statusEl = document.getElementById("statusEl");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
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

  btn.disabled = true;
  setStatus("Loading transcript…");

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getTranscript" });

    if (response.error) {
      setStatus(response.error, "error");
      btn.disabled = false;
      return;
    }

    const fullText = PROMPT + response.transcript;
    await navigator.clipboard.writeText(fullText);
    chrome.tabs.create({ url: "https://claude.ai/new" });
    setStatus("Copied! Paste with Ctrl+V in Claude.", "success");

  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }

  btn.disabled = false;
});
