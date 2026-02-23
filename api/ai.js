export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

    if (!key) return res.status(401).json({ error: "No API key provided" });

    try {
        const body = {
            model: "claude-sonnet-4-20250514",
            max_tokens: search ? 8192 : 3000,
            system,
            messages: [{ role: "user", content: prompt }],
        };
        if (search) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

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
            return res.status(r.status).json({ error: e });
        }

        const d = await r.json();
        const text = d.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "";
        return res.json({ text });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
