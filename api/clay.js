export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt } = req.body;
    const key = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

    if (!key) return res.status(401).json({ error: "No API key provided" });

    try {
        const body = {
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            system,
            messages: [{ role: "user", content: prompt }],
            mcp_servers: [{ type: "url", url: "https://api.clay.com/v3/mcp", name: "clay" }],
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
            return res.status(r.status).json({ error: e });
        }

        const d = await r.json();
        let contacts = [];
        for (const b of (d.content?.filter((b) => b.type === "mcp_tool_result") || []))
            try {
                const p = JSON.parse(b.content?.[0]?.text || "");
                if (p.contacts) contacts = p.contacts;
            } catch { }
        const texts = d.content?.filter((b) => b.type === "text").map((b) => b.text) || [];
        return res.json({ contacts, texts });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
