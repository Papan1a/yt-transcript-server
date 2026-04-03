from flask import Flask, jsonify, request
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

app = Flask(__name__)
CORS(app, origins=r"chrome-extension://.*")  # Allow requests from Chrome extension only

@app.route("/transcript")
def get_transcript():
    video_id = request.args.get("v")
    if not video_id:
        return jsonify({"error": "Missing video ID"}), 400

    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)

        try:
            transcript = transcript_list.find_transcript(["en"])
        except NoTranscriptFound:
            # Fallback: use first available transcript
            transcript = next(iter(transcript_list))

        entries = transcript.fetch()
        text = " ".join(entry.text for entry in entries)
        text = " ".join(text.split())  # normalize whitespace

        return jsonify({"transcript": text, "lang": transcript.language_code})

    except TranscriptsDisabled:
        return jsonify({"error": "Transcripts are disabled for this video"}), 404
    except NoTranscriptFound:
        return jsonify({"error": "No transcript found for this video"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    print("YT Transcript server running on http://localhost:5000")
    app.run(port=5000, debug=False)
