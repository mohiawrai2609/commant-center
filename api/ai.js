export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

    if (!key) return res.status(401).json({ error: "No API key provided. Set ANTHROPIC_API_KEY in Vercel environment variables." });

    try {
        const body = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            system,
            messages: [{ role: "user", content: prompt }],
        };

        const headers = {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        };

        // Add web search tool if requested (requires web-search beta access)
        if (search) {
            headers["anthropic-beta"] = "web-search-2025-03-05";
            body.tools = [{ type: "web_search_20250305", name: "web_search" }];
            body.max_tokens = 8192;
        }

        const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers,
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
        console.error("Handler error:", e);
        return res.status(500).json({ error: e.message });
    }
}
