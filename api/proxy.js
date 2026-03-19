module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    // Convert Anthropic format to Gemini format
    const systemPrompt = body.system || "";
    const userMessage = body.messages?.[0]?.content || "";
    const fullPrompt = systemPrompt + "\n\nUsuario: " + userMessage;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Return in Anthropic-compatible format
    res.status(200).json({
      content: [{ type: "text", text: text }]
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
