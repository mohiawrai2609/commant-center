export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;

    // Check for the key
    const key = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!key) {
        return res.status(401).json({
            error: "No API Key found. Please add GEMINI_API_KEY in Vercel Settings -> Environment Variables."
        });
    }

    // List of model variants to try in case of 404 errors
    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`Attempting scan with model: ${modelName}`);

            const r = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            role: "user",
                            parts: [{ text: `INSTRUCTIONS: ${system}\n\nDATABASE SCAN REQUEST: ${prompt}${search ? "\n(Note: Search your internal knowledge for the latest news)" : ""}` }]
                        }],
                        generationConfig: {
                            maxOutputTokens: 2048,
                            temperature: 0.7,
                        },
                    }),
                }
            );

            // If we get a 404, it means THIS model name is wrong for this key. Try the next one!
            if (r.status === 404) {
                const errText = await r.text();
                console.warn(`Model ${modelName} not found (404). Trying next...`);
                lastError = errText;
                continue;
            }

            if (!r.ok) {
                const e = await r.text();
                return res.status(r.status).json({ error: "AI Error", details: e });
            }

            const d = await r.json();
            const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // If we got text, we are successful!
            return res.json({ text });

        } catch (e) {
            lastError = e.message;
            continue;
        }
    }

    // If we get here, all models failed
    return res.status(404).json({
        error: "All Gemini model variants failed.",
        details: lastError
    });
}
