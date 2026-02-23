export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

    if (!key) return res.status(401).json({ error: "No API key. Set ANTHROPIC_API_KEY in Vercel environment variables." });

    // Enhance prompt with current date context when search was requested
    const finalPrompt = search
        ? `[Today is ${new Date().toDateString()}. Use your latest knowledge to answer.]\n\n${prompt}`
        : prompt;

    try {
        const body = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            system,
            messages: [{ role: "user", content: finalPrompt }],
        };

        const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        });

        if (!r.ok) {
            const e = await r.text();
            console.error("Anthropic API error:", r.status, e);
            return res.status(r.status).json({ error: e });
        }

        const d = await r.json();
        const text = d.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "";
        return res.json({ text });
    } catch (e) {
        console.error("Handler error:", e.message);
        return res.status(500).json({ error: e.message });
    }
}
