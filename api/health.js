export default function handler(req, res) {
    res.json({
        status: "online",
        time: new Date().toISOString(),
        env_keys_found: {
            GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
            OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
            CLAY_API_KEY: !!process.env.CLAY_API_KEY
        },
        node_version: process.version
    });
}
