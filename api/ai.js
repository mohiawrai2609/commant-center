export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Check for the key - GEMINI_API_KEY is preferred
    const key = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!key) {
        return res.status(401).json({
            error: "No API Key found. Go to Vercel -> Settings -> Environment Variables and add GEMINI_API_KEY."
        });
    }

    const { system, prompt } = req.body;

    // 🚀 The Ultimate Fallback List (Trying these in order)
    const modelsToTry = [
        "gemini-2.0-flash",        // Newest
        "gemini-1.5-flash",        // Standard
        "gemini-1.5-flash-8b",     // Light
        "gemini-pro"               // Legacy
    ];

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            console.log(`Checking model: ${model}`);
            const r = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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

            if (r.ok) {
                const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
                console.log(`SUCCESS! Found working model: ${model}`);
                return res.json({ text });
            }

            // If 404, we try next model. If other error (billing/quota), we stop and show it.
            if (r.status === 404) {
                console.warn(`Model ${model} not available for this key. trying next...`);
                lastError = d.error?.message;
                continue;
            }

            return res.status(r.status).json({
                error: `Google API Error (${model})`,
                details: d.error?.message
            });

        } catch (e) {
            lastError = e.message;
            continue;
        }
    }

    return res.status(404).json({
        error: "Saare models fail ho gaye (404).",
        details: lastError,
        tip: "Aapka API Key shayad 'Generative Language API' ke liye enabled nahi hai. AI Studio (aistudio.google.com) se nayi key generate karke try karein."
    });
}
