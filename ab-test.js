// ab-test.js
// Compara Haiku 4.5 vs Sonnet 5 generando meta-descripciones SEO para 5 paginas,
// con el mismo prompt. Registra tokens, costo estimado y latencia por llamada.
//
// Uso:
//   npm install
//   cp .env.example .env   # y pega tu ANTHROPIC_API_KEY
//   npm run ab-test

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// --- Paginas a probar (editar con tus paginas/producto reales) ---
const PAGES = [
  { name: "Curso de Ingenieria de Agentes", keyword: "ingenieria de agentes" },
  { name: "Curso de Python para Data Science", keyword: "python para data science" },
  { name: "Bootcamp de Desarrollo Web Full Stack", keyword: "desarrollo web full stack" },
  { name: "Curso de Prompt Engineering", keyword: "prompt engineering" },
  { name: "Certificacion en Ciberseguridad", keyword: "certificacion en ciberseguridad" },
];

// --- Modelos a comparar (precios oficiales por 1M tokens) ---
const MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    pricePerMTokIn: 1,
    pricePerMTokOut: 5,
    thinking: undefined, // Haiku no piensa por defecto; no hace falta configurar nada
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    pricePerMTokIn: 2,
    pricePerMTokOut: 10,
    thinking: { type: "disabled" }, // desactivado para comparar manzanas con manzanas (Sonnet 5 razona por defecto)
  },
];

const MAX_TOKENS = 200;

function buildPrompt(page) {
  return (
    `Escribe una meta-descripcion SEO para la pagina de "${page.name}". ` +
    `Maximo 155 caracteres, con la palabra clave principal ("${page.keyword}"), ` +
    `en espanol, atractiva y clara. Devuelve solo el texto, sin comillas ni explicacion.`
  );
}

function estimateCostUSD(usage, model) {
  const inputCost = (usage.input_tokens / 1_000_000) * model.pricePerMTokIn;
  const outputCost = (usage.output_tokens / 1_000_000) * model.pricePerMTokOut;
  return inputCost + outputCost;
}

async function runOne(client, model, page) {
  const prompt = buildPrompt(page);
  const start = performance.now();

  const req = {
    model: model.id,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  };
  if (model.thinking) req.thinking = model.thinking;

  const response = await client.messages.create(req);
  const latencyMs = performance.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  const text = (textBlock?.text ?? "").trim();

  const costUSD = estimateCostUSD(response.usage, model);

  return {
    page: page.name,
    model: model.label,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUSD,
    latencyMs: Math.round(latencyMs),
    text,
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY. Copia .env.example a .env y agrega tu key.");
    process.exit(1);
  }

  const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  const results = [];

  for (const page of PAGES) {
    for (const model of MODELS) {
      try {
        const result = await runOne(client, model, page);
        results.push(result);
        console.log(`OK  [${result.model}] ${result.page} -> "${result.text}"`);
      } catch (err) {
        console.error(`FAIL [${model.label}] ${page.name}:`, err.message ?? err);
        results.push({
          page: page.name,
          model: model.label,
          inputTokens: 0,
          outputTokens: 0,
          costUSD: 0,
          latencyMs: 0,
          text: `<error: ${err.message ?? err}>`,
        });
      }
    }
  }

  // --- Tabla comparativa detallada ---
  console.log("\n=== Detalle por pagina y modelo ===");
  console.table(
    results.map((r) => ({
      Pagina: r.page,
      Modelo: r.model,
      "Tokens in": r.inputTokens,
      "Tokens out": r.outputTokens,
      "Costo (USD)": r.costUSD.toFixed(6),
      "Latencia (ms)": r.latencyMs,
    })),
  );

  // --- Totales por modelo ---
  const totals = {};
  for (const r of results) {
    if (!totals[r.model]) {
      totals[r.model] = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0, latencySum: 0 };
    }
    const t = totals[r.model];
    t.calls += 1;
    t.inputTokens += r.inputTokens;
    t.outputTokens += r.outputTokens;
    t.costUSD += r.costUSD;
    t.latencySum += r.latencyMs;
  }

  console.log("\n=== Totales por modelo ===");
  console.table(
    Object.entries(totals).map(([model, t]) => ({
      Modelo: model,
      Llamadas: t.calls,
      "Tokens in (total)": t.inputTokens,
      "Tokens out (total)": t.outputTokens,
      "Costo total (USD)": t.costUSD.toFixed(6),
      "Latencia promedio (ms)": Math.round(t.latencySum / t.calls),
    })),
  );
}

main();
