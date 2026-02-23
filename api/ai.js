export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    // Server env vars take priority — prevents stale browser-stored keys from overriding
    const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || req.headers["x-api-key"];

    if (!key) return res.status(401).json({ error: "No API key configured." });

    // Inject date context when search/realtime was requested
    const finalPrompt = search
        ? `[Today's date: ${new Date().toDateString()}. Use your latest training knowledge to find relevant signals.]\n\n${prompt}`
        : prompt;

    try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
                "HTTP-Referer": "https://commant-center.vercel.app",
                "X-Title": "Replaceable.ai Command Centre",
            },
            body: JSON.stringify({
                model: "google/gemma-2-9b-it:free",
                max_tokens: 2000,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: finalPrompt }
                ],
            }),
        });

        if (!r.ok) {
            const e = await r.text();
            console.error("OpenRouter API error:", r.status, e);
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
