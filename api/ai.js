export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(401).json({ error: "No API Key. Add GROQ_API_KEY to Vercel Settings." });

    const { system, prompt } = req.body;

    try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2048,
                temperature: 0.7
            })
        });

        const d = await r.json();

        if (!r.ok) {
            console.error("Groq Error:", r.status, d);
            return res.status(r.status).json({ error: d.error?.message || "Groq API Error" });
        }

        const text = d.choices?.[0]?.message?.content || "";
        return res.json({ text });

    } catch (e) {
        console.error("Server error:", e.message);
        return res.status(500).json({ error: e.message });
    }
}
