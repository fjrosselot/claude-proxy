module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }

  try {
    let body = req.body || {};
    if (typeof body === "string") body = JSON.parse(body);

    const systemPrompt = body.system || "";
    const userMessage = (body.messages && body.messages[0] && body.messages[0].content) ? body.messages[0].content : "";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "HTTP-Referer": "https://fjrosselot.github.io/tesoreros-sg",
        "X-Title": "Tesoreros SG"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: "OpenRouter error: " + errText });
      return;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    res.status(200).json({ content: [{ type: "text", text: text }] });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
