from flask import Flask, jsonify, request
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

app = Flask(__name__)
CORS(app)

@app.route("/transcript")
def get_transcript():
    video_id = request.args.get("v")
    if not video_id:
        return jsonify({"error": "Missing video ID"}), 400

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        try:
            transcript = transcript_list.find_transcript(["en"])
        except NoTranscriptFound:
            transcript = next(iter(transcript_list))

        entries = transcript.fetch()
        text = " ".join(entry["text"] for entry in entries)
        text = " ".join(text.split())

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
    app.run(host="0.0.0.0", port=5000)
