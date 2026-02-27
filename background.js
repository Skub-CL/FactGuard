// background.js – Service Worker
// Routes API calls to Anthropic, Ollama, or OpenAI-compatible endpoints

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `Du bist ein präziser Faktenprüfer mit Zugang zu wissenschaftlichen Erkenntnissen.
Analysiere den gegebenen Text auf potenzielle Fehlinformationen.

Heutiges Datum: ${today}. Beziehe dieses Datum in deine Analyse ein – Ereignisse bis zu diesem Datum können real sein, auch wenn sie dir unbekannt vorkommen.

Antworte AUSSCHLIESSLICH als JSON-Objekt in diesem Format (kein Markdown, keine Erklärungen davor/danach):
{
  "verdict": "WAHR" | "TEILWEISE_WAHR" | "FALSCH" | "IRREFÜHREND" | "UNBEKANNT",
  "confidence": 0-100,
  "summary": "Kurze Zusammenfassung (max. 2 Sätze)",
  "details": "Detaillierte Erklärung mit wissenschaftlichem Hintergrund (max. 4 Sätze)",
  "claims": [
    { "claim": "Behauptung", "verdict": "WAHR"|"FALSCH"|"FRAGWÜRDIG", "explanation": "kurze Erklärung" }
  ],
  "sources_hint": "Welche Quellen wären relevant (z.B. RKI, WHO, PubMed, Fact-Checker)",
  "category": "Gesundheit" | "Politik" | "Wissenschaft" | "Wirtschaft" | "Geschichte" | "Allgemein"
}

Sei präzise, neutral und basiere deine Analyse auf wissenschaftlichem Konsens.`;
}

// ── Message Router ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_POST") {
    const { text, config } = request;

    const handler = {
      anthropic: () => analyzeWithAnthropic(text, config.apiKey, config.anthropicModel),
      ollama:    () => analyzeWithOllama(text, config.ollamaUrl, config.ollamaModel),
      openai:    () => analyzeWithOpenAI(text, config.openaiUrl, config.openaiKey, config.openaiModel),
    }[config.provider];

    if (!handler) {
      sendResponse({ success: false, error: `Unbekannter Provider: ${config.provider}` });
      return true;
    }

    handler()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));

    return true;
  }

  if (request.type === "TEST_CONNECTION") {
    testConnection(request.config)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ── Helper: extract JSON from model response ───────────────────────────────
function extractJSON(text) {
  try { return JSON.parse(text.trim()); } catch (_) {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) { try { return JSON.parse(block[1].trim()); } catch (_) {} }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) {} }
  throw new Error("Konnte kein JSON aus der Antwort extrahieren. Bitte versuche ein anderes Modell.");
}

// ── Anthropic ──────────────────────────────────────────────────────────────
async function analyzeWithAnthropic(postText, apiKey, model) {
  if (!apiKey) throw new Error("Kein Anthropic API-Key konfiguriert.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [{
        role: "user",
        content: `Analysiere diesen Facebook-Post auf Fehlinformationen:\n\n"${postText.substring(0, 2000)}"`
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API-Fehler: ${response.status}`);
  }

  const data = await response.json();
  return extractJSON(data.content[0].text);
}

// ── Ollama ─────────────────────────────────────────────────────────────────
async function analyzeWithOllama(postText, baseUrl, model) {
  const url = (baseUrl || "http://localhost:11434").replace(/\/$/, "");
  if (!model) throw new Error("Kein Ollama-Modell konfiguriert.");

  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `Analysiere diesen Facebook-Post auf Fehlinformationen:\n\n"${postText.substring(0, 2000)}"`
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama-Fehler ${response.status}: ${body.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.message?.content || data.response || "";
  if (!text) throw new Error("Leere Antwort von Ollama. Ist das Modell geladen?");
  return extractJSON(text);
}

// ── OpenAI-compatible ──────────────────────────────────────────────────────
async function analyzeWithOpenAI(postText, baseUrl, apiKey, model) {
  const url = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!model) throw new Error("Kein Modell konfiguriert.");

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `Analysiere diesen Facebook-Post auf Fehlinformationen:\n\n"${postText.substring(0, 2000)}"`
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API-Fehler ${response.status} von ${url}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Leere Antwort vom OpenAI-kompatiblen Endpunkt.");
  return extractJSON(text);
}

// ── Connection Test ────────────────────────────────────────────────────────
async function testConnection(config) {
  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) throw new Error("Kein API-Key angegeben.");
      const r = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" }
      });
      if (!r.ok) throw new Error(`Anthropic: HTTP ${r.status} – Key ungültig?`);
      return { message: "Anthropic API erreichbar ✓" };
    }
    case "ollama": {
      const url = (config.ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
      const r = await fetch(`${url}/api/tags`);
      if (!r.ok) throw new Error(`Ollama nicht erreichbar (${r.status})`);
      const d = await r.json();
      const models = (d.models || []).map(m => m.name).join(", ") || "–";
      return { message: `Ollama erreichbar ✓\nVerfügbare Modelle:\n${models}` };
    }
    case "openai": {
      const url = (config.openaiUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      const headers = { "Content-Type": "application/json" };
      if (config.openaiKey) headers["Authorization"] = `Bearer ${config.openaiKey}`;
      const r = await fetch(`${url}/models`, { headers });
      if (!r.ok) throw new Error(`Endpunkt nicht erreichbar (${r.status})`);
      return { message: `OpenAI-Endpunkt erreichbar ✓\n${url}` };
    }
    default:
      throw new Error("Unbekannter Provider");
  }
}
