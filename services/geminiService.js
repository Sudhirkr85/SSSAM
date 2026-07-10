const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const PRIMARY_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();
const FALLBACK_PROVIDER = (process.env.AI_FALLBACK_PROVIDER || 'gemini').toLowerCase();

function postJson(urlString, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            const message = parsed.error?.message || `HTTP ${res.statusCode}`;
            return reject(new Error(message));
          }
          resolve(parsed);
        } catch (error) {
          reject(new Error('Failed to parse AI provider response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callGemini(systemContext, userMessage) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemContext}\n\nUser Query: ${userMessage}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      topP: 0.8
    }
  });

  const parsed = await postJson(GEMINI_API_URL, {}, body);
  if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
    return parsed.candidates[0].content.parts[0].text;
  }

  throw new Error('Invalid Gemini API response');
}

async function callGroq(systemContext, userMessage, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  const body = JSON.stringify({
    model: options.model || GROQ_MODEL,
    messages: [
      { role: 'system', content: systemContext },
      { role: 'user', content: userMessage }
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1024,
    top_p: options.topP ?? 0.8
  });

  const parsed = await postJson(GROQ_API_URL, {
    Authorization: `Bearer ${GROQ_API_KEY}`
  }, body);

  if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
    return parsed.choices[0].message.content;
  }

  throw new Error('Invalid Groq API response');
}

async function callGroqJson(systemContext, userMessage) {
  const raw = await callGroq(systemContext, userMessage, {
    temperature: 0.1,
    maxTokens: 256
  });
  return JSON.parse(raw.trim());
}

async function callGeminiJson(systemContext, userMessage) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemContext}\n\nUser Query: ${userMessage}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json'
    }
  });

  const parsed = await postJson(GEMINI_API_URL, {}, body);
  if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
    const rawText = parsed.candidates[0].content.parts[0].text;
    return JSON.parse(rawText.trim());
  }

  throw new Error('Invalid Gemini API response');
}

async function callWithFallback(primary, fallback) {
  try {
    return await primary();
  } catch (primaryError) {
    if (!fallback) {
      throw primaryError;
    }
    console.warn(`Primary AI provider failed: ${primaryError.message}. Falling back.`);
    return await fallback();
  }
}

function buildResponseSystemContext(data, options = {}) {
  const language = options.language || 'hindi';
  const inputMode = options.inputMode || (language === 'hindi' ? 'hinglish' : 'english');
  const responseStyle = options.responseStyle;

  const langInstruction = language === 'hindi'
    ? inputMode === 'hinglish'
      ? 'Understand Hinglish typed in English letters and respond in natural Hindi written in English letters. Do not switch to Devanagari unless the user explicitly asks for it. Keep the tone friendly and easy to understand.'
      : 'Respond in Hindi. Keep it conversational and friendly.'
    : 'Respond in clear, proper English. Keep it conversational and friendly.';

  const suggestionInstruction = data && Array.isArray(data.suggestions) && data.suggestions.length
    ? 'No exact match was found. Offer these likely matches and ask the user to confirm one of them:\n' + data.suggestions.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : 'If data is empty, say so politely and ask one short follow-up question that helps the user refine the search.';

  const styleInstruction = responseStyle
    ? `Follow this response style: ${responseStyle}`
    : 'Keep responses concise, clear, and nicely formatted.';

  return `You are an AI assistant for a coaching institute CRM system called SSSAM CRM.
Your job is to help staff members quickly get information about students, enquiries, follow-ups, and fees.
${langInstruction}
${styleInstruction}
${suggestionInstruction}
Use light formatting for readability, but keep the reply compact.

Here is the CRM data relevant to the query:
${JSON.stringify(data, null, 2)}`;
}

async function formatCRMResponse(query, data, options = {}) {
  const systemContext = buildResponseSystemContext(data, options);
  const primary = PRIMARY_PROVIDER === 'groq'
    ? () => callGroq(systemContext, query)
    : () => callGemini(systemContext, query);
  const fallback = FALLBACK_PROVIDER === 'groq'
    ? () => callGroq(systemContext, query)
    : FALLBACK_PROVIDER === 'gemini'
      ? () => callGemini(systemContext, query)
      : null;

  return await callWithFallback(primary, fallback);
}

async function parseJSONResponse(systemContext, userMessage) {
  const jsonSystemContext = `${systemContext}\nReturn only valid JSON with no markdown or extra commentary.`;
  const primary = PRIMARY_PROVIDER === 'groq'
    ? () => callGroqJson(jsonSystemContext, userMessage)
    : () => callGeminiJson(jsonSystemContext, userMessage);
  const fallback = FALLBACK_PROVIDER === 'groq'
    ? () => callGroqJson(jsonSystemContext, userMessage)
    : FALLBACK_PROVIDER === 'gemini'
      ? () => callGeminiJson(jsonSystemContext, userMessage)
      : null;

  return await callWithFallback(primary, fallback);
}

module.exports = { callGemini, callGroq, formatCRMResponse, parseJSONResponse };
