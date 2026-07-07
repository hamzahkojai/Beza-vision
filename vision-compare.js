// netlify/functions/vision-compare.js
// Sends 2 chart images (sample + candidate) to Claude vision and asks for a
// structural match score based on the 3-phase beza framework.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const {
      sampleBase64, sampleType,
      candidateBase64, candidateType,
      candidateDate, candidateBeza
    } = JSON.parse(event.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set on Netlify" }) };
    }

    const prompt = `Kau tengok 2 chart GOLDmicro XAUUSD M15.
Gambar PERTAMA ialah pattern SAMPLE/rujukan yang user nak cari.
Gambar KEDUA ialah tarikh ${candidateDate} (beza ${candidateBeza}) untuk dibandingkan.

Bandingkan struktur 3 phase:
1) sebelum jam 09:15 EET
2) 09:15-15:15 EET
3) lepas 15:15 EET

Beri markah kesepadanan (match_score) 0-100 ikut sama ada arah pergerakan
(TURUN/NAIK/SQUEEZE/SPIKE/REJECT) setiap phase tu sepadan antara 2 chart.

Jawab HANYA JSON, tiada teks lain:
{"match_score": <integer 0-100>, "verdict": "<1 ayat pendek Bahasa Melayu>"}`;

    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", source: { type: "base64", media_type: sampleType || "image/jpeg", data: sampleBase64 } },
          { type: "image", source: { type: "base64", media_type: candidateType || "image/jpeg", data: candidateBase64 } }
        ]
      }]
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const textBlock = (data.content || []).find(c => c.type === "text");
    const raw = textBlock ? textBlock.text : "";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = { match_score: null, verdict: "Gagal parse jawapan AI: " + raw.slice(0, 150) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
