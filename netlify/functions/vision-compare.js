// netlify/functions/fetch-image.js
// Fetches a Google Drive thumbnail server-side (no CORS issue here)
// and returns it as base64 so the browser can use it (e.g. send to Claude vision).

exports.handler = async (event) => {
  try {
    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "missing id" }) };
    }

    const url = `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: "drive fetch failed", status: res.status }) };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/jpeg";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ base64, contentType }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
