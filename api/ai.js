export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const key = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(401).json({ error: "No API Key found. Add GEMINI_API_KEY to Vercel." });

    const { system, prompt, search = false } = req.body;

    // 1. Try listing models first to find the REAL name for this account
    let availableModel = "gemini-1.5-flash";
    try {
        const listR = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (listR.ok) {
            const listD = await listR.json();
            // Find the first flash or pro model that supports generateContent
            const found = listD.models?.find(m => m.name.includes("flash") || m.name.includes("pro"));
            if (found) {
                availableModel = found.name.split("/").pop(); // Get just the name like "gemini-1.5-flash"
                console.log("Found working model for this account:", availableModel);
            }
        }
    } catch (e) {
        console.warn("Could not list models, falling back to default.");
    }

    // 2. Perform the actual AI call with the found model
    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${availableModel}:generateContent?key=${key}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: `INSTRUCTIONS: ${system}\n\nUSER REQUEST: ${prompt}` }]
                    }],
                    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
                }),
            }
        );

        const d = await r.json();

        if (!r.ok) {
            return res.status(r.status).json({
                error: "Google API Rejected this call",
                details: d.error?.message || "Unknown error",
                attemptedModel: availableModel
            });
        }

        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.json({ text });

    } catch (e) {
        return res.status(500).json({ error: "Server crashed", details: e.message });
    }
}
