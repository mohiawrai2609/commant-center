import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";

const C = { crimson: "#c41e3a", obsidian: "#0a0a0a", ink: "#1a1a1a", graphite: "#333", stone: "#6b6b6b", mist: "#999", cloud: "#e5e5e5", snow: "#f7f7f7", white: "#fff", accent: "#6a5acd", green: "#0a8a2e", blue: "#0077b5", gold: "#d4940a", teal: "#0d9488" };
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dkey = () => new Date().toISOString().slice(0, 10);
const tierColor = { 1: C.crimson, 2: C.gold, 3: C.teal };
const tierLabel = { 1: "Critical", 2: "Significant", 3: "Monitor" };

const store = {
  async save(k, v) {
    try {
      if (supabase) { const day = k.replace("day:", ""); await supabase.from("signals").upsert({ day, data: v }, { onConflict: "day" }); }
      else { localStorage.setItem(k, JSON.stringify(v)); }
    } catch { }
  },
  async load(k) {
    try {
      if (supabase) { const day = k.replace("day:", ""); const { data } = await supabase.from("signals").select("data").eq("day", day).single(); return data?.data || null; }
      else { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
    } catch { return null; }
  },
  async days() {
    try {
      if (supabase) { const { data } = await supabase.from("signals").select("day").order("day", { ascending: false }); return (data || []).map(r => `day:${r.day}`); }
      else { return Object.keys(localStorage).filter(k => k.startsWith("day:")).sort().reverse(); }
    } catch { return []; }
  }
};

async function ai(system, prompt, search = false, apiKey = "") {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;
    const r = await fetch("/api/ai", { method: "POST", headers, body: JSON.stringify({ system, prompt, search }), signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) { const e = await r.text(); throw new Error(`API ${r.status}: ${e}`); }
    const d = await r.json();
    return d.text || "";
  } catch (e) { clearTimeout(timer); console.error("AI call failed:", e); throw e; }
}

async function clayFind(system, prompt, apiKey = "") {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const r = await fetch("/api/clay", { method: "POST", headers, body: JSON.stringify({ system, prompt }) });
  const d = await r.json();
  return { contacts: d.contacts || [], texts: d.texts || [] };
}

// ═══ NEWS PROMPT v3.0 ALGORITHM ═══
const NEWS_SYS = `You are a workforce intelligence analyst for Replaceable.ai. Search the web using these queries:
1. "AI layoffs" + current month/year
2. "artificial intelligence job cuts" 2026
3. "AI replacing workers" OR "automation job losses"
4. "AI hiring freeze" OR "AI headcount reduction"
5. "CEO AI workforce statement"
6. Major company AI restructuring (rotate: Google, Amazon, Microsoft, Meta, Salesforce, IBM, Apple, BNY, JPMorgan)
7. "humanoid robot deployment" OR "physical AI manufacturing"
8. "AI agents replacing" OR "agentic AI workforce"

CLASSIFICATION:
TIER 1 (Critical) — Major layoff >1000 jobs, Fortune 500 AI workforce decision, new research with original stats, government policy, CEO statement with numbers
TIER 2 (Significant) — 100-1000 job impacts, industry trend with data, expert analysis with projections
TIER 3 (Monitor) — <100 jobs, commentary, predictions without sources

Return ONLY a JSON array. Each:
{"tier":1|2|3,"title":"string","category":"string","geo":"string","rpiType":"Direct"|"Indirect","summary":"3-4 sentences with numbers, companies, sources","affectedRoles":["role1","role2"],"companies":["co1"],"tags":["tag1"],"replaceabilityAngle":"JOB_LOSS|AUGMENTATION|NEW_ROLES|HIRING_FREEZE","rpiRelevance":1-10,"reportRecommend":true|false,"quote":"key quote or null","quoteAttr":"attribution or null","targetProfile":"who to target"}
No markdown fences.`;

// ═══ WORLD-CLASS HTML BUILDER ═══
function formatPaidRaw(text) {
  return text.split("\n\n").map(function (p) {
    if (p.startsWith("##")) return "<h2>" + p.replace(/^##\s*/, "") + "</h2>";
    return '<p style="font-size:15px;line-height:1.8;color:#333;margin-bottom:14px">' + p + "</p>";
  }).join("\n");
}
function buildHTML(sig, freeText, paidData, metrics = []) {
  const tc = tierColor[sig.tier] || C.crimson, tl = tierLabel[sig.tier] || "Signal";
  const mCards = metrics.map(m => `<div class="metric"><div class="mv">${m.value}</div><div class="ml">${m.label}</div></div>`).join("");
  const freeHTML = freeText.split("\n\n").map(p => {
    if (p.startsWith(">")) return `<blockquote>${p.replace(/^>\s*/, "").replace(/\n—(.+)$/, "<cite>— $1</cite>")}</blockquote>`;
    if (p.startsWith("##")) return `<h2>${p.replace(/^##\s*/, "")}</h2>`;
    return `<p>${p}</p>`;
  }).join("\n");
  // Parse paid data — try JSON first, fall back to text
  let roles = [], sectors = [], actions = [], paidRaw = "";
  if (typeof paidData === "object" && paidData.roles) { roles = paidData.roles || []; sectors = paidData.sectors || []; actions = paidData.actions || []; }
  else { paidRaw = typeof paidData === "string" ? paidData : ""; }
  // Build role cards with SVG gauges
  const roleHTML = roles.length ? roles.map(r => {
    const score = parseInt(r.score) || 50; const pct = score / 100; const circ = 2 * Math.PI * 36; const dash = pct * circ;
    const sColor = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e';
    return `<div class="role-card">
<div class="role-top">
<div class="role-gauge"><svg viewBox="0 0 80 80" width="72" height="72"><circle cx="40" cy="40" r="36" fill="none" stroke="rgba(0,0,0,.06)" stroke-width="6"/><circle cx="40" cy="40" r="36" fill="none" stroke="${sColor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 40 40)" style="transition:stroke-dasharray 1.5s ease"/></svg><div class="role-gauge-val">${score}</div></div>
<div class="role-info"><div class="role-title">${r.role}</div><div class="role-risk" style="color:${sColor}">${score >= 70 ? 'High Exposure' : score >= 40 ? 'Moderate Exposure' : 'Low Exposure'}</div></div>
</div>
<div class="role-impact">${r.impact}</div>
${r.tasks ? `<div class="task-section"><div class="task-header">Task-Level Exposure</div>${r.tasks.map(t => `<div class="task-row"><div class="task-name">${t.name}</div><div class="task-bar-wrap"><div class="task-bar" style="width:${t.exposure}%;background:${t.exposure >= 70 ? '#ef4444' : t.exposure >= 40 ? '#f59e0b' : '#22c55e'}"></div></div><div class="task-pct">${t.exposure}%</div></div>`).join("")}</div>` : ""}
${r.action ? `<div class="role-action"><strong>Strategic Response:</strong> ${r.action}</div>` : ""}
</div>`;
  }).join("\n") : "";
  const sectorHTML = sectors.map(s => `<div class="sector-row"><div class="sector-name">${s.name}</div><div class="sector-exp">${s.exposure}</div></div>`).join("");
  const actionHTML = actions.map((a, i) => `<div class="action-item"><div class="action-num">${i + 1}</div><div class="action-text">${a}</div></div>`).join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sig.title} | Replaceable.ai</title>
<meta name="description" content="${sig.summary?.slice(0, 160) || ''}">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--crimson:#c41e3a;--tier:${tc};--bg:#f8fafc;--obsidian:#050814;--ink:#1a1a1a;--graphite:#333;--stone:#6b6b6b;--mist:#999;--cloud:#e5e5e5;--snow:#f1f5f9}
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}
body{font-family:'Crimson Text',Georgia,serif;background:var(--bg);color:var(--ink);line-height:1.75;font-size:18px;-webkit-font-smoothing:antialiased}
a{color:var(--crimson);text-decoration:none;font-weight:600}a:hover{text-decoration:underline}

/* Masthead */
.masthead{background:rgba(5,8,20,.97);backdrop-filter:blur(20px);padding:16px 40px;position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.06)}
.logo{font-family:'Playfair Display',serif;font-size:24px;color:#fff}.logo span{color:var(--crimson)}
.masthead-right{display:flex;align-items:center;gap:16px}
.tier-badge{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;background:var(--tier);color:#fff;padding:5px 14px;border-radius:2px}
.report-date{font-family:'Inter',sans-serif;font-size:11px;color:rgba(255,255,255,.5)}

/* Hero */
.hero{min-height:90vh;background:radial-gradient(ellipse at 20% 50%,#1e293b 0%,#0f172a 30%,var(--obsidian) 70%);display:flex;align-items:center;padding:140px 40px 80px;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='.015'%3E%3Ccircle cx='50' cy='50' r='1'/%3E%3C/g%3E%3C/svg%3E")}
.hero::after{content:"";position:absolute;top:0;right:0;width:50%;height:100%;background:radial-gradient(circle at 80% 40%,rgba(196,30,58,.08) 0%,transparent 60%)}
.hero-inner{max-width:820px;position:relative;z-index:1}
.hero-eyebrow{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:var(--tier);margin-bottom:20px;display:flex;align-items:center;gap:12px}
.hero-eyebrow::before{content:"";width:32px;height:2px;background:var(--tier)}
.hero h1{font-family:'Playfair Display',serif;font-size:clamp(34px,5.5vw,56px);color:#fff;line-height:1.12;font-weight:700;margin-bottom:24px;letter-spacing:-.5px}
.hero-meta{font-family:'Inter',sans-serif;font-size:12px;color:rgba(255,255,255,.45);display:flex;gap:24px;flex-wrap:wrap;margin-bottom:28px}
.hero-meta span{display:flex;align-items:center;gap:6px}
.hero-summary{font-family:'Crimson Text',Georgia,serif;font-size:20px;color:rgba(255,255,255,.75);line-height:1.75;max-width:660px}
.hero-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-top:40px}
.metric{padding:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;backdrop-filter:blur(10px)}
.mv{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:var(--tier);line-height:1}
.ml{font-family:'Inter',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.4);margin-top:6px}

/* Content */
.content{max-width:740px;margin:0 auto;padding:72px 24px}
.content h2{font-family:'Playfair Display',serif;font-size:30px;font-weight:400;margin:56px 0 20px;color:var(--ink);line-height:1.3}
.content p{margin-bottom:20px;font-size:18px;line-height:1.85;color:var(--graphite)}
.content blockquote{margin:32px 0;padding:24px 28px;border-left:4px solid var(--crimson);background:rgba(196,30,58,.03);border-radius:0 6px 6px 0;font-style:italic;font-size:18px;line-height:1.7;color:var(--graphite)}
.content blockquote cite{display:block;margin-top:12px;font-style:normal;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:var(--crimson);letter-spacing:.5px}

/* Divider */
.section-break{max-width:740px;margin:0 auto;padding:0 24px}
.section-break-inner{display:flex;align-items:center;gap:16px;padding:40px 0}
.section-break-inner::before,.section-break-inner::after{content:"";flex:1;height:1px;background:var(--cloud)}
.section-break-label{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--mist)}

/* Paywall */
.paywall{max-width:740px;margin:0 auto;padding:20px 24px 48px;text-align:center}
.paywall-box{padding:56px 40px;background:linear-gradient(180deg,#fff,var(--bg));border:2px solid var(--cloud);border-radius:12px;position:relative;overflow:hidden}
.paywall-box::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:60px;height:3px;background:var(--crimson);border-radius:0 0 2px 2px}
.paywall-box h3{font-family:'Playfair Display',serif;font-size:26px;margin-bottom:10px;margin-top:12px}
.paywall-box p{font-family:'Inter',sans-serif;font-size:14px;color:var(--stone);margin-bottom:28px;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.6}
.paywall-btn{display:inline-block;padding:16px 48px;background:var(--crimson);color:#fff;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;border:none;border-radius:4px;cursor:pointer;transition:background .2s}
.paywall-btn:hover{background:#a01830;text-decoration:none}
.paywall-sub{font-family:'Inter',sans-serif;font-size:10px;color:var(--mist);margin-top:16px}

/* Paid Section */
.paid{max-width:740px;margin:0 auto;padding:0 24px 40px}
.paid-badge{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:var(--crimson);padding:6px 14px;background:rgba(196,30,58,.05);border:1px solid rgba(196,30,58,.12);display:inline-block;border-radius:3px;margin-bottom:32px}
.paid h2{font-family:'Playfair Display',serif;font-size:26px;margin:40px 0 24px;color:var(--ink)}

/* Role Cards */
.role-card{background:#fff;border:1px solid var(--cloud);border-radius:8px;padding:28px;margin-bottom:16px;position:relative;overflow:hidden}
.role-card::before{content:"";position:absolute;top:0;left:0;bottom:0;width:4px;background:var(--tier)}
.role-top{display:flex;align-items:center;gap:20px;margin-bottom:16px;padding-left:12px}
.role-gauge{position:relative;flex-shrink:0}.role-gauge-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--ink)}
.role-title{font-family:'Inter',sans-serif;font-size:15px;font-weight:700;color:var(--ink)}
.role-risk{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-top:3px}
.role-impact{font-size:15px;line-height:1.75;color:var(--graphite);padding-left:12px;margin-bottom:16px}
.role-action{font-size:14px;line-height:1.65;color:var(--graphite);padding:14px 16px;background:var(--snow);border-radius:6px;margin-left:12px}
.task-section{padding-left:12px;margin-bottom:16px}
.task-header{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--mist);margin-bottom:10px}
.task-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.task-name{font-family:'Inter',sans-serif;font-size:12px;color:var(--stone);width:180px;flex-shrink:0}
.task-bar-wrap{flex:1;height:6px;background:var(--cloud);border-radius:3px;overflow:hidden}
.task-bar{height:100%;border-radius:3px;transition:width 1.5s ease}
.task-pct{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;width:36px;text-align:right;color:var(--graphite)}

/* Sectors */
.sector-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}
.sector-row{padding:14px 18px;background:#fff;border:1px solid var(--cloud);border-radius:6px}
.sector-name{font-family:'Inter',sans-serif;font-size:12px;font-weight:700;color:var(--ink);margin-bottom:4px}
.sector-exp{font-size:13px;color:var(--stone);line-height:1.6}

/* Actions */
.action-item{display:flex;gap:14px;margin-bottom:14px;align-items:flex-start}
.action-num{width:28px;height:28px;background:var(--crimson);color:#fff;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0}
.action-text{font-size:15px;line-height:1.7;color:var(--graphite);padding-top:3px}

/* Enterprise */
.enterprise{max-width:740px;margin:0 auto;padding:0 24px 48px}
.enterprise-box{padding:28px;background:rgba(196,30,58,.02);border:1px solid rgba(196,30,58,.1);border-radius:8px}
.enterprise-box h4{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:var(--crimson);margin-bottom:10px}
.enterprise-box p{font-size:14px;color:var(--graphite);line-height:1.75}

/* Methodology */
.methodology{max-width:740px;margin:0 auto;padding:0 24px 48px}
.methodology-box{padding:20px 24px;background:var(--snow);border:1px solid var(--cloud);border-radius:6px}
.methodology-box p{font-family:'Inter',sans-serif;font-size:11px;color:var(--stone);line-height:1.7}

/* CTA */
.cta{text-align:center;padding:72px 24px;background:var(--obsidian);position:relative}
.cta::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:60px;height:3px;background:var(--crimson)}
.cta h3{font-family:'Playfair Display',serif;font-size:28px;color:#fff;margin-bottom:10px}
.cta p{font-family:'Inter',sans-serif;font-size:14px;color:rgba(255,255,255,.5);margin-bottom:28px}
.cta a{display:inline-block;padding:16px 48px;background:var(--crimson);color:#fff;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;border-radius:4px;text-decoration:none;transition:background .2s}
.cta a:hover{background:#a01830}

/* Footer */
.footer{padding:32px;text-align:center;background:var(--obsidian);border-top:1px solid rgba(255,255,255,.04)}
.footer-logo{font-family:'Playfair Display',serif;font-size:20px;color:#fff}.footer-logo span{color:var(--crimson)}
.footer-sub{font-family:'Inter',sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,.3);margin-top:6px}
.footer-links{margin-top:12px;font-family:'Inter',sans-serif;font-size:11px}.footer-links a{color:rgba(255,255,255,.4);margin:0 12px}

@media(max-width:640px){.hero{padding:110px 20px 60px}.hero h1{font-size:30px}.hero-stats{grid-template-columns:1fr 1fr}.content{padding:48px 16px}.masthead{padding:14px 16px}.role-top{flex-direction:column;align-items:flex-start}.task-name{width:120px}.sector-grid{grid-template-columns:1fr}}
</style></head><body>

<div class="masthead">
<div class="logo">Replace<span>able</span>.ai</div>
<div class="masthead-right"><span class="tier-badge">Tier ${sig.tier} · ${tl}</span><span class="report-date">${today()}</span></div>
</div>

<div class="hero">
<div class="hero-inner">
<div class="hero-eyebrow">Tier ${sig.tier} · ${tl} · ${sig.category}</div>
<h1>${sig.title}</h1>
<div class="hero-meta">
<span>📍 ${sig.geo}</span><span>📊 RPI ${sig.rpiType}</span>
<span>🏷 ${(sig.tags || [sig.category]).join(' · ')}</span><span>📅 ${today()}</span>
</div>
<div class="hero-summary">${sig.summary}</div>
<div class="hero-stats">${mCards}</div>
</div>
</div>

<div class="content">${freeHTML}</div>

<div class="section-break"><div class="section-break-inner"><span class="section-break-label">Intelligence Layer</span></div></div>

<div class="paywall"><div class="paywall-box">
<h3>Continue with Replaceable.ai</h3>
<p>The intelligence below includes role-by-role RPI scoring with task-level exposure analysis, sector impact mapping, and specific action recommendations for workforce strategists.</p>
<a class="paywall-btn" href="#">Subscribe for Full Access →</a>
<div class="paywall-sub">Enterprise access available · <a href="#">Request a demo →</a></div>
</div></div>

<div class="paid">
<div class="paid-badge">Subscriber Intelligence</div>
${roles.length ? `<h2>RPI Role Impact Analysis</h2>${roleHTML}` : ""}
${sectors.length ? `<h2>Sector Exposure Map</h2><div class="sector-grid">${sectorHTML}</div>` : ""}
${actions.length ? `<h2>CHRO Action Brief — This Week</h2>${actionHTML}` : ""}
${paidRaw ? formatPaidRaw(paidRaw) : ""}
</div>

<div class="enterprise"><div class="enterprise-box">
<h4>Enterprise Intelligence</h4>
<p>Enterprise subscribers access bespoke RPI scoring against your organisation's specific role taxonomy, custom sector analysis, comparative benchmarking against peers, and quarterly advisory briefings with our research team. <a href="#">Request enterprise access →</a></p>
</div></div>

<div class="methodology"><div class="methodology-box">
<p><strong>Methodology note:</strong> This report combines sourced facts (company announcements, regulatory filings, and reported figures) with analytical estimates (RPI scores, task exposure percentages, and implementation projections). RPI scores are calculated using Replaceable.ai's proprietary methodology combining Automation Probability Score, Human Resilience Factor, and Industry Adoption Factor. This is not legal or financial advice. Scores represent analytical assessments, not predictions of specific workforce actions by named companies unless officially announced.</p>
</div></div>

<div class="cta">
<h3>Check Your Role's RPI Score</h3>
<p>Personalised automation exposure analysis tailored to your industry and experience level.</p>
<a href="#">Analyse My Role →</a>
</div>

<div class="footer">
<div class="footer-logo">Replace<span>able</span>.ai</div>
<div class="footer-sub">Workforce Automation Intelligence · ${today()}</div>
<div class="footer-links"><a href="#">Subscribe</a><a href="#">Enterprise</a><a href="#">Methodology</a><a href="#">Contact</a></div>
</div>
</body></html>`;
}

// ─── UI components ───
const Label = ({ children, color = C.crimson, style: s }) => <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color, ...s }}>{children}</span>;
const Tag = ({ children, bg, color }) => <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, padding: "3px 7px", borderRadius: 2, background: bg, color, display: "inline-block" }}>{children}</span>;
const Btn = ({ children, onClick, v = "primary", disabled, small, style: s }) => <button onClick={onClick} disabled={disabled} style={{ fontFamily: "monospace", fontSize: small ? 9 : 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, padding: small ? "5px 12px" : "9px 20px", borderRadius: 3, cursor: disabled ? "default" : "pointer", opacity: disabled ? .5 : 1, background: disabled ? C.cloud : v === "primary" ? C.crimson : v === "dark" ? C.obsidian : v === "green" ? C.green : "transparent", color: disabled ? C.mist : v === "outline" ? C.crimson : C.white, border: v === "outline" ? `1.5px solid ${disabled ? C.cloud : C.crimson}` : "none", ...s }}>{children}</button>;
const Spin = () => <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.cloud}`, borderTop: `2px solid ${C.crimson}`, borderRadius: "50%", animation: "spin .8s linear infinite", verticalAlign: "middle", marginRight: 6 }} />;

// ═══ MAIN APP ═══
export default function App() {
  const [signals, setSignals] = useState([]);
  const [view, setView] = useState("dashboard");
  const [scanQ, setScanQ] = useState(""); const [scanS, setScanS] = useState("idle");
  const [dailyS, setDailyS] = useState("idle");
  const [paste, setPaste] = useState(""); const [showPaste, setShowPaste] = useState(false); const [pasteS, setPasteS] = useState("idle");
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  // API key (entered by user, sent per-request to server)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("rai_key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const saveKey = (k) => { setApiKey(k); localStorage.setItem("rai_key", k); };
  // CMS article state
  const [artFree, setArtFree] = useState(""); const [artPaid, setArtPaid] = useState("");
  const [artMetrics, setArtMetrics] = useState([]); const [artS, setArtS] = useState("idle");
  const [artErr, setArtErr] = useState("");
  const [artTime, setArtTime] = useState(0);
  const timerRef = useRef(null);
  const [cmsTab, setCmsTab] = useState("edit"); // "edit"|"preview"
  // linkedin
  const [liText, setLiText] = useState(""); const [liS, setLiS] = useState("idle");
  // clay
  const [clayData, setClayData] = useState([]); const [clayMsgs, setClayMsgs] = useState({}); const [clayS, setClayS] = useState("idle");
  // archive
  const [archDays, setArchDays] = useState([]); const [archView, setArchView] = useState(null); const [archSigs, setArchSigs] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await store.load(`day:${dkey()}`); if (s?.length) setSignals(s);
      setArchDays((await store.days()).sort().reverse());
    })()
  }, []);
  useEffect(() => { if (signals.length) store.save(`day:${dkey()}`, signals) }, [signals]);

  const addSigs = (arr, src) => setSignals(p => [...arr.map((x, i) => ({ ...x, id: Date.now() + i, source: src, scannedAt: new Date().toISOString() })), ...p]);

  // ─── DAILY SCAN ──────────────
  const dailyScan = async () => {
    setDailyS("go"); try {
      const t = await ai(NEWS_SYS, `Daily scan ${today()}. All 8 queries. Top 5-7 signals past 48h. JSON array.`, true, apiKey);
      const c = t.replace(/```json|```/g, "").trim(); const s = c.indexOf("["), e = c.lastIndexOf("]");
      if (s === -1) throw 0; addSigs(JSON.parse(c.slice(s, e + 1)), "daily-scan");
      setDailyS("done"); setTimeout(() => setDailyS("idle"), 2500);
    } catch { setDailyS("err"); setTimeout(() => setDailyS("idle"), 3000) }
  };

  // ─── TOPIC SCAN ─────────────
  const topicScan = async () => {
    if (!scanQ.trim()) return; setScanS("go"); try {
      const t = await ai(NEWS_SYS, `Focus on: ${scanQ}. 3-5 signals. ${today()}.`, true, apiKey);
      const c = t.replace(/```json|```/g, "").trim(); const s = c.indexOf("["), e = c.lastIndexOf("]");
      if (s === -1) throw 0; addSigs(JSON.parse(c.slice(s, e + 1)), "topic-scan");
      setScanS("done"); setScanQ(""); setTimeout(() => setScanS("idle"), 2000);
    } catch { setScanS("err"); setTimeout(() => setScanS("idle"), 3000) }
  };

  // ─── PASTE ──────────────────
  const doPaste = async () => {
    if (!paste.trim()) return; setPasteS("go"); try {
      const t = await ai(`Extract workforce signals from pasted research. Same tier system (1=Critical, 2=Significant, 3=Monitor). Return JSON array with: tier,title,category,geo,rpiType,summary,affectedRoles,companies,tags,replaceabilityAngle,rpiRelevance,reportRecommend,quote,quoteAttr,targetProfile.`, `Extract:\n\n${paste.slice(0, 8000)}`, false, apiKey);
      const c = t.replace(/```json|```/g, "").trim(); const s = c.indexOf("["), e = c.lastIndexOf("]");
      addSigs(JSON.parse(c.slice(s, e + 1)), "pasted");
      setPasteS("done"); setPaste(""); setShowPaste(false); setTimeout(() => setPasteS("idle"), 2000);
    } catch { setPasteS("err"); setTimeout(() => setPasteS("idle"), 3000) }
  };

  // ─── GENERATE ARTICLE (Research → Write pipeline) ───────
  const genArticle = async (sig) => {
    setSel(sig); setModal("article"); setArtFree(""); setArtPaid(""); setArtMetrics([]); setArtS("metrics"); setArtErr(""); setCmsTab("edit");
    setArtTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setArtTime(t => t + 1), 1000);
    try {
      // Phase 0: metrics
      try {
        const mt = await ai(`Return ONLY JSON array of 4 key metrics. Each: {"value":"e.g. 20,000 or 5%","label":"max 3 words"}. No markdown.`, `Signal: ${sig.title}\nSummary: ${sig.summary}`, false, apiKey);
        const mc = mt.replace(/```json|```/g, "").trim(); const ms = mc.indexOf("["), me = mc.lastIndexOf("]");
        if (ms !== -1) setArtMetrics(JSON.parse(mc.slice(ms, me + 1)));
      } catch (e) { console.warn("Metrics failed:", e) }

      // Phase 1: RESEARCH (WITH web search)
      setArtS("research");
      const research = await ai(
        `You are a research analyst for Replaceable.ai. Your job is to gather RAW SOURCE MATERIAL for a premium article. Search the web thoroughly.\n\nReturn a structured research brief:\n\n## Key Facts & Numbers\n- Every concrete stat, number, dollar amount, headcount figure you find\n- Source each one (company name, publication, date)\n\n## Timeline\n- Key dates and sequence of events\n\n## Quotes\n- Direct quotes from executives, analysts, officials with attribution\n- At least 2-3 substantive quotes\n\n## Context & Comparables\n- Similar events at other companies for comparison\n- Industry trends this connects to\n\n## Workforce Impact Detail\n- Specific roles/departments affected\n- Announced timelines for changes`,
        `Research this signal deeply:\n\nTitle: ${sig.title}\nSummary: ${sig.summary}\nCompanies: ${(sig.companies || []).join(", ")}\nCategory: ${sig.category}\nGeo: ${sig.geo}\nDate: ${today()}`,
        true, apiKey
      );

      // Phase 2: WRITE free article
      setArtS("free");
      const free = await ai(
        `You are Replaceable.ai's editorial voice. Using the research brief provided, write a 700-900 word FREE editorial article.\n\nSTYLE: Economist meets Bloomberg Intelligence. Every paragraph must have a concrete number, named source, or specific detail.\n\nSTRUCTURE:\n1. Opening provocation (1 para)\n2. The hard numbers (2-3 para)\n3. Boardroom implications (2 para)\n4. Blockquote with attribution\n5. Question every CHRO should ask (1 para)\n6. Closing hook to paid layer\n\nFORMATTING: Double newlines between paragraphs. Quotes: > prefix, end with \\n—Name, Title. Headers: ## prefix.`,
        `RESEARCH BRIEF:\n${research}\n\nSIGNAL: ${sig.title}\nTier: ${sig.tier}, Category: ${sig.category}, Geo: ${sig.geo}\nRoles: ${(sig.affectedRoles || []).join(", ")}\nCompanies: ${(sig.companies || []).join(", ")}`,
        false, apiKey
      );
      setArtFree(free);

      // Phase 3: PAID structured JSON
      setArtS("paid");
      const paidTxt = await ai(
        `You are Replaceable.ai's intelligence layer. Generate STRUCTURED JSON for the paid subscriber section.\n\nReturn ONLY valid JSON, no markdown fences:\n{\n  "roles": [{"role": "Job Title","score": 75,"impact": "3-4 sentences.","action": "1-2 sentences.","tasks": [{"name": "Task", "exposure": 85}]}],\n  "sectors": [{"name": "Sector", "exposure": "1-2 sentences"}],\n  "actions": ["CHRO action step"]\n}\n\nProvide 5-7 roles with 3-4 tasks each, 4-6 sectors, 4-5 action steps. Scores 0-100.`,
        `Signal: ${sig.title}\nTier: ${sig.tier}\nResearch: ${research.slice(0, 3000)}\nRoles: ${(sig.affectedRoles || []).join(", ")}\nCompanies: ${(sig.companies || []).join(", ")}\nCategory: ${sig.category}`,
        false, apiKey
      );
      let paidData;
      try {
        const clean = paidTxt.replace(/```json|```/g, "").trim();
        const si = clean.indexOf("{"), ei = clean.lastIndexOf("}");
        paidData = JSON.parse(clean.slice(si, ei + 1));
      } catch { paidData = paidTxt; }
      setArtPaid(paidData); setArtS("done");
    } catch (e) {
      console.error("Article generation failed:", e);
      setArtErr(e.name === "AbortError" ? "Timed out after 120s. Try again." : `Failed: ${e.message}`);
      setArtS("error");
    } finally { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Live HTML from current editable text
  const liveHTML = useMemo(() => {
    if (!artFree || !sel) return "";
    return buildHTML(sel, artFree, artPaid || "", artMetrics);
  }, [sel, artFree, artPaid, artMetrics]);

  // Download
  const doDownload = useCallback(() => {
    if (!liveHTML) return;
    try {
      const blob = new Blob([liveHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `replaceable-ai-${(sel?.title || "article").replace(/[^a-z0-9]+/gi, "-").slice(0, 50).toLowerCase()}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Fallback: open in new tab
      try { const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(liveHTML); w.document.close() } }
      catch { navigator.clipboard?.writeText(liveHTML) }
    }
  }, [liveHTML, sel]);

  // ─── LINKEDIN ───────────────
  const genLI = async (sig) => {
    setSel(sig); setModal("linkedin"); setLiText(""); setLiS("go");
    const t = await ai(`You are Aman Sehgal, founder of Replaceable.ai. LinkedIn post, 250-400 words. Sharp, data-led, provocative. → for sparse bullets. CTA to daily brief. 3-4 hashtags. 🔴 at start only. Do NOT mention JLR, Jaguar Land Rover, or Marks and Spencer.`,
      `Signal: ${sig.title}\nSummary: ${sig.summary}\nQuote: ${sig.quote || "none"}\nDate: ${today()}`, false, apiKey);
    setLiText(t); setLiS("done");
  };

  // ─── CLAY ───────────────────
  const doClay = async (sig) => {
    setSel(sig); setModal("targets"); setClayData([]); setClayMsgs({}); setClayS("go");
    const { contacts, texts } = await clayFind("Use Clay MCP tools to find senior HR and workforce planning contacts. Search by company domain and job title keywords like CHRO, VP HR, Head of Workforce Planning, VP Operations.",
      `Find 5-10 senior contacts for targeting based on this signal: "${sig.title}". Target profile: ${sig.targetProfile || "CHROs and workforce planning leaders at affected companies"}. Search the most relevant companies mentioned.`, apiKey);
    if (contacts.length) setClayData(contacts);
    else setClayData([{ name: "AI Response", latest_experience_title: texts.join("\n").slice(0, 500), latest_experience_company: "See details", url: "" }]);
    setClayS("done");
  };
  const draftMsg = async (c) => {
    setClayMsgs(p => ({ ...p, [c.name]: "..." }));
    const m = await ai(`Bespoke LinkedIn outreach for Replaceable.ai (Aman Sehgal). Reference signal data. Relevant to person's role. Under 120 words. Intelligence delivery not sales. End with brief CTA. ONLY the message. No JLR or M&S.`,
      `Signal: "${sel?.title}"\nSummary: ${sel?.summary}\nContact: ${c.name}, ${c.latest_experience_title} at ${c.latest_experience_company}`, false, apiKey);
    setClayMsgs(p => ({ ...p, [c.name]: m }));
  };

  const tc = t => tierColor[t] || C.stone; const tl = t => tierLabel[t] || "Signal";

  return (
    <div style={{ minHeight: "100vh", background: C.snow, fontFamily: "Georgia,serif", color: C.ink }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input:focus,textarea:focus{border-color:${C.crimson}!important;outline:none} .cms-ta{width:100%;padding:12px;font-family:Georgia,serif;font-size:13px;line-height:1.7;border:1px solid ${C.cloud};border-radius:4px;resize:vertical;color:${C.graphite}} .cms-ta:focus{border-color:${C.crimson}}`}</style>

      {/* HEADER */}
      <div style={{ background: C.obsidian, borderBottom: `3px solid ${C.crimson}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: C.white }}>Replaceable<em style={{ color: C.crimson }}>.ai</em></div>
            <div style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: C.mist, marginTop: 2 }}>Daily Intelligence Command Centre</div></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Btn small v={view === "dashboard" ? "primary" : "outline"} onClick={() => { setView("dashboard"); setArchView(null) }}>Today</Btn>
            <Btn small v={view === "archive" ? "primary" : "outline"} onClick={() => setView("archive")}>Archive</Btn>
            <Btn small v={showSettings ? "primary" : "outline"} onClick={() => setShowSettings(s => !s)}>⚙ Key</Btn>
          </div>
        </div>
        {showSettings && <div style={{ borderTop: `1px solid rgba(255,255,255,.08)`, padding: "12px 20px", display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,.03)" }}>
          <Label color={C.mist}>Anthropic API Key</Label>
          <input type="password" value={apiKey} onChange={e => saveKey(e.target.value)}
            placeholder="sk-ant-api03-..." style={{ flex: 1, maxWidth: 420, padding: "6px 10px", fontSize: 12, fontFamily: "monospace", background: "rgba(255,255,255,.06)", border: `1px solid ${apiKey ? C.green : C.crimson}40`, borderRadius: 3, color: C.white }} />
          <span style={{ fontFamily: "monospace", fontSize: 9, color: apiKey ? C.green : C.crimson }}>{apiKey ? "✓ Key saved" : "⚠ No key"}</span>
        </div>}
      </div>
      {!apiKey && <div style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, padding: "10px 20px", textAlign: "center" }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: C.gold }}>⚠ No Anthropic API key set — click <strong>⚙ Key</strong> in the header to add yours. Scans will fail without it.</span>
      </div>}

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 20px 80px" }}>
        {view === "dashboard" && <>
          {/* SCAN BAR */}
          <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ padding: "14px 18px", background: C.white, border: `1px solid ${C.crimson}30`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 155 }}>
              <Label color={C.crimson}>Daily News Scan</Label>
              <div style={{ fontSize: 10, color: C.stone, margin: "6px 0", textAlign: "center" }}>v3.0 · 8 queries</div>
              <Btn onClick={dailyScan} disabled={dailyS === "go"}>{dailyS === "go" ? <><Spin />Scanning...</> : dailyS === "done" ? "✓ Done" : "Run Daily Scan"}</Btn>
            </div>
            <div style={{ flex: 1, minWidth: 220, padding: "14px 18px", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 6 }}>
              <Label>Topic / Industry Scan</Label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input value={scanQ} onChange={e => setScanQ(e.target.value)} onKeyDown={e => e.key === "Enter" && topicScan()} placeholder="e.g. healthcare AI, EU robotics, fintech layoffs..."
                  style={{ flex: 1, padding: "8px 12px", fontSize: 13, fontFamily: "Georgia,serif", border: `1px solid ${C.cloud}`, borderRadius: 3 }} />
                <Btn onClick={topicScan} disabled={scanS === "go" || !scanQ.trim()}>{scanS === "go" ? <Spin /> : "Scan"}</Btn>
              </div>
            </div>
            <div style={{ padding: "14px 18px", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 120 }}>
              <Label color={C.accent}>Paste Research</Label>
              <Btn small v="outline" onClick={() => setShowPaste(!showPaste)} style={{ marginTop: 8 }}>{showPaste ? "Hide" : "Open"}</Btn>
            </div>
          </div>

          {showPaste && <div style={{ padding: 16, background: C.white, border: `1px solid ${C.accent}`, borderRadius: 6, marginBottom: 8 }}>
            <Label color={C.accent}>Paste from Perplexity / Deep Search / Any Source</Label>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={5} placeholder="Paste research here..."
              style={{ width: "100%", marginTop: 8, padding: "10px 12px", fontSize: 13, fontFamily: "Georgia,serif", border: `1px solid ${C.cloud}`, borderRadius: 3, resize: "vertical" }} />
            <div style={{ marginTop: 10 }}><Btn onClick={doPaste} disabled={pasteS === "go" || !paste.trim()}>{pasteS === "go" ? <><Spin />Extracting...</> : "Extract Signals"}</Btn></div>
          </div>}

          {/* STATS */}
          <div style={{ display: "flex", gap: 10, margin: "14px 0 18px", flexWrap: "wrap" }}>
            {[{ n: signals.length, l: "Signals", c: C.crimson }, { n: signals.filter(s => s.tier === 1).length, l: "Tier 1", c: C.crimson }, { n: signals.filter(s => s.tier === 2).length, l: "Tier 2", c: C.gold }, { n: signals.filter(s => s.tier === 3).length, l: "Tier 3", c: C.teal }].map((x, i) =>
              <div key={i} style={{ flex: 1, minWidth: 70, padding: "10px 12px", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: x.c }}>{x.n}</div><Label color={C.stone}>{x.l}</Label>
              </div>)}
          </div>

          {/* SIGNALS */}
          <Label>{signals.length ? today() : "No signals — run Daily Scan, search a topic, or paste research"}</Label>
          <div style={{ marginTop: 10 }}>
            {signals.map(sig => {
              const isSel = sel?.id === sig.id; return (
                <div key={sig.id} style={{ background: C.white, border: `1px solid ${isSel ? C.crimson : C.cloud}`, borderLeft: `4px solid ${tc(sig.tier)}`, borderRadius: 4, marginBottom: 8 }}>
                  <div onClick={() => setSel(isSel ? null : sig)} style={{ padding: "12px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
                          <Tag bg={`${tc(sig.tier)}20`} color={tc(sig.tier)}>{tl(sig.tier)}</Tag>
                          <Tag bg="rgba(106,90,205,.1)" color={C.accent}>{sig.geo}</Tag>
                          <Tag bg="rgba(196,30,58,.08)" color={C.crimson}>{sig.category}</Tag>
                          {sig.rpiType && <Tag bg={sig.rpiType === "Direct" ? C.crimson : C.stone} color={C.white}>RPI {sig.rpiType}</Tag>}
                          <Tag bg={sig.source === "daily-scan" ? "#0a8a2e15" : sig.source === "pasted" ? "#6a5acd15" : "#0077b515"} color={sig.source === "daily-scan" ? C.green : sig.source === "pasted" ? C.accent : C.blue}>{sig.source === "daily-scan" ? "Daily" : sig.source === "pasted" ? "Pasted" : "Topic"}</Tag>
                          {sig.reportRecommend && <Tag bg="#c41e3a15" color={C.crimson}>Report ✓</Tag>}
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.35 }}>{sig.title}</div>
                        <div style={{ fontSize: 11, color: C.stone, marginTop: 4, lineHeight: 1.5 }}>{sig.summary}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginLeft: 8 }}>
                        {sig.rpiRelevance && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: tc(sig.tier) }}>{sig.rpiRelevance}/10</span>}
                        <button onClick={e => { e.stopPropagation(); setSignals(p => p.filter(s => s.id !== sig.id)); if (sel?.id === sig.id) setSel(null) }} style={{ background: "none", border: "none", color: C.mist, fontSize: 12, cursor: "pointer" }}>×</button>
                      </div>
                    </div>
                  </div>
                  {isSel && <div style={{ padding: "0 16px 12px", borderTop: `1px solid ${C.cloud}`, paddingTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn small onClick={() => genArticle(sig)}>📰 Generate Article</Btn>
                    <Btn small v="dark" onClick={() => genLI(sig)}>💼 LinkedIn Post</Btn>
                    <Btn small v="outline" onClick={() => doClay(sig)}>🎯 Find Targets (Clay)</Btn>
                  </div>}
                </div>);
            })}
          </div>
        </>}

        {/* ARCHIVE */}
        {view === "archive" && <>
          <Label>Archive</Label>
          {!archView ? <div style={{ marginTop: 12 }}>
            {archDays.length === 0 ? <div style={{ padding: 28, textAlign: "center", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 6, color: C.stone, fontSize: 14 }}>No archived days yet.</div>
              : archDays.map(d => <div key={d} onClick={() => { (async () => { setArchSigs(await store.load(d) || []); setArchView(d.replace("day:", "")) })() }} style={{ padding: "12px 16px", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 4, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 14 }}>{d.replace("day:", "")}</span><Label color={C.stone}>View →</Label></div>)}
          </div>
            : <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><span style={{ fontSize: 16 }}>{archView}</span><Btn small v="outline" onClick={() => { setArchView(null); setArchSigs([]) }}>← Back</Btn></div>
              {archSigs.map((s, i) => <div key={i} style={{ padding: "12px 16px", background: C.white, border: `1px solid ${C.cloud}`, borderLeft: `4px solid ${tc(s.tier)}`, borderRadius: 4, marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}><Tag bg={`${tc(s.tier)}20`} color={tc(s.tier)}>{tl(s.tier)}</Tag><Tag bg="rgba(106,90,205,.1)" color={C.accent}>{s.geo}</Tag><Tag bg="rgba(196,30,58,.08)" color={C.crimson}>{s.category}</Tag></div>
                <div style={{ fontSize: 13 }}>{s.title}</div><div style={{ fontSize: 11, color: C.stone, marginTop: 3 }}>{s.summary}</div>
              </div>)}
            </div>}
        </>}
      </div>

      {/* ═══ ARTICLE CMS MODAL ═══ */}
      {modal === "article" && sel && <Overlay onClose={() => setModal(null)} wide>
        <div style={{ background: C.obsidian, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Label color={C.crimson}>Article Studio</Label>
            <div style={{ color: C.white, fontSize: 12, marginTop: 3, opacity: .8 }}>{sel.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Btn small v={cmsTab === "edit" ? "primary" : "outline"} onClick={() => setCmsTab("edit")}>✏️ Edit</Btn>
            <Btn small v={cmsTab === "preview" ? "primary" : "outline"} onClick={() => setCmsTab("preview")} disabled={!artFree}>👁 Preview</Btn>
            <Btn small v="green" onClick={doDownload} disabled={!artFree}>⬇ Download Final</Btn>
            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: C.mist, fontSize: 18, cursor: "pointer", marginLeft: 4 }}>×</button>
          </div>
        </div>

        {cmsTab === "edit" && <div style={{ padding: 20, maxHeight: "75vh", overflow: "auto" }}>
          {/* Status */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
            {["metrics", "research", "free", "paid", "done"].map(s => {
              const labels = { metrics: "Metrics", research: "🔍 Research", free: "✏️ Write", paid: "📊 RPI Layer", done: "✓ Complete" };
              const active = artS === s; const past = ["metrics", "research", "free", "paid", "done"].indexOf(artS) > ["metrics", "research", "free", "paid", "done"].indexOf(s);
              return <div key={s} style={{ padding: "4px 10px", borderRadius: 12, fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, background: active ? C.crimson : past ? C.green + "20" : C.cloud, color: active ? C.white : past ? C.green : C.mist }}>{labels[s]}</div>
            })}
            {artS !== "idle" && artS !== "done" && artS !== "error" && <span style={{ fontFamily: "monospace", fontSize: 10, color: C.stone, marginLeft: 8 }}>{artTime}s</span>}
          </div>

          {artS === "metrics" && <div style={{ textAlign: "center", padding: 24 }}><Spin /><span style={{ color: C.stone, fontSize: 13 }}>Extracting key metrics... {artTime}s</span></div>}
          {artS === "research" && <div style={{ textAlign: "center", padding: 24, background: C.snow, borderRadius: 6 }}><Spin /><span style={{ color: C.stone, fontSize: 13 }}>Deep research with web search... {artTime}s</span><div style={{ fontSize: 10, color: C.mist, marginTop: 6 }}>Gathering numbers, quotes, sources, context</div></div>}

          {artS === "error" && <div style={{ padding: 20, background: "#fff0f0", border: `1px solid ${C.crimson}40`, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.crimson, marginBottom: 8 }}>⚠ {artErr}</div>
            <Btn small onClick={() => genArticle(sel)}>Retry</Btn>
          </div>}

          {/* FREE ARTICLE EDITOR */}
          {artFree ? <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: C.green, color: C.white, fontFamily: "monospace", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 2, textTransform: "uppercase", letterSpacing: 1.5 }}>Free · Public</span>
                <Label color={C.stone}>Editable — changes update the download</Label>
              </div>
            </div>
            <textarea className="cms-ta" rows={16} value={artFree} onChange={e => setArtFree(e.target.value)} />
          </div>
            : artS === "free" && <div style={{ textAlign: "center", padding: 24 }}><Spin /><span style={{ color: C.stone, fontSize: 13 }}>Writing editorial from research... {artTime}s</span></div>}

          {/* PAID LAYER EDITOR — JSON or text */}
          {artPaid ? <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: C.crimson, color: C.white, fontFamily: "monospace", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 2, textTransform: "uppercase", letterSpacing: 1.5 }}>Paid · Subscriber</span>
              <Label color={C.stone}>{typeof artPaid === "object" ? "Structured data — edit role scores below" : "Editable"}</Label>
            </div>
            {typeof artPaid === "object" ? <div>
              {/* Structured role editor */}
              {(artPaid.roles || []).map((r, i) => <div key={i} style={{ padding: 12, background: C.snow, border: `1px solid ${C.cloud}`, borderLeft: `4px solid ${r.score >= 70 ? '#ef4444' : r.score >= 40 ? '#f59e0b' : '#22c55e'}`, borderRadius: 4, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <input value={r.role} onChange={e => { const n = { ...artPaid, roles: [...artPaid.roles] }; n.roles[i] = { ...r, role: e.target.value }; setArtPaid(n) }} style={{ fontWeight: 700, fontSize: 13, border: "none", background: "transparent", fontFamily: "system-ui", flex: 1 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Label color={C.stone}>RPI:</Label>
                    <input type="number" min="0" max="100" value={r.score} onChange={e => { const n = { ...artPaid, roles: [...artPaid.roles] }; n.roles[i] = { ...r, score: parseInt(e.target.value) || 0 }; setArtPaid(n) }} style={{ width: 48, textAlign: "center", fontWeight: 700, fontSize: 14, border: `1px solid ${C.cloud}`, borderRadius: 3, padding: "2px 4px" }} />
                  </div>
                </div>
                <textarea value={r.impact} onChange={e => { const n = { ...artPaid, roles: [...artPaid.roles] }; n.roles[i] = { ...r, impact: e.target.value }; setArtPaid(n) }} rows={2} style={{ width: "100%", fontSize: 12, border: `1px solid ${C.cloud}`, borderRadius: 3, padding: 6, resize: "vertical", fontFamily: "Georgia", lineHeight: 1.6 }} />
              </div>)}
              {/* Actions editor */}
              {(artPaid.actions || []).length > 0 && <div style={{ marginTop: 12 }}>
                <Label color={C.crimson}>CHRO Action Brief</Label>
                {artPaid.actions.map((a, i) => <div key={i} style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 700, color: C.crimson, fontSize: 12, marginTop: 2 }}>{i + 1}.</span>
                  <input value={a} onChange={e => { const n = { ...artPaid, actions: [...artPaid.actions] }; n.actions[i] = e.target.value; setArtPaid(n) }} style={{ flex: 1, fontSize: 12, border: `1px solid ${C.cloud}`, borderRadius: 3, padding: "4px 8px" }} />
                </div>)}
              </div>}
            </div>
              : <textarea className="cms-ta" rows={20} value={typeof artPaid === "string" ? artPaid : JSON.stringify(artPaid, null, 2)} onChange={e => setArtPaid(e.target.value)} />}
          </div>
            : artS === "paid" && <div style={{ textAlign: "center", padding: 20, background: C.snow, borderRadius: 6 }}><Spin /><span style={{ color: C.stone, fontSize: 13 }}>Generating structured RPI intelligence... {artTime}s</span></div>}

          {artS === "done" && <div style={{ padding: 16, background: "rgba(10,138,46,.06)", border: `1px solid rgba(10,138,46,.2)`, borderRadius: 6, textAlign: "center" }}>
            <Label color={C.green}>✓ Article Ready</Label>
            <div style={{ fontSize: 12, color: C.graphite, marginTop: 6 }}>Edit above, Preview to verify, Download Final when happy</div>
          </div>}
        </div>}

        {cmsTab === "preview" && <div style={{ height: "75vh" }}>
          <iframe srcDoc={liveHTML} style={{ width: "100%", height: "100%", border: "none" }} title="Article Preview" />
        </div>}
      </Overlay>}

      {/* LINKEDIN MODAL */}
      {modal === "linkedin" && sel && <Overlay onClose={() => setModal(null)}>
        <div style={{ background: C.blue, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label color={C.white}>LinkedIn Post</Label>
          <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.crimson, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 15, fontWeight: 700 }}>A</div>
            <div><div style={{ fontWeight: 700, fontSize: 13 }}>Aman Sehgal</div><div style={{ fontSize: 11, color: C.stone }}>Founder, Replaceable.ai</div></div>
          </div>
          {liS === "go" ? <div style={{ textAlign: "center", padding: 20 }}><Spin /></div>
            : <textarea className="cms-ta" rows={12} value={liText} onChange={e => setLiText(e.target.value)} />}
          {liText && <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <Btn small onClick={() => navigator.clipboard?.writeText(liText)}>Copy</Btn>
            <Btn small v="outline" onClick={() => genLI(sel)}>Regenerate</Btn>
          </div>}
        </div>
      </Overlay>}

      {/* CLAY MODAL */}
      {modal === "targets" && sel && <Overlay onClose={() => setModal(null)}>
        <div style={{ background: C.obsidian, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><Label color={C.crimson}>Clay Targeting</Label><div style={{ color: C.white, fontSize: 12, marginTop: 3 }}>{sel.title}</div></div>
          <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: C.mist, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 16, maxHeight: "70vh", overflow: "auto" }}>
          {clayS === "go" && <div style={{ textAlign: "center", padding: 20 }}><Spin /><div style={{ color: C.stone, marginTop: 6, fontSize: 11 }}>Searching Clay for contacts... 15-30s</div></div>}
          {clayS === "done" && clayData.map((c, i) =>
            <div key={i} style={{ padding: "10px 12px", border: `1px solid ${C.cloud}`, borderRadius: 4, marginBottom: 6, background: C.snow }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <div><div style={{ fontWeight: 700, fontSize: 12 }}>{c.name}</div><div style={{ fontSize: 10, color: C.stone }}>{c.latest_experience_title}</div><div style={{ fontSize: 10, color: C.crimson, fontWeight: 600 }}>{c.latest_experience_company}</div></div>
                <div style={{ display: "flex", gap: 4 }}>
                  {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.blue, fontWeight: 600, textDecoration: "none" }}>LinkedIn↗</a>}
                  <Btn small v="outline" onClick={() => draftMsg(c)} disabled={clayMsgs[c.name] === "..."}>{clayMsgs[c.name] === "..." ? "..." : clayMsgs[c.name] ? "Redo" : "Draft Msg"}</Btn>
                </div>
              </div>
              {clayMsgs[c.name] && clayMsgs[c.name] !== "..." && <div style={{ marginTop: 8, padding: "8px 10px", background: C.white, border: `1px solid ${C.cloud}`, borderRadius: 3 }}>
                <div style={{ fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{clayMsgs[c.name]}</div>
                <button onClick={() => navigator.clipboard?.writeText(clayMsgs[c.name])} style={{ marginTop: 4, fontSize: 8, fontWeight: 700, color: C.crimson, background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1.5 }}>Copy</button>
              </div>}
            </div>
          )}
        </div>
      </Overlay>}

      {/* FOOTER */}
      <div style={{ borderTop: `3px solid ${C.crimson}`, background: C.obsidian, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: C.white }}>Replaceable<em style={{ color: C.crimson }}>.ai</em></div>
        <div style={{ fontFamily: "monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: 3, color: C.mist, marginTop: 3 }}>On demand · v3 news algorithm · v5.0</div>
      </div>
    </div>);
}

function Overlay({ children, onClose, wide }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, overflow: "auto", display: "flex", justifyContent: "center", padding: "20px 12px" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 900 : 700, background: C.white, borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.3)", alignSelf: "flex-start" }}>{children}</div>
  </div>;
}
