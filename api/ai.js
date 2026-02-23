const FREE_MODELS = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free",
    "mistralai/mistral-7b-instruct:free",
    "qwen/qwen-2-7b-instruct:free",
];

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { system, prompt, search = false } = req.body;
    const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || req.headers["x-api-key"];

    if (!key) return res.status(401).json({ error: "No API key configured." });

    const finalPrompt = search
        ? `[Today's date: ${new Date().toDateString()}. Use your latest training knowledge.]\n\n${prompt}`
        : prompt;

    // Try each free model until one works
    let lastError = null;
    for (const model of FREE_MODELS) {
        try {
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`,
                    "HTTP-Referer": "https://commant-center.vercel.app",
                    "X-Title": "Replaceable.ai Command Centre",
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 1500,
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: finalPrompt }
                    ],
                }),
            });

            if (r.status === 429 || r.status === 404 || r.status === 503) {
                // Rate limited or unavailable — try next model
                const e = await r.text();
                console.warn(`Model ${model} failed (${r.status}), trying next...`);
                lastError = e;
                continue;
            }

            if (!r.ok) {
                const e = await r.text();
                console.error(`OpenRouter error (${model}):`, r.status, e);
                return res.status(r.status).json({ error: e });
            }

            const d = await r.json();
            const text = d.choices?.[0]?.message?.content || "";
            console.log(`Success with model: ${model}`);
            return res.json({ text });

        } catch (e) {
            console.warn(`Model ${model} threw error:`, e.message);
            lastError = e.message;
            continue;
        }
    }

    // All models failed
    return res.status(429).json({ error: `All free models are rate-limited. Please try again in a few minutes, or add paid credits at openrouter.ai. Last error: ${lastError}` });
}
