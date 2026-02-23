export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || req.headers["x-api-key"];

    if (!key) return res.status(401).json({ error: "No API key configured. Add GEMINI_API_KEY to Vercel environment variables." });

    // Universal Prompt Format: Works on every Gemini version
    const finalPrompt = `CONTEXT/SYSTEM INSTRUCTIONS:
${system}

${search ? `TODAY'S DATE: ${new Date().toDateString()}` : ""}

USER REQUEST:
${prompt}`;

    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: finalPrompt }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.7,
                    },
                }),
            }
        );

        if (!r.ok) {
            const e = await r.text();
            console.error("Gemini API error:", r.status, e);
            return res.status(r.status).json({ error: e });
        }

        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
        return res.json({ text });

    } catch (e) {
        console.error("Handler error:", e.message);
        return res.status(500).json({ error: e.message });
    }
}
