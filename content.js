chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "getTranscript") return;

  (async () => {
    try {
      // Inject a script into page context to read window.ytInitialPlayerResponse
      // Content scripts run in isolated world, so we use a <script> tag trick
      const result = await new Promise((resolve) => {
        const script = document.createElement("script");
        const callbackName = "__ytTranscript_" + Date.now();

        script.textContent = `
          (function() {
            try {
              const pr = window.ytInitialPlayerResponse;
              if (!pr) {
                window.postMessage({ type: "${callbackName}", error: "ytInitialPlayerResponse not found" }, "*");
                return;
              }
              const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (!tracks || tracks.length === 0) {
                window.postMessage({ type: "${callbackName}", error: "no_tracks" }, "*");
                return;
              }
              const track = tracks.find(t => t.languageCode === "en") || tracks[0];
              window.postMessage({ type: "${callbackName}", baseUrl: track.baseUrl }, "*");
            } catch(e) {
              window.postMessage({ type: "${callbackName}", error: e.message }, "*");
            }
          })();
        `;

        function onMessage(event) {
          if (event.source !== window || !event.data || event.data.type !== callbackName) return;
          window.removeEventListener("message", onMessage);
          resolve(event.data);
        }
        window.addEventListener("message", onMessage);

        document.head.appendChild(script);
        script.remove();
      });

      if (!result) {
        sendResponse({ error: "Could not read page data." });
        return;
      }

      if (result.error === "no_tracks") {
        sendResponse({ error: "No transcript available for this video." });
        return;
      }

      if (result.error) {
        sendResponse({ error: "Page error: " + result.error });
        return;
      }

      const url = result.baseUrl + "&fmt=json3";
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!res.ok) {
        sendResponse({ error: "Failed to fetch transcript (HTTP " + res.status + ")." });
        return;
      }

      const data = await res.json();
      const events = data.events || [];

      const lines = events
        .filter(e => e.segs)
        .map(e => e.segs.map(s => s.utf8 || "").join(""))
        .filter(line => line.trim() !== "" && line !== "\n");

      const transcript = lines.join(" ").replace(/\s+/g, " ").trim();

      if (!transcript) {
        sendResponse({ error: "Transcript is empty." });
        return;
      }

      sendResponse({ transcript });

    } catch (err) {
      sendResponse({ error: "Unexpected error: " + err.message });
    }
  })();

  return true;
});
