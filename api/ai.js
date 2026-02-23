export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;

    // Check all possible key names just in case
    const key = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!key) {
        return res.status(401).json({
            error: "No API Key found in Vercel. Please add GEMINI_API_KEY in Vercel Settings -> Environment Variables."
        });
    }

    try {
        // Using the most stable v1 endpoint (non-beta) for maximum reliability
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: `SYSTEM INSTRUCTIONS: ${system}\n\nUSER REQUEST: ${prompt}${search ? "\n\n(Perform a news scan for today)" : ""}` }]
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
            let parsedError;
            try { parsedError = JSON.parse(e); } catch { parsedError = e; }

            console.error("Gemini API Error Details:", parsedError);
            return res.status(r.status).json({
                error: "AI Error",
                details: parsedError.error?.message || e
            });
        }

        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!text) throw new Error("AI returned an empty response.");

        return res.json({ text });

    } catch (e) {
        console.error("Server Crash:", e.message);
        return res.status(500).json({ error: "Server Error", details: e.message });
    }
}
