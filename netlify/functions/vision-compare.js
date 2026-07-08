// netlify/functions/vision-compare.js
// On-demand: sends 2 chart images (sample + one candidate) to Google Gemini
// (free tier, no billing needed) for a structural verdict.
// Called per-card, not for the whole batch scan, to keep usage minimal.

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY not set on Netlify" }) };
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

Jawab HANYA JSON, tiada teks lain, tiada markdown fence:
{"match_score": <integer 0-100>, "verdict": "<1 ayat pendek Bahasa Melayu>"}`;

    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: sampleType || "image/jpeg", data: sampleBase64 } },
          { inline_data: { mime_type: candidateType || "image/jpeg", data: candidateBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.2 }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message || "Gemini API error" }) };
    }

    const raw = (data.candidates && data.candidates[0] && data.candidates[0].content &&
                 data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
                 data.candidates[0].content.parts[0].text) || "";
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
