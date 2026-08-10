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
  const language = options.language || 'english';
  const inputMode = options.inputMode || (language === 'hindi' ? 'hinglish' : 'english');
  const responseStyle = options.responseStyle;

  const langInstruction = language === 'hindi'
    ? inputMode === 'hinglish'
      ? 'Respond in natural, conversational Hinglish (Hindi written in English letters). Keep the tone warm, professional, and friendly.'
      : 'Respond in polite, conversational Hindi. Keep the tone helpful and professional.'
    : 'Respond in clear, professional, modern English with a warm and helpful tone.';

  const formattingInstruction = `
Format your answers like a top-tier AI Assistant (ChatGPT / Claude):
1. **Clear Structure**: Use bold section titles with appropriate emojis (e.g. 📊 **Overview**, 📋 **Student Details**, 💰 **Fee Breakdown**, ✍️ **Drafted Message**).
2. **Key Metric Highlights**: When statistics, counts, or monetary figures are present, highlight them clearly (e.g. *Total Enquiries: 12* | *Pending: ₹45,000*).
3. **Structured Cards**: When displaying students or enquiries, format each as a neat structured block:
   - **[Student Name]** • [Course] • 📱 [Mobile]
   - Status: [🟢 Active / 🟡 Follow-up / 🔴 Overdue] | Amount / Info: [Details]
4. **Drafting Messages**: When asked to draft a message, provide a clean, copy-paste-ready WhatsApp/SMS message with placeholders like [Student Name].
5. **Next Steps & Quick Tips**: Always include a 1-line helpful suggestion at the end (e.g. *💡 You can say "Call [Name]" or "Show pending fees" to explore further.*).
6. **No Raw Dumps**: Never dump raw unformatted JSON or walls of plain text.
7. **Unrecognized / Ambiguous Query Guidance**: If the query is completely unclear, confused, or random text, reply politely with guided choices:
   - "Hmm, mujhe ye samajh nahi aaya! 🤔\n\nAap mujhse ye puch sakte hain:\n• 📊 **Overview** — CRM summary dekhne ke liye\n• 📅 **Today followups** — Aaj ke follow-ups\n• 💰 **Pending fees** — Fees dues ki list\n• ➕ **New Enquiry** — Nayi enquiry add karne ke liye\n• 🎓 **Direct Admission** — Direct admission ke liye\n\nNiche quick chips click karein ya fir se type karein! 👇"`;

  const suggestionInstruction = data && Array.isArray(data.suggestions) && data.suggestions.length
    ? 'No exact match was found. Offer these likely matches and ask the user to confirm:\n' + data.suggestions.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '';

  const styleInstruction = responseStyle ? `Specific User Preference: ${responseStyle}` : '';

  return `You are SSSAM AI Assistant, the intelligent AI assistant for SSSAM Coaching & Education CRM.
You help staff and administrators manage admissions, follow-ups, fee payments, enquiry leads, message drafting, and institute operations.

${langInstruction}
${formattingInstruction}
${styleInstruction}
${suggestionInstruction}

Here is the live CRM data context:
${JSON.stringify(data, null, 2)}`;
}

function formatFallbackLocalResponse(query, data, options = {}) {
  const isHindi = options.language === 'hindi';

  if (!data || Object.keys(data).length === 0) {
    return isHindi
      ? `Aapki query "${query}" ke liye koi result nahi mila. Please naam, mobile number, ya email check kijiye.`
      : `No results found for "${query}". Please check the name, mobile number, or email.`;
  }

  // 1. Analytics Summary
  if (data.type === 'analytics_summary' && data.analytics) {
    const a = data.analytics;
    if (isHindi) {
      return `📊 **SSSAM CRM ओवरव्यू व एनालिटिक्स**\n\n` +
        `• 👨‍🎓 **कुल सक्रिय छात्र (Active Students):** ${a.activeStudents}\n` +
        `• 🆕 **इस महीने के एडमिशन्स (This Month):** ${a.thisMonthAdmissions} (आज: ${a.todayAdmissions})\n` +
        `• 📋 **कुल इन्क्वायरी लीड्स:** ${a.totalEnquiries} (नई लीड्स: ${a.newEnquiries})\n` +
        `• 📅 **आज के फॉलो-अप्स:** ${a.todayFollowupsCount}\n` +
        `• 💰 **कुल पेंडिंग फीस:** ₹${(a.totalPendingFees || 0).toLocaleString('en-IN')}\n\n` +
        `💡 *सुझाव:* किसी भी जानकारी के लिए 'today follow up' या 'pending fees' कहें।`;
    }
    return `📊 **SSSAM CRM Overview & Analytics**\n\n` +
      `• 👨‍🎓 **Total Active Students:** ${a.activeStudents}\n` +
      `• 🆕 **This Month's Admissions:** ${a.thisMonthAdmissions} (Today: ${a.todayAdmissions})\n` +
      `• 📋 **Total Enquiries:** ${a.totalEnquiries} (New Leads: ${a.newEnquiries})\n` +
      `• 📅 **Today's Scheduled Follow-ups:** ${a.todayFollowupsCount}\n` +
      `• 💰 **Total Outstanding Pending Fees:** ₹${(a.totalPendingFees || 0).toLocaleString('en-IN')}\n\n` +
      `💡 *Tip:* Ask "show today's follow-ups" or "who has pending fees" for detailed breakdowns.`;
  }

  // 2. Course Info
  if (data.type === 'course_info') {
    const courses = data.courses || [];
    if (courses.length === 0) {
      return isHindi ? '📚 संस्थान में अभी कोई कोर्स सक्रिय नहीं है।' : '📚 No active courses found.';
    }
    let text = isHindi ? `📚 **SSSAM कोर्सेस व विवरण (${courses.length} Courses):**\n\n` : `📚 **SSSAM Active Courses (${courses.length} Courses):**\n\n`;
    courses.forEach((c, i) => {
      text += `${i + 1}. **${c.name}**\n   • Enrolled Students: ${c.enrolledStudents}\n   • Fee Range: ₹${c.feeRange.min.toLocaleString('en-IN')} - ₹${c.feeRange.max.toLocaleString('en-IN')}\n\n`;
    });
    return text.trim();
  }

  // 3. Draft Message
  if (data.type === 'draft_message' && data.template) {
    const t = data.template;
    return isHindi
      ? `✍️ **तैयार किया गया मैसेज ड्राफ्ट (${t.type.toUpperCase()}):**\n\n📌 **विषय:** ${t.subject}\n\n---\n${t.body}\n---\n\n💡 *कॉपी करके छात्र को WhatsApp या SMS पर भेजें।*`
      : `✍️ **Drafted Message Template (${t.type.toUpperCase()}):**\n\n📌 **Subject:** ${t.subject}\n\n---\n${t.body}\n---\n\n💡 *Ready to copy & paste into WhatsApp or SMS.*`;
  }

  // 4. Today Followups
  if (data.type === 'today_followups') {
    const followups = data.followups || [];
    if (followups.length === 0) {
      return isHindi
        ? `📅 Aaj ke liye koi pending follow-up nahi hai! Sab set hai.`
        : `📅 No follow-ups scheduled for today. All clear!`;
    }
    let text = isHindi ? `📅 **आज के ${data.count} Follow-up(s):**\n\n` : `📅 **Today's ${data.count} Scheduled Follow-up(s):**\n\n`;
    followups.forEach((f, i) => {
      text += `${i + 1}. **${f.name}** (📱 ${f.mobile})\n   • Course: ${f.course || 'N/A'}\n   • Time: ${f.followUpTime || 'Today'}\n   • Counselor: ${f.assignedTo || 'Unassigned'}\n\n`;
    });
    return text.trim();
  }

  // 5. Pending Fees
  if (data.type === 'pending_fees') {
    const students = data.students || [];
    if (students.length === 0) {
      return isHindi ? `💰 Koi pending fees nahi mili!` : `💰 No students with pending fees found!`;
    }
    let text = isHindi ? `💰 **पेंडिंग फीस विवरण (${data.count} Students):**\n\n` : `💰 **Outstanding Pending Fees (${data.count} Students):**\n\n`;
    students.forEach((s, i) => {
      text += `${i + 1}. **${s.name}** (📱 ${s.mobile})\n   • Course: ${s.course || 'N/A'}\n   • Pending Due: **₹${(s.pendingAmount || 0).toLocaleString('en-IN')}**\n   • Due Date: ${s.dueDate || 'Immediate'}\n\n`;
    });
    return text.trim();
  }

  // 6. Mobile Search
  if (data.type === 'mobile_search') {
    const e = data.enquiry;
    const a = data.admission;
    if (!e && !a) {
      return isHindi
        ? `📱 Mobile number **${data.mobile}** ka koi record nahi mila.`
        : `📱 No record found for mobile number **${data.mobile}**.`;
    }
    let text = `📱 **Details for ${data.mobile}:**\n\n`;
    if (a) {
      text += `🎓 **Admission Record:**\n• Name: **${a.name}**\n• Course: ${a.course}\n• Pending Fee: ₹${a.pendingAmount}\n• Status: ${a.status}\n\n`;
    }
    if (e) {
      text += `📋 **Enquiry Record:**\n• Name: **${e.name}**\n• Course: ${e.course}\n• Email: ${e.email || 'N/A'}\n• Status: ${e.status}\n• Assigned To: ${e.assignedTo}\n\n`;
    }
    return text.trim();
  }

  // 7. Email Search
  if (data.type === 'email_search') {
    const e = data.enquiry;
    const a = data.admission;
    if (!e && !a) {
      return isHindi
        ? `📧 Email **${data.email}** ka koi record nahi mila.`
        : `📧 No record found for email **${data.email}**.`;
    }
    let text = `📧 **Details for ${data.email}:**\n\n`;
    if (a) {
      text += `🎓 **Admission:** ${a.name} (${a.course}) - Fees: ₹${a.totalFees}\n\n`;
    }
    if (e) {
      text += `📋 **Enquiry:** ${e.name} (${e.course}) - Status: ${e.status}\n\n`;
    }
    return text.trim();
  }

  // 8. Name Search
  if (data.type === 'name_search') {
    const enq = data.enquiries || [];
    const adm = data.admissions || [];

    if (enq.length === 0 && adm.length === 0) {
      if (data.suggestions && data.suggestions.length > 0) {
        let sugText = data.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
        return isHindi
          ? `Mujhe "${data.searchTerm}" ka exact record nahi mila. Kya aap inmein se kisi ko dhoondh rahe the?\n\n${sugText}`
          : `No exact match for "${data.searchTerm}". Did you mean one of these?\n\n${sugText}`;
      }
      return isHindi
        ? `🔍 "${data.searchTerm}" naam se koi student ya enquiry nahi mili.`
        : `🔍 No student or enquiry found for "${data.searchTerm}".`;
    }

    let text = `🔍 **Search Results for "${data.searchTerm}":**\n\n`;
    if (adm.length > 0) {
      text += `🎓 **Admissions (${adm.length}):**\n`;
      adm.forEach((a, i) => {
        text += `${i + 1}. **${a.name}** | Course: ${a.course} | Mobile: ${a.mobile} | Pending: ₹${a.pendingAmount}\n`;
      });
      text += `\n`;
    }
    if (enq.length > 0) {
      text += `📋 **Enquiries (${enq.length}):**\n`;
      enq.forEach((e, i) => {
        text += `${i + 1}. **${e.name}** | Course: ${e.course} | Mobile: ${e.mobile} | Status: ${e.status}\n`;
      });
    }
    return text.trim();
  }

  // 9. Attendance Report
  if (data.type === 'attendance_report') {
    if (isHindi) {
      let text = `📋 **आज की स्टाफ अटेंडेंस रिपोर्ट (${data.date})**\n\n` +
        `• 👥 **कुल स्टाफ:** ${data.totalStaff}\n` +
        `• 🟢 **उपस्थित (Present):** ${data.present}\n` +
        `• 🔴 **अनुपस्थित (Absent):** ${data.absent}\n` +
        `• 🟡 **छुट्टी (Leave/Weekoff):** ${data.onLeave + data.weekoff}\n\n` +
        `**स्टाफ उपस्थिति विवरण:**\n`;
      (data.staff || []).forEach((s, i) => {
        const timeStr = s.inTime ? ` (IN: ${s.inTime}${s.outTime ? `, OUT: ${s.outTime}` : ''})` : '';
        text += `${i + 1}. **${s.name}** [${s.role}] — ${s.status === 'PRESENT (IN)' || s.status === 'PUNCHED OUT' ? '🟢' : s.status === 'LEAVE' ? '🟡' : '🔴'} ${s.status}${timeStr}\n`;
      });
      return text.trim();
    }
    let text = `📋 **Staff Attendance Report (${data.date})**\n\n` +
      `• 👥 **Total Staff:** ${data.totalStaff}\n` +
      `• 🟢 **Present:** ${data.present}\n` +
      `• 🔴 **Absent:** ${data.absent}\n` +
      `• 🟡 **On Leave/Weekoff:** ${data.onLeave + data.weekoff}\n\n` +
      `**Staff Breakdown:**\n`;
    (data.staff || []).forEach((s, i) => {
      const timeStr = s.inTime ? ` (IN: ${s.inTime}${s.outTime ? `, OUT: ${s.outTime}` : ''})` : '';
      text += `${i + 1}. **${s.name}** (${s.role}) — ${s.status === 'PRESENT (IN)' || s.status === 'PUNCHED OUT' ? '🟢' : s.status === 'LEAVE' ? '🟡' : '🔴'} ${s.status}${timeStr}\n`;
    });
    return text.trim();
  }

  // 10. Payment / Fee Collection Report
  if (data.type === 'payment_report') {
    if (isHindi) {
      let text = `💰 **फीस कलेक्शन व पेमेंट रिपोर्ट**\n\n` +
        `• 💵 **आज का कलेक्शन (Today):** ₹${(data.todayCollection || 0).toLocaleString('en-IN')} (${data.todayCount} ट्रांजेक्शन)\n` +
        `• 📈 **इस महीने का कलेक्शन (This Month):** ₹${(data.monthCollection || 0).toLocaleString('en-IN')} (${data.monthCount} ट्रांजेक्शन)\n\n` +
        `**हाल के पेमेंट्स (Recent Transactions):**\n`;
      (data.recentTransactions || []).forEach((t, i) => {
        text += `${i + 1}. **${t.studentName}** — ₹${(t.amount || 0).toLocaleString('en-IN')} (${t.mode}) [${t.date}]\n`;
      });
      return text.trim();
    }
    let text = `💰 **Fee Collection & Revenue Report**\n\n` +
      `• 💵 **Today's Collection:** ₹${(data.todayCollection || 0).toLocaleString('en-IN')} (${data.todayCount} transactions)\n` +
      `• 📈 **This Month's Collection:** ₹${(data.monthCollection || 0).toLocaleString('en-IN')} (${data.monthCount} transactions)\n\n` +
      `**Recent Transactions:**\n`;
    (data.recentTransactions || []).forEach((t, i) => {
      text += `${i + 1}. **${t.studentName}** — ₹${(t.amount || 0).toLocaleString('en-IN')} (${t.mode}) [${t.date}]\n`;
    });
    return text.trim();
  }

  return isHindi
    ? `Main aapke CRM prashna mein sahayata karne ke liye taiyaar hoon.`
    : `I am ready to assist you with any CRM query.`;
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

  try {
    return await callWithFallback(primary, fallback);
  } catch (err) {
    console.warn(`AI Provider failed (${err.message}). Using local fallback formatter.`);
    return formatFallbackLocalResponse(query, data, options);
  }
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

  try {
    return await callWithFallback(primary, fallback);
  } catch (err) {
    console.warn(`AI JSON Provider failed (${err.message}). Returning null fallback.`);
    return null;
  }
}

module.exports = { callGemini, callGroq, formatCRMResponse, parseJSONResponse };
