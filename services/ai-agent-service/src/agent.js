import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, runTool } from './tools.js';

const SYSTEM_PROMPT = `You are a friendly job-search assistant for a kariyer.net-style site.
Your job is to help users:
 1) discover relevant job postings by calling the search_jobs tool, and
 2) apply to a posting by calling apply_to_job once they've explicitly chosen one.

Guidelines:
- Always call search_jobs when the user mentions any job criteria (position, city, working type).
- Show at most 5 results; present each as a single line: "{title} - {city} - {company_name}".
- After listing results, ask which one they want to know more about or apply to.
- Only call apply_to_job after the user explicitly confirms "yes, apply" for a specific job.
- If the user is not logged in, tell them they need to sign in before applying.
- Keep responses short and conversational in the user's language (Turkish if they're typing Turkish).`;

let anthropicClient = null;

function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

function getProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  return 'demo';
}

function staticFallback(userText) {
  return {
    reply: `[Demo mode] "${userText}" sorgusu icin is aramaya baslayabilirsiniz. Site uzerinden arama yapin veya gercek AI yanitlari icin ANTHROPIC_API_KEY ya da GEMINI_API_KEY ekleyin.`,
    toolCalls: [],
  };
}

async function chatWithAnthropic({ messages, userId }) {
  const c = getAnthropicClient();
  const formatted = messages.map((m) => ({ role: m.role, content: m.content }));

  let response = await c.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: toolDefinitions,
    messages: formatted,
  });

  const toolCalls = [];
  let safety = 0;
  while (response.stop_reason === 'tool_use' && safety < 3) {
    safety += 1;
    const assistantBlocks = response.content;
    const toolUseBlocks = assistantBlocks.filter((b) => b.type === 'tool_use');

    const toolResults = [];
    for (const tu of toolUseBlocks) {
      const result = await runTool(tu.name, tu.input, { userId });
      toolCalls.push({ name: tu.name, input: tu.input, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }

    formatted.push({ role: 'assistant', content: assistantBlocks });
    formatted.push({ role: 'user', content: toolResults });

    response = await c.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: formatted,
    });
  }

  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { reply: reply || 'Bir sorunla karsilastim. Tekrar dener misiniz?', toolCalls };
}

function toGeminiTools() {
  return [{
    functionDeclarations: toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    })),
  }];
}

function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function callGemini(contents) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: toGeminiTools(),
        generationConfig: { maxOutputTokens: 1024 },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function chatWithGemini({ messages, userId }) {
  const contents = toGeminiContents(messages);
  const toolCalls = [];
  let safety = 0;
  let result = await callGemini(contents);

  while (safety < 3) {
    safety += 1;
    const parts = result.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts
      .map((part) => part.functionCall)
      .filter(Boolean);

    if (functionCalls.length === 0) {
      const reply = parts
        .map((part) => part.text)
        .filter(Boolean)
        .join('\n')
        .trim();

      return { reply: reply || 'Bir sorunla karsilastim. Tekrar dener misiniz?', toolCalls };
    }

    contents.push({
      role: 'model',
      parts: functionCalls.map((functionCall) => ({ functionCall })),
    });

    const toolResultParts = [];
    for (const functionCall of functionCalls) {
      const input = functionCall.args || {};
      const resultForTool = await runTool(functionCall.name, input, { userId });
      toolCalls.push({ name: functionCall.name, input, result: resultForTool });
      toolResultParts.push({
        functionResponse: {
          name: functionCall.name,
          response: resultForTool,
        },
      });
    }

    contents.push({ role: 'user', parts: toolResultParts });
    result = await callGemini(contents);
  }

  return { reply: 'Arama aracini calistirdim ama yaniti tamamlayamadim. Tekrar dener misiniz?', toolCalls };
}

export async function chat({ messages, userId }) {
  const last = messages[messages.length - 1];
  const lastUserText = last?.content || '';
  const provider = getProvider();

  if (provider === 'anthropic') return chatWithAnthropic({ messages, userId });
  if (provider === 'gemini') return chatWithGemini({ messages, userId });
  return staticFallback(lastUserText);
}

export function aiProvider() {
  return getProvider();
}
