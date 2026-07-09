const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Call Gemini Flash API with a prompt
 * @param {string} systemContext - System instructions for Gemini
 * @param {string} userMessage - User's actual query
 * @returns {Promise<string>} - Gemini's text response
 */
async function callGemini(systemContext, userMessage) {
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

  return new Promise((resolve, reject) => {
    const url = new URL(GEMINI_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else if (parsed.error) {
            reject(new Error(parsed.error.message || 'Gemini API error'));
          } else {
            reject(new Error('Invalid Gemini API response'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Format CRM data into natural language response using Gemini
 * @param {string} query - Original user query
 * @param {object} data - CRM data fetched from DB
 * @param {string} language - 'hindi' or 'english'
 * @returns {Promise<string>}
 */
async function formatCRMResponse(query, data, language = 'hindi') {
  const langInstruction = language === 'hindi'
    ? 'Respond in Hindi (Devanagari script). Keep it conversational and friendly.'
    : 'Respond in English. Keep it conversational and friendly.';

  const systemContext = `You are an AI assistant for a coaching institute CRM system called SSSAM CRM.
Your job is to help staff members quickly get information about students, enquiries, follow-ups, and fees.
${langInstruction}
Keep responses concise, clear, and formatted nicely.
If data is empty, say so politely.
Use emojis where appropriate to make responses readable.

Here is the CRM data relevant to the query:
${JSON.stringify(data, null, 2)}`;

  return await callGemini(systemContext, query);
}

module.exports = { callGemini, formatCRMResponse };
