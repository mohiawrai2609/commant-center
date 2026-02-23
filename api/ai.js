export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || req.headers["x-api-key"];

    if (!key) return res.status(401).json({ error: "No API key configured." });

    // Using the OpenAI-compatible bridge for Gemini — Much more stable for Free Tier
    try {
        const r = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: "gemini-1.5-flash",
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: `${search ? `[CURRENT DATE: ${new Date().toDateString()}] ` : ""}${prompt}` }
                    ],
                    max_tokens: 2048,
                    temperature: 0.7
                }),
            }
        );

        if (!r.ok) {
            const e = await r.text();
            console.error("Gemini/OpenAI API error:", r.status, e);
            return res.status(r.status).json({ error: e });
        }

        const d = await r.json();
        const text = d.choices?.[0]?.message?.content || "";
        return res.json({ text });

    } catch (e) {
        console.error("Handler error:", e.message);
        return res.status(500).json({ error: e.message });
    }
}
