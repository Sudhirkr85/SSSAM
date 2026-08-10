const { Enquiry, Admission, Payment, Note, Attendance, User } = require('../models');
const admissionService = require('../services/admission.service');
const { formatCRMResponse, parseJSONResponse } = require('../services/geminiService');
const catchAsync = require('../utils/catchAsync');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Intelligent intent detection from user query
function detectIntent(query) {
  const q = query.toLowerCase().trim();

  // 0A. Add Enquiry Wizard intent
  if (/\b(enqry add|add enquiry|enquiry add|nayi enquiry|new enquiry add|enquiry create|enquiry dalo|enquiry dakhil)\b/i.test(q) ||
      ((q.includes('enquiry') || q.includes('enqry')) && (q.includes('add') || q.includes('karna') || q.includes('kru') || q.includes('banao') || q.includes('dalo') || q.includes('mang') || q.includes('confirm') || q.includes('save')))) {
    return 'add_enquiry_wizard';
  }

  // 0B. Add Admission Wizard intent
  if (/\b(admionss setup|admission setup|admisn setup|direct admission|add admission|admission create|admission dalo|admission banao|admission setup kru)\b/i.test(q) ||
      ((q.includes('admission') || q.includes('admionss') || q.includes('admisn')) && (q.includes('setup') || q.includes('add') || q.includes('kru') || q.includes('karna') || q.includes('banao') || q.includes('puch') || q.includes('confirm') || q.includes('save')))) {
    return 'add_admission_wizard';
  }

  // 1. Mobile number detection (10 digit starting with 6-9)
  if (/\b[6-9]\d{9}\b/.test(q)) {
    if (/\b(call|phone|ring|dial|fon|कॉल|फोन)\b/.test(q)) return 'call';
    if (/\b(whatsapp|wp|wa|message|msg|व्हाट्सएप)\b/.test(q)) return 'whatsapp';
    return 'mobile_search';
  }

  // 2. Email detection
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(q)) {
    return 'email_search';
  }

  // 3. Call intent
  if (/\b(call|phone|ring|dial)\b/.test(q) &&
      (/\b(karo|kro|kr|karna|kijiye|ko|student|lead|him|her|them)\b/.test(q) || /^call\s+/i.test(q))) {
    return 'call';
  }

  // 4. WhatsApp intent
  if (/\b(whatsapp|wp|wa)\b/.test(q) &&
      !/\b(draft|write|template|create|banao|format)\b/.test(q)) {
    return 'whatsapp';
  }

  // 5. Attendance Report intent
  if (/\b(att[a-z]*n[a-z]*c[a-z]*|attendance|attance|attadnace|atendance|attandance|attendence|hajri|hazri|punch|punches|kon aaya|who came|who is present|who is absent|leave|weekoff|उपस्थिति|हाजिरी)\b/i.test(q)) {
    return 'attendance_report';
  }

  // 6. Payment / Revenue / Fee Collection Report intent
  if (/\b(payment report|collection report|revenue report|payments|fee collection|aaj kitna payment|kitna paisa aaya|aaj ki collection|this month collection|collection summary)\b/.test(q)) {
    return 'payment_report';
  }

  // 7. Save note / Custom Memory intent (Teach Jiya AI)
  if (/\b(save note|save message|save data|save info|note likho|note save|isey save|isko save|yaad rakhna|yaad rakho|dhyan rakhna|dhyan rakho|rule set|teach|ye yaad|yaad kar lo|memories)\b/.test(q)) {
    return 'save_note';
  }

  // 7B. Feedback & AI Self-Correction Intent
  if (/\b(feedback|suggestion|galat answer|galat hai|wrong answer|next time|sudhar lo|improve|correction|correct yourself|aise mat|aage se|galat bataya)\b/.test(q)) {
    return 'ai_feedback';
  }

  // 8. Get notes intent
  if (/\b(my notes|saved notes|saved note|saved messages|mere notes|saved list|notes dikhao|notes batao|नोट्स)\b/.test(q)) {
    return 'get_notes';
  }

  // 8. Update status intent (e.g. Rahul ka status update karo / Vikram status INTERESTED)
  if (/\b(status update|update status|status change|change status|status set|status mark|status dalo|status shift|followup change|change followup)\b/i.test(q) ||
      (/\b(status|converted|not interested|no response|contacted|admission process)\b/i.test(q) &&
       (/\b(kar do|kardo|kr do|set|change|update|mark|banao|kar|kro|kr|dalo|shift|rakho|kal|tomorrow)\b/i.test(q) || q.includes('status') || q.includes('update') || q.includes('change')))) {
    return 'update_status';
  }

  // 9. Reschedule follow-up intent (e.g. Sudhir ka follow-up 15 August ko shift kar do)
  if (/\b(followup|follow up|follow-up)\b/.test(q) &&
      /\b(reschedule|shift|change|set|postpone|tomorrow|kal|august|september|october|november|december|january|february|march|april|may|june|july|aug|sep|oct|nov|dec)\b/.test(q) &&
      /\b(kar do|kardo|kr do|set|change|shift|update)\b/.test(q)) {
    return 'reschedule_followup';
  }

  // 10. Message Drafting intent (WhatsApp / SMS / Email draft)
  if (/\b(draft|write|compose|create message|template|message banao|pitch|bhejne ke liye text|sms format|likh do)\b/.test(q)) {
    return 'draft_message';
  }

  // 10. Help / Guide intent
  if (/\b(help|guide|tutorial|kaise use|kaise chalaye|commands|what can you do|features|मदद)\b/.test(q) ||
      q === 'guide' || q === 'help' || q === 'menu') {
    return 'guide';
  }

  // 11. Pending & Upcoming fee intent
  if (/\b(pending fee|pending fees|due fee|due fees|baki fees|unpaid|installment|installments|fees due|fee pending|kiska fee|fee aayega|fee baki|fees baki|kitna baki|banki|upcoming fee|upcoming fees|date wise|datewise|aane wala fee|fees date|fess date|fees kab|fess kab|fee kab|kab aayega|kab h)\b/i.test(q) ||
      ((q.includes('fee') || q.includes('fees') || q.includes('fess') || q.includes('fiis')) && (q.includes('baki') || q.includes('banki') || q.includes('due') || q.includes('aayega') || q.includes('aane') || q.includes('ane') || q.includes('kitna') || q.includes('kab') || q.includes('date') || q.includes('h') || q.includes('hai')))) {
    return 'pending_fee';
  }

  // 12. Analytics / Summary / Stats intent
  if (/\b(summary|overview|stats|statistics|analytics|dashboard|report|count|counts|how many|total|performance|conversion|revenue|collection|kitne|kitna|kitni)\b/.test(q)) {
    return 'analytics_summary';
  }

  // 13. Follow-up intent
  if (/\b(follow up|followup|follow-ups|followups|folloup|follwup|folowup|appointments|schedule|reminders|aaj ke lead|aaj ke call)\b/.test(q) || q.includes('folloup') || q.includes('followup')) {
    return 'followup';
  }

  // 14. Interested leads intent
  if (/\b(interested leads|hot leads|interested enquiries|interested student|interested list|show interested)\b/i.test(q)) {
    return 'interested_leads';
  }

  // 14A. Add Enquiry Wizard intent
  if (/\b(enqry add|add enquiry|enquiry add|nayi enquiry|new enquiry add|enquiry create|enquiry dalo|enquiry dakhil)\b/i.test(q) ||
      ((q.includes('enquiry') || q.includes('enqry')) && (q.includes('add') || q.includes('karna') || q.includes('kru') || q.includes('banao') || q.includes('dalo') || q.includes('mang')))) {
    return 'add_enquiry_wizard';
  }

  // 14B. Add Admission Wizard intent
  if (/\b(admionss setup|admission setup|admisn setup|direct admission|add admission|admission create|admission dalo|admission banao|admission setup kru)\b/i.test(q) ||
      ((q.includes('admission') || q.includes('admionss') || q.includes('admisn')) && (q.includes('setup') || q.includes('add') || q.includes('kru') || q.includes('karna') || q.includes('banao') || q.includes('puch')))) {
    return 'add_admission_wizard';
  }

  // 15. New enquiries intent
  if (/\b(new enquiry|new enquiries|latest enquiries|fresh enquiries|recent enquiries)\b/.test(q)) {
    return 'new_enquiries';
  }

  // 16. Course information intent
  if (/\b(courses|course list|syllabus|batches|batch timing|fee structure|what courses|konse course|courses offer)\b/.test(q)) {
    return 'course_info';
  }

  // 17. Search for student/enquiry record
  if (/\b(search|find|dikhao|batao|details of|record of|profile of|info of|check)\b/.test(q) &&
      !/\b(how are you|who are you|what is|why|can you)\b/.test(q)) {
    return 'record_search';
  }

  // If user types a short name like "Priya", "Rahul Sharma" (2-3 words, not greetings/questions)
  const isGreetingOrQuestion = /\b(hi|hello|hey|namaste|morning|evening|how|what|why|who|where|can|thank|thanks|ok|okay)\b/.test(q);
  if (!isGreetingOrQuestion && /^[a-zA-Z\s]{2,35}$/.test(q) && q.split(/\s+/).length <= 3) {
    return 'record_search';
  }

  // 16. General AI / Conversational intent (questions about CRM, greetings, advice)
  return 'general_ai';
}

// Extract search term from query
function extractSearchTerm(query, intent) {
  const q = query.trim();

  if (intent === 'mobile_search') {
    const match = q.match(/\b[6-9]\d{9}\b/);
    return match ? match[0] : null;
  }

  if (intent === 'email_search') {
    const match = q.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  if (intent === 'call' || intent === 'whatsapp') {
    const cleaned = q
      .replace(/\b(call|whatsapp|phone|ring|dial|ko|karo|kro|kr|karna|kijiye|bhejo|send|wp|wa|message|msg|student|lead|contact|him|her|kisi|anyone)\b/gi, '')
      .replace(/[?।,!]/g, '')
      .trim();
    // If nothing meaningful left, return null so full list is shown
    if (!cleaned || cleaned.length < 3) return null;
    return cleaned;
  }

  if (intent === 'save_note') {
    const cleaned = q
      .replace(/^(is message ko\s+)?save\s+(note|message|data)?(\s*karo|\s*kro|\s*kr\s*do)?(\s*:\s*|\s+)/gi, '')
      .replace(/^(सेव करो|लिखो|याद रखना)(\s*:\s*|\s+)/g, '')
      .replace(/\s+(ko\s+)?save\s*(karo|kro|kr\s*do|kr)?$/gi, '')
      .replace(/\s*(सेव करो|लिखो|याद रखना)$/g, '')
      .trim();
    return cleaned || q;
  }

  if (intent === 'pending_fee') {
    const cleaned = q
      .replace(/\b(pending|fees|fee|fess|fiis|due|installments|installment|baki|banki|kitna|kitne|aaj|today|aj|upcoming|date|wise|datewise|aayega|aaya|aayengi|aane|ane|wala|waala|kab|kabka|kabse|kiska|kiskaa|kiskka|kiske|batao|dikhao|ka|ki|ke|ko|hai|h|show|list|all|sab|student|leads|lead|info|details|record)\b/gi, '')
      .replace(/[?।,!]/g, '')
      .trim();
    if (!cleaned || cleaned.length < 2) return null;
    return cleaned;
  }

  if (intent === 'record_search') {
    const cleaned = q
      .replace(/\b(ka|ki|ke|ko|data|dikhao|batao|detail|details|show|find|search|tell|me|mujhe|check|info|profile|record)\b/gi, '')
      .replace(/[?।,!]/g, '')
      .trim();
    return cleaned || q;
  }

  return null;
}

// Detect language preference from query
function detectLanguage(query) {
  const q = query.toLowerCase();
  const hindiChars = /[\u0900-\u097F]/;
  const hindiWords = ['batao', 'dikhao', 'hai', 'hain', 'ka', 'ki', 'ke', 'aaj', 'sab', 'kiska', 'uska', 'baki', 'karo', 'karna', 'mujhe', 'mera', 'kitna', 'kitne'];

  if (hindiChars.test(q) || hindiWords.some((w) => q.includes(w))) {
    return 'hindi';
  }
  return 'english';
}

function resolveLanguagePreference(body, query) {
  if (body && (body.language === 'hindi' || body.language === 'english')) {
    return body.language;
  }
  return detectLanguage(query);
}

function resolveInputMode(body, language) {
  if (body && body.inputMode) {
    return body.inputMode;
  }
  return language === 'hindi' ? 'hinglish' : 'english';
}

function buildClarificationMessage(language, searchTerm, suggestions = []) {
  const safeSearchTerm = searchTerm || 'your query';
  if (!suggestions.length) {
    return language === 'hindi'
      ? `Mujhe "${safeSearchTerm}" ka exact match nahi mila. Thoda aur specific bolo, jaise student ka poora naam ya 10-digit mobile number.`
      : `I couldn't find an exact match for "${safeSearchTerm}". Please type a student name or 10-digit mobile number.`;
  }

  const suggestionText = suggestions.map((item, index) => {
    const label = typeof item === 'object'
      ? `${item.name}${item.course ? ` (${item.course})` : ''}${item.mobile ? ` — ${item.mobile}` : ''}`
      : item;
    return `${index + 1}. ${label}`;
  }).join('\n');

  return language === 'hindi'
    ? `Kya aap inmein se kisi ko dhoondh rahe the?\n\n${suggestionText}\n\n💡 Naam ya mobile number type karein, ya neeche card par click karein.`
    : `Did you mean one of these?\n\n${suggestionText}\n\n💡 Type the name or mobile number, or tap a card below.`;
}

async function findNameSuggestions(searchTerm) {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const tokens = [...new Set(searchTerm.toLowerCase().split(/\s+/).filter((t) => t.length >= 2))];
  if (!tokens.length) return [];

  const query = {
    $or: tokens.flatMap((token) => [
      { name: { $regex: token, $options: 'i' } },
      { course: { $regex: token, $options: 'i' } },
      { mobile: { $regex: token, $options: 'i' } }
    ])
  };

  const [enquiries, admissions] = await Promise.all([
    Enquiry.find(query).select('name mobile course').limit(8).lean(),
    Admission.find(query).select('name mobile course').limit(8).lean()
  ]);

  const merged = [...enquiries, ...admissions];
  const seen = new Set();
  return merged
    .filter((item) => {
      const key = `${item.name}|${item.mobile || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((item) => ({
      name: item.name,
      mobile: item.mobile || null,
      course: item.course || ''
    }));
}

async function getAllContactsList() {
  const [enquiries, admissions] = await Promise.all([
    Enquiry.find({ mobile: { $exists: true, $ne: null } }).select('name mobile course').limit(10).lean(),
    Admission.find({ mobile: { $exists: true, $ne: null } }).select('name mobile course').limit(10).lean()
  ]);
  const merged = [...admissions, ...enquiries];
  const seen = new Set();
  return merged
    .filter((item) => {
      const key = `${item.mobile}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((item) => ({
      name: item.name,
      mobile: item.mobile,
      course: item.course || ''
    }));
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

class ChatController {

  /**
   * POST /api/chat
   * Main chat endpoint — processes user queries with intelligent multi-intent AI
   */
  chat = catchAsync(async (req, res) => {
    const { query, responseStyle } = req.body;

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Query is required', 400);
    }

    const intent = detectIntent(query);
    const language = resolveLanguagePreference(req.body, query);
    const inputMode = resolveInputMode(req.body, language);
    let dbData = {};
    let contextHint = '';
    let action = null;

    // ─── 1. Call / WhatsApp Actions ───────────────────────────────────────
    if (intent === 'call' || intent === 'whatsapp') {
      const searchTerm = extractSearchTerm(query, intent);
      const directMobile = query.match(/\b[6-9]\d{9}\b/);
      let targetMobile = null;
      let targetName = null;
      let prefilledText = null;

      if (intent === 'whatsapp') {
        try {
          const sysPrompt = `Analyze query: user wants to WhatsApp a student.
Extract JSON: {"studentName": string or null, "noteKeyword": string or null}`;
          const parsedWP = await parseJSONResponse(sysPrompt, query);
          if (parsedWP && parsedWP.studentName) {
            targetName = parsedWP.studentName;
            const found = await Enquiry.findOne({ name: { $regex: targetName, $options: 'i' } }).select('name mobile').lean()
              || await Admission.findOne({ name: { $regex: targetName, $options: 'i' } }).select('name mobile').lean();
            if (found) {
              targetMobile = found.mobile;
              targetName = found.name;
            }

            if (parsedWP.noteKeyword && req.user) {
              const matchedNote = await Note.findOne({
                userId: req.user.id,
                $text: { $search: parsedWP.noteKeyword }
              }).select('content').lean()
              || await Note.findOne({
                userId: req.user.id,
                title: { $regex: parsedWP.noteKeyword, $options: 'i' }
              }).select('content').lean();

              if (matchedNote) prefilledText = matchedNote.content;
            }
          }
        } catch (e) {
          console.error('WhatsApp parse error:', e);
        }
      }

      if (!targetMobile) {
        if (directMobile) {
          targetMobile = directMobile[0];
          const found = await Enquiry.findOne({ mobile: targetMobile }).select('name').lean()
            || await Admission.findOne({ mobile: targetMobile }).select('name').lean();
          targetName = found ? found.name : targetMobile;
        } else if (searchTerm && searchTerm.length >= 2) {
          const found = await Enquiry.findOne({ name: { $regex: searchTerm, $options: 'i' } }).select('name mobile').lean()
            || await Admission.findOne({ name: { $regex: searchTerm, $options: 'i' } }).select('name mobile').lean();
          if (found) {
            targetMobile = found.mobile;
            targetName = found.name;
          }
        }
      }

      if (!targetMobile) {
        // If user typed generic "call student" or "whatsapp message" — show full list
        const isGenericQuery = !searchTerm || searchTerm.trim().length < 3 ||
          /^(student|contact|anyone|kisi|sabko|sb)$/.test((searchTerm || '').toLowerCase().trim());

        let suggestions;
        if (isGenericQuery) {
          suggestions = await getAllContactsList();
        } else {
          suggestions = await findNameSuggestions(searchTerm || query);
        }

        const msgHeader = isGenericQuery
          ? (language === 'hindi'
            ? `📞 Kisko ${intent === 'call' ? 'call' : 'WhatsApp'} karna hai? Neeche se choose karein:`
            : `📞 Who would you like to ${intent === 'call' ? 'call' : 'WhatsApp'}? Pick from the list below:`)
          : buildClarificationMessage(language, searchTerm || query, suggestions);

        return successResponse(res, {
          message: msgHeader,
          intent,
          language,
          action: null,
          suggestions: suggestions.length ? suggestions : null
        }, 'Contact not found');
      }

      const actionType = intent;
      let aiMsg = '';
      if (actionType === 'whatsapp' && prefilledText) {
        aiMsg = language === 'hindi'
          ? `💬 **${targetName}** (${targetMobile}) ke liye WhatsApp template ready hai:\n\n> "${prefilledText}"\n\nNeeche button par click karke direct send karein! 👇`
          : `💬 Ready to WhatsApp **${targetName}** (${targetMobile}) with the template:\n\n> "${prefilledText}"\n\nTap the button below to send! 👇`;
      } else {
        aiMsg = language === 'hindi'
          ? `📞 **${targetName}** • Mobile: \`${targetMobile}\`\n\nNeeche button dabakar direct ${actionType === 'call' ? 'Call' : 'WhatsApp'} karein! 👇`
          : `📞 **${targetName}** • Mobile: \`${targetMobile}\`\n\nTap below to ${actionType === 'call' ? 'Call' : 'WhatsApp'} immediately! 👇`;
      }

      return successResponse(res, {
        message: aiMsg,
        intent,
        language,
        action: {
          type: actionType,
          mobile: targetMobile,
          name: targetName,
          text: prefilledText
        }
      }, 'Action generated');
    }

    // ─── 2. Save Custom Note ───────────────────────────────────────────────
    if (intent === 'save_note') {
      let noteContent = extractSearchTerm(query, 'save_note');
      let noteTitle = 'General';

      try {
        const sysPrompt = `Extract note title and content from query.
Return JSON: {"title": string, "content": string}`;
        const parsedNote = await parseJSONResponse(sysPrompt, query);
        if (parsedNote && parsedNote.content) {
          noteTitle = parsedNote.title || 'General';
          noteContent = parsedNote.content;
        }
      } catch (e) {
        console.error('Note parse error:', e);
      }

      if (!noteContent || noteContent.trim().length < 2) {
        const errResponse = language === 'hindi'
          ? '❌ Kripya note ka message likhiye (Jaise: *"save note: Kal batch timings 10 AM hain"*).'
          : '❌ Please provide a message to save (e.g. *"save note: Batch timings are 10 AM tomorrow"*).';
        return successResponse(res, { message: errResponse, intent, language, action: null }, 'Note empty');
      }

      const newNote = await Note.create({
        userId: req.user ? req.user.id : null,
        title: noteTitle,
        content: noteContent
      });

      const responseText = language === 'hindi'
        ? `📝 **Note Successfully Saved!**\n\n📌 **Title:** ${noteTitle}\n📄 **Content:** "${noteContent}"\n\n💡 Kisi student ko WhatsApp bhejne ke liye bole: *"WhatsApp [Student Name] [Title]"*`
        : `📝 **Note Successfully Saved!**\n\n📌 **Title:** ${noteTitle}\n📄 **Content:** "${noteContent}"\n\n💡 To send this to a student on WhatsApp, say: *"WhatsApp [Student Name] [Title]"*`;

      return successResponse(res, {
        message: responseText,
        intent,
        language,
        action: null,
        rawData: newNote
      }, 'Note saved');
    }

    // ─── AI Self-Correction & Feedback Memory Handler ──────────────────────
    if (intent === 'ai_feedback') {
      const feedbackContent = query
        .replace(/\b(feedback|suggestion|galat answer|galat hai|wrong answer|next time|sudhar lo|improve|correction|correct yourself|aise mat|aage se|galat bataya)\b/gi, '')
        .trim() || query;

      const newFeedback = await Note.create({
        userId: req.user ? req.user.id : null,
        title: 'Feedback & Self-Correction Rule',
        content: feedbackContent
      });

      const responseMsg = language === 'hindi'
        ? `🙏 **Feedback Saved & Self-Correction Applied!**\n\n` +
          `Aapka feedback Jiya AI memory mein save kar liya gaya hai:\n` +
          `📌 **Learning Rule:** _"${feedbackContent}"_\n\n` +
          `💡 *Shukriya! Aage se main is naye rule ke hisab se responsive aur accurate rahungi!* ✨`
        : `🙏 **Feedback Saved & Self-Correction Applied!**\n\n` +
          `Your feedback has been saved into Jiya AI memory:\n` +
          `📌 **Learning Rule:** _"${feedbackContent}"_\n\n` +
          `💡 *Thank you! I will follow this guideline for future responses!* ✨`;

      return successResponse(res, { message: responseMsg, intent, language, action: null, rawData: newFeedback }, 'Feedback processed');
    }

    // ─── 3. Get Saved Notes ────────────────────────────────────────────────
    if (intent === 'get_notes') {
      const filter = req.user ? { userId: req.user.id } : {};

      let notes = await Note.find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!notes || notes.length === 0) {
        const noNotesMsg = language === 'hindi'
          ? `📝 Koi saved note nahi mila.\n\nNote save karne ke liye kaho: *"save note: Kal class off rahegi"*`
          : `📝 No saved notes found.\n\nTo save a note, say: *"save note: Class is off tomorrow"*`;
        return successResponse(res, { message: noNotesMsg, intent, language, action: null }, 'No notes');
      }

      let msg = language === 'hindi'
        ? `📋 **Aapke Saved Notes (${notes.length}):**\n\n`
        : `📋 **Your Saved Notes (${notes.length}):**\n\n`;

      notes.forEach((n, i) => {
        msg += `${i + 1}. 📌 **${n.title || 'General'}**\n   "${n.content}"\n\n`;
      });

      return successResponse(res, {
        message: msg.trim(),
        intent,
        language,
        action: {
          type: 'notes_list',
          notes: notes.map((n) => ({
            _id: n._id,
            title: n.title || 'General',
            content: n.content,
            date: new Date(n.createdAt).toLocaleDateString('en-IN')
          }))
        }
      }, 'Notes fetched');
    }

    // ─── 4. Message Drafting Assistant ─────────────────────────────────────
    if (intent === 'draft_message') {
      dbData = {
        type: 'message_drafting',
        institute: 'SSSAM Academy & Coaching',
        request: query
      };
      contextHint = `Draft a high-converting, professional WhatsApp/SMS template based on the user's request: "${query}"`;
    }

    // ─── 4A. Staff Attendance Report (Admin Only) ──────────────────────────
    else if (intent === 'attendance_report') {
      const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : '';
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        const accessDeniedMsg = language === 'hindi'
          ? '🔒 **Access Restricted**: Staff Attendance Report sirf Admin dekh sakte hain.'
          : '🔒 **Access Restricted**: Staff Attendance Report can only be viewed by Administrators.';
        return successResponse(res, { message: accessDeniedMsg, intent, language, action: null }, 'Access denied');
      }

      const isMonth = /\b(month|mahina|mahine|is month|this month|monthly|puro|pure)\b/i.test(query);
      const { start, end } = isMonth ? getMonthRange() : getTodayRange();

      const allUsers = await User.find({ status: { $ne: 'INACTIVE' } }).select('name email role mobile').lean();

      // Check if a specific staff name is mentioned (e.g. "sudhir")
      const mentionedName = allUsers.find(u =>
        u.name && query.toLowerCase().includes(u.name.toLowerCase().split(' ')[0])
      );

      const filterUsers = mentionedName ? [mentionedName] : allUsers;
      const userIds = filterUsers.map(u => u._id);

      const punches = await Attendance.find({
        userId: { $in: userIds },
        timestamp: { $gte: start, $lte: end }
      })
        .populate('userId', 'name role mobile')
        .sort({ timestamp: 1 })
        .lean();

      if (isMonth) {
        // Monthly Summary per staff
        const userStats = {};
        filterUsers.forEach(u => {
          userStats[u._id.toString()] = {
            name: u.name,
            role: u.role,
            mobile: u.mobile,
            presentDays: new Set(),
            leaveDays: new Set(),
            weekoffDays: new Set(),
            totalPunches: 0
          };
        });

        punches.forEach(p => {
          const uId = p.userId?._id?.toString() || p.userId?.toString();
          if (userStats[uId]) {
            const dayKey = new Date(p.timestamp).toISOString().split('T')[0];
            userStats[uId].totalPunches++;
            if (p.type === 'IN' || p.type === 'OUT') userStats[uId].presentDays.add(dayKey);
            if (p.type === 'LEAVE') userStats[uId].leaveDays.add(dayKey);
            if (p.type === 'WEEKOFF') userStats[uId].weekoffDays.add(dayKey);
          }
        });

        const monthlySummary = Object.values(userStats).map(s => ({
          name: s.name,
          role: s.role,
          mobile: s.mobile,
          presentDaysCount: s.presentDays.size,
          leaveDaysCount: s.leaveDays.size,
          weekoffDaysCount: s.weekoffDays.size
        }));

        dbData = {
          type: 'monthly_attendance_report',
          period: `This Month (${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')})`,
          filterTarget: mentionedName ? mentionedName.name : 'All Staff',
          summary: monthlySummary
        };
        contextHint = `Monthly Staff Attendance Report (${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}) for ${mentionedName ? mentionedName.name : 'All Staff'}`;
      } else {
        // Daily Summary
        const userPunchMap = {};
        punches.forEach((p) => {
          const uId = p.userId?._id?.toString() || p.userId?.toString();
          if (!userPunchMap[uId]) {
            userPunchMap[uId] = { in: null, out: null, leave: false, weekoff: false };
          }
          if (p.type === 'IN' && !userPunchMap[uId].in) {
            userPunchMap[uId].in = p.timestamp;
          } else if (p.type === 'OUT') {
            userPunchMap[uId].out = p.timestamp;
          } else if (p.type === 'LEAVE') {
            userPunchMap[uId].leave = true;
          } else if (p.type === 'WEEKOFF') {
            userPunchMap[uId].weekoff = true;
          }
        });

        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;
        let weekoffCount = 0;

        const staffList = filterUsers.map((u) => {
          const p = userPunchMap[u._id.toString()];
          let status = 'ABSENT';
          let inTime = null;
          let outTime = null;

          if (p) {
            if (p.leave) {
              status = 'LEAVE';
              leaveCount++;
            } else if (p.weekoff) {
              status = 'WEEKOFF';
              weekoffCount++;
            } else if (p.in) {
              status = p.out ? 'PUNCHED OUT' : 'PRESENT (IN)';
              presentCount++;
              inTime = new Date(p.in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              if (p.out) {
                outTime = new Date(p.out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              }
            } else {
              absentCount++;
            }
          } else {
            absentCount++;
          }

          return {
            name: u.name,
            role: u.role,
            mobile: u.mobile,
            status,
            inTime,
            outTime
          };
        });

        dbData = {
          type: 'attendance_report',
          date: new Date().toLocaleDateString('en-IN'),
          totalStaff: filterUsers.length,
          present: presentCount,
          absent: absentCount,
          onLeave: leaveCount,
          weekoff: weekoffCount,
          staff: staffList
        };
        contextHint = `Today's Staff Attendance Report for ${new Date().toLocaleDateString('en-IN')}: Total ${filterUsers.length}, Present ${presentCount}, Absent ${absentCount}, Leave ${leaveCount}`;
      }
    }

    // ─── 4B. Payment & Fee Collection Report ───────────────────────────────
    else if (intent === 'payment_report') {
      const { start: todayStart, end: todayEnd } = getTodayRange();
      const { start: monthStart, end: monthEnd } = getMonthRange();

      const [todayPayments, monthPayments, recentPayments] = await Promise.all([
        Payment.find({ paymentDate: { $gte: todayStart, $lte: todayEnd }, status: 'ACTIVE' }).lean(),
        Payment.find({ paymentDate: { $gte: monthStart, $lte: monthEnd }, status: 'ACTIVE' }).lean(),
        Payment.find({ status: 'ACTIVE' })
          .populate({ path: 'admissionId', select: 'name mobile course' })
          .sort({ paymentDate: -1 })
          .limit(10)
          .lean()
      ]);

      const todayTotal = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const monthTotal = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      dbData = {
        type: 'payment_report',
        todayCollection: todayTotal,
        monthCollection: monthTotal,
        todayCount: todayPayments.length,
        monthCount: monthPayments.length,
        recentTransactions: recentPayments.map((p) => ({
          studentName: p.admissionId?.name || 'Student',
          mobile: p.admissionId?.mobile,
          course: p.admissionId?.course,
          amount: p.amount,
          mode: p.paymentMode,
          date: new Date(p.paymentDate).toLocaleDateString('en-IN')
        }))
      };
      contextHint = `Live Payment & Fee Collection Report: Today ₹${todayTotal.toLocaleString('en-IN')} (${todayPayments.length} txn), This Month ₹${monthTotal.toLocaleString('en-IN')}`;
    }

    // ─── 5. Analytics & Live CRM Summary ──────────────────────────────────
    else if (intent === 'analytics_summary') {
      const today = getTodayRange();
      const month = getMonthRange();

      const [
        totalAdmissions,
        monthAdmissions,
        totalEnquiries,
        todayEnquiries,
        todayFollowups,
        admissionsData
      ] = await Promise.all([
        Admission.countDocuments({ status: 'ACTIVE' }),
        Admission.countDocuments({ admissionDate: { $gte: month.start, $lte: month.end } }),
        Enquiry.countDocuments(),
        Enquiry.countDocuments({ createdAt: { $gte: today.start, $lte: today.end } }),
        Enquiry.countDocuments({ followUpDate: { $gte: today.start, $lte: today.end } }),
        Admission.find({ status: 'ACTIVE' }).select('installments registrationAmount totalFees course').lean()
      ]);

      let totalCollected = 0;
      let totalPending = 0;
      const courseCounts = {};

      admissionsData.forEach((adm) => {
        totalCollected += (adm.registrationAmount || 0);
        if (adm.course) {
          courseCounts[adm.course] = (courseCounts[adm.course] || 0) + 1;
        }
        (adm.installments || []).forEach((inst) => {
          if (inst.status === 'PAID') totalCollected += inst.amount;
          if (inst.status === 'PENDING') totalPending += inst.amount;
        });
      });

      dbData = {
        type: 'crm_analytics_summary',
        totalActiveStudents: totalAdmissions,
        newAdmissionsThisMonth: monthAdmissions,
        totalEnquiries,
        todayNewEnquiries: todayEnquiries,
        todayPendingFollowups: todayFollowups,
        totalFeesCollected: `₹${totalCollected.toLocaleString('en-IN')}`,
        totalPendingFees: `₹${totalPending.toLocaleString('en-IN')}`,
        topCourses: Object.entries(courseCounts).map(([c, count]) => `${c} (${count} students)`).slice(0, 5)
      };
      contextHint = 'Comprehensive live CRM performance, revenue, admissions, and enquiries summary';
    }

    // ─── 6. Course & Batch Info ───────────────────────────────────────────
    else if (intent === 'course_info') {
      const admissions = await Admission.find().select('course totalFees').lean();
      const coursesMap = {};

      admissions.forEach((a) => {
        if (!a.course) return;
        if (!coursesMap[a.course]) {
          coursesMap[a.course] = { count: 0, totalFees: 0 };
        }
        coursesMap[a.course].count++;
        coursesMap[a.course].totalFees += (a.totalFees || 0);
      });

      const courseList = Object.entries(coursesMap).map(([name, val]) => ({
        courseName: name,
        enrolledStudents: val.count,
        averageFee: `₹${Math.round(val.totalFees / (val.count || 1)).toLocaleString('en-IN')}`
      }));

      dbData = {
        type: 'course_catalog',
        totalAvailableCourses: courseList.length,
        courses: courseList
      };
      contextHint = 'List of courses offered with enrollment statistics and fee details';
    }

    // ─── 7. Follow-up List (Today or All Overdue/Pending) ───────────────────
    else if (intent === 'followup') {
      const { start, end } = getTodayRange();
      const isPendingSearch = /\b(pending|panding|overdue|baki|purane|all|sab|past)\b/.test(query.toLowerCase());

      let filter = { followUpDate: { $gte: start, $lte: end } };
      if (isPendingSearch) {
        filter = {
          followUpDate: { $lte: end },
          status: { $nin: ['CONVERTED', 'NOT_INTERESTED', 'ADMISSION_PROCESS'] }
        };
      }

      const followups = await Enquiry.find(filter)
        .populate('assignedTo', 'name')
        .select('name mobile course status followUpDate assignedTo')
        .sort({ followUpDate: 1 })
        .limit(20)
        .lean();

      dbData = {
        type: isPendingSearch ? 'pending_followups' : 'today_followups',
        date: new Date().toLocaleDateString('en-IN'),
        count: followups.length,
        followups: followups.map((f) => ({
          name: f.name,
          mobile: f.mobile,
          course: f.course || 'N/A',
          status: f.status,
          followUpDate: f.followUpDate ? new Date(f.followUpDate).toLocaleDateString('en-IN') : 'Today',
          followUpTime: f.followUpDate ? new Date(f.followUpDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Today',
          assignedTo: f.assignedTo ? f.assignedTo.name : 'Counselor'
        }))
      };
      contextHint = isPendingSearch
        ? `Pending & overdue follow-up tasks count: ${followups.length}`
        : `Today's follow-up task list for ${new Date().toLocaleDateString('en-IN')}`;
    }

    // ─── 7B. Interactive In-Chat Add Enquiry Wizard ──────────────────────
    else if (intent === 'add_enquiry_wizard') {
      const mobileMatch = query.match(/\b[6-9]\d{9}\b/);
      const mobile = mobileMatch ? mobileMatch[0] : null;

      let name = null;
      const queryWithoutFillers = query.replace(/\b(student|mobile|phone|course|fees|down|payment|haan|confirm|save|yes|add|karo|kardo|krdo|kr|enquiry|enqry|admission|setup)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const nameMatch = query.match(/(?:name|naam)\s+(?:is|hai|=|:)?\s*([a-zA-Z\s]{2,30})/i)
        || queryWithoutFillers.match(/^([a-zA-Z\s]{2,30})\s+[6-9]\d{9}/)
        || queryWithoutFillers.match(/^([a-zA-Z\s]{2,30})/);
      if (nameMatch) name = nameMatch[1].trim();

      let course = null;
      const courseMatch = query.match(/(?:course|subject)\s+(?:is|hai|=|:)?\s*([a-zA-Z0-9\s]{2,30})/i)
        || query.match(/\b(tally|dca|bca|mca|python|java|web dev|excel|c\+\+|graphic|tally prime)\b/i);
      if (courseMatch) course = courseMatch[1] ? courseMatch[1].replace(/\b(haan|confirm|yes|save)\b/gi, '').trim() : courseMatch[0];

      const isConfirm = /\b(confirm|haan|yes|save|ok|sahi|kar do|kardo|kr do)\b/i.test(query);

      if (name && mobile && isConfirm) {
        try {
          const newEnquiry = await Enquiry.create({
            name,
            mobile,
            course: course || 'General',
            assignedTo: req.user ? req.user.id : null,
            status: 'INTERESTED'
          });
          const successMsg = language === 'hindi'
            ? `✅ **Nayi Enquiry Successfully Save Ho Gayi!** 🎉\n\n- **Name:** ${newEnquiry.name}\n- **Mobile:** ${newEnquiry.mobile}\n- **Course:** ${newEnquiry.course}\n- **Status:** INTERESTED\n\nAap CRM Enquiries list mein ise dekh sakte hain!`
            : `✅ **New Enquiry Saved Successfully!** 🎉\n\n- **Name:** ${newEnquiry.name}\n- **Mobile:** ${newEnquiry.mobile}\n- **Course:** ${newEnquiry.course}\n\nYou can view it in the Enquiries list!`;
          return successResponse(res, { message: successMsg, intent, language, action: null }, 'Enquiry created');
        } catch (e) {
          console.error('Enquiry creation error:', e);
        }
      }

      if (name && mobile) {
        const confirmMsg = language === 'hindi'
          ? `📝 **Enquiry Details Confirmation**\n\n- **Student Name:** ${name}\n- **Mobile Number:** ${mobile}\n- **Course:** ${course || 'General'}\n\nKya main ye Enquiry Database mein save kar doon? Reply **Haan** ya **Confirm** to save!`
          : `📝 **Confirm Enquiry Details**\n\n- **Student Name:** ${name}\n- **Mobile Number:** ${mobile}\n- **Course:** ${course || 'General'}\n\nWould you like me to save this Enquiry? Reply **Confirm** or **Yes** to save!`;
        return successResponse(res, { message: confirmMsg, intent, language, action: null }, 'Enquiry details confirmation');
      }

      const promptMsg = language === 'hindi'
        ? `➕ **Nayi Enquiry Add Karein**\n\nKripya student ki details batayein:\n\n1️⃣ **Student Full Name**\n2️⃣ **10-Digit Mobile Number**\n3️⃣ **Course Interested**\n\nExample type karein: *"Aarav Sharma 9876543210 Tally Prime"*`
        : `➕ **Add New Enquiry**\n\nPlease provide the student details:\n\n1️⃣ **Student Full Name**\n2️⃣ **10-Digit Mobile Number**\n3️⃣ **Course Interested**\n\nExample: *"Aarav Sharma 9876543210 Tally Prime"*`;
      return successResponse(res, { message: promptMsg, intent, language, action: null }, 'Enquiry details prompt');
    }

    // ─── 7C. Interactive In-Chat Direct Admission Setup Wizard ───────────
    else if (intent === 'add_admission_wizard') {
      const mobileMatch = query.match(/\b[6-9]\d{9}\b/);
      const mobile = mobileMatch ? mobileMatch[0] : null;

      let name = null;
      const queryWithoutFillers = query.replace(/\b(student|mobile|phone|course|fees|down|payment|haan|confirm|save|yes|add|enquiry|enqry|admission|setup)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const nameMatch = query.match(/(?:name|naam)\s+(?:is|hai|=|:)?\s*([a-zA-Z\s]{2,30})/i)
        || queryWithoutFillers.match(/^([a-zA-Z\s]{2,30})\s+[6-9]\d{9}/)
        || queryWithoutFillers.match(/^([a-zA-Z\s]{2,30})/);
      if (nameMatch) name = nameMatch[1].trim();

      let course = null;
      const courseMatch = query.match(/\b(tally|dca|bca|mca|python|java|web dev|excel|c\+\+|graphic|tally prime)\b/i);
      if (courseMatch) course = courseMatch[0];

      const feeMatches = query.match(/\b\d{3,6}\b/g) || [];
      const totalFees = feeMatches.length >= 1 ? parseInt(feeMatches[0]) : null;
      const downPayment = feeMatches.length >= 2 ? parseInt(feeMatches[1]) : 0;

      const isConfirm = /\b(confirm|haan|yes|save|ok|sahi|kar do|kardo|kr do)\b/i.test(query);

      if (name && mobile && totalFees && isConfirm) {
        try {
          const admissionData = {
            name,
            mobile,
            course: course || 'General',
            totalFees,
            registrationAmount: downPayment,
            paymentMode: 'CASH',
            admissionDate: new Date().toISOString().split('T')[0]
          };
          const newAdm = await admissionService.createAdmission(admissionData, req.user || { name: 'Admin', id: 'admin' });
          const successMsg = language === 'hindi'
            ? `🎓 **Direct Admission Successfully Completed!** 🎉\n\n- **Student Name:** ${name}\n- **Mobile:** ${mobile}\n- **Course:** ${course || 'General'}\n- **Total Fees:** ₹${totalFees.toLocaleString('en-IN')}\n- **Down Payment:** ₹${downPayment.toLocaleString('en-IN')}\n\nAap Admissions tab par new record dekh sakte hain!`
            : `🎓 **Direct Admission Created Successfully!** 🎉\n\n- **Student Name:** ${name}\n- **Mobile:** ${mobile}\n- **Course:** ${course || 'General'}\n- **Total Fees:** ₹${totalFees.toLocaleString('en-IN')}\n- **Down Payment:** ₹${downPayment.toLocaleString('en-IN')}\n\nYou can view the new admission in the Admissions table!`;
          return successResponse(res, { message: successMsg, intent, language, action: null }, 'Admission created');
        } catch (e) {
          console.error('Admission creation error:', e);
        }
      }

      if (name && mobile && totalFees) {
        const confirmMsg = language === 'hindi'
          ? `📝 **Confirm Direct Admission Details**\n\n- **Student Name:** ${name}\n- **Mobile Number:** ${mobile}\n- **Course:** ${course || 'General'}\n- **Total Fees:** ₹${totalFees.toLocaleString('en-IN')}\n- **Down Payment:** ₹${downPayment.toLocaleString('en-IN')}\n\nKya main ye Direct Admission save kar doon? Reply **Haan** ya **Confirm** to save!`
          : `📝 **Confirm Direct Admission Details**\n\n- **Student Name:** ${name}\n- **Mobile Number:** ${mobile}\n- **Course:** ${course || 'General'}\n- **Total Fees:** ₹${totalFees.toLocaleString('en-IN')}\n- **Down Payment:** ₹${downPayment.toLocaleString('en-IN')}\n\nWould you like me to save this Admission? Reply **Confirm** or **Yes** to save!`;
        return successResponse(res, { message: confirmMsg, intent, language, action: null }, 'Admission details confirmation');
      }

      const promptMsg = language === 'hindi'
        ? `🎓 **Direct Admission Setup**\n\nPehle batayein — kya student ki pehle se Enquiry hai?\n- Agar haan, toh student ka **Name** ya **Mobile Number** batayein.\n- Agar Direct Walk-In hai, toh details batayein:\n\n1️⃣ **Student Name**\n2️⃣ **10-Digit Mobile**\n3️⃣ **Course**\n4️⃣ **Total Fees** & **Down Payment**\n\nExample type karein: *"Aarav Sharma 9876543210 Tally Prime Total Fees 15000 Down Payment 5000"*`
        : `🎓 **Direct Admission Setup**\n\nPlease specify if this is an existing Enquiry or a Direct Walk-In:\n\n1️⃣ **Student Name**\n2️⃣ **10-Digit Mobile**\n3️⃣ **Course**\n4️⃣ **Total Fees** & **Down Payment**\n\nExample: *"Aarav Sharma 9876543210 Tally Prime Total Fees 15000 Down Payment 5000"*`;
      return successResponse(res, { message: promptMsg, intent, language, action: null }, 'Admission details prompt');
    }

    // ─── 8. Pending & Upcoming Fees (Intelligent Fee Assistant) ─────────────
    else if (intent === 'pending_fee') {
      const qLower = query.toLowerCase();
      const isTodaySearch = /\b(aaj|today|aj)\b/.test(qLower);
      const isUpcomingSearch = /\b(upcoming|aane wala|aane waala|next|date wise|datewise|aane wali|schedule)\b/.test(qLower);
      const studentNameSearch = extractSearchTerm(query, 'pending_fee');

      let admissions = [];
      if (studentNameSearch) {
        admissions = await Admission.find({
          $or: [
            { name: { $regex: studentNameSearch, $options: 'i' } },
            { mobile: { $regex: studentNameSearch, $options: 'i' } }
          ]
        }).select('name mobile course totalFees registrationAmount installments status').lean();
      } else {
        admissions = await Admission.find({ status: { $ne: 'CANCELLED' } })
          .select('name mobile course totalFees registrationAmount installments status')
          .limit(50)
          .lean();
      }

      const todayRange = getTodayRange();
      let totalPendingSum = 0;
      const feeReportList = [];

      admissions.forEach((a) => {
        const pendingInst = (a.installments || []).filter((i) => i.status === 'PENDING');
        if (pendingInst.length === 0) return;

        let filteredInst = pendingInst;

        // If today search, filter installments due today
        if (isTodaySearch) {
          filteredInst = pendingInst.filter((i) => {
            if (!i.dueDate) return false;
            const d = new Date(i.dueDate);
            return d >= todayRange.start && d <= todayRange.end;
          });
        }

        const pendingAmt = filteredInst.reduce((sum, i) => sum + (i.amount || 0), 0);
        if (pendingAmt <= 0 && (isTodaySearch || studentNameSearch)) return;

        const totalStudentPending = pendingInst.reduce((sum, i) => sum + (i.amount || 0), 0);
        totalPendingSum += totalStudentPending;

        feeReportList.push({
          name: a.name,
          mobile: a.mobile,
          course: a.course || 'N/A',
          totalFees: a.totalFees || 0,
          pendingAmount: totalStudentPending,
          queryFilteredPending: pendingAmt,
          installments: filteredInst.map((i) => ({
            amount: i.amount,
            dueDateRaw: i.dueDate,
            dueDate: i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : 'Upcoming'
          }))
        });
      });

      // Sort date-wise if upcoming search
      if (isUpcomingSearch) {
        feeReportList.sort((a, b) => {
          const dateA = a.installments[0]?.dueDateRaw ? new Date(a.installments[0].dueDateRaw) : new Date(8640000000000000);
          const dateB = b.installments[0]?.dueDateRaw ? new Date(b.installments[0].dueDateRaw) : new Date(8640000000000000);
          return dateA - dateB;
        });
      }

      dbData = {
        type: isTodaySearch ? 'today_due_fees' : (isUpcomingSearch ? 'upcoming_fees_datewise' : 'pending_fees'),
        searchMode: isTodaySearch ? 'today' : (isUpcomingSearch ? 'upcoming' : (studentNameSearch ? 'student' : 'all')),
        searchedStudent: studentNameSearch || null,
        count: feeReportList.length,
        totalPendingAmount: `₹${totalPendingSum.toLocaleString('en-IN')}`,
        students: feeReportList
      };

      if (studentNameSearch) {
        contextHint = `Fee query for student "${studentNameSearch}": ${feeReportList.length ? `Found student ${feeReportList[0].name}, total pending amount ₹${feeReportList[0].pendingAmount}` : `No pending fees found for "${studentNameSearch}"`}`;
      } else if (isTodaySearch) {
        contextHint = `Students whose fee installments are due today (${new Date().toLocaleDateString('en-IN')}): ${feeReportList.length} students`;
      } else if (isUpcomingSearch) {
        contextHint = `Upcoming date-wise fee installment schedule for students in CRM sorted by due date`;
      } else {
        contextHint = `Overall pending fee list: ${feeReportList.length} students with pending installments`;
      }
    }

    // ─── Direct Status Update via Chat (Guided In-Chat Wizard) ─────────
    else if (intent === 'update_status') {
      const qLower = query.toLowerCase();

      // Extract target status
      let targetStatus = null;
      if (qLower.includes('converted')) targetStatus = 'CONVERTED';
      else if (qLower.includes('not interested') || qLower.includes('not_interested')) targetStatus = 'NOT_INTERESTED';
      else if (qLower.includes('no response') || qLower.includes('no_response')) targetStatus = 'NO_RESPONSE';
      else if (qLower.includes('contacted')) targetStatus = 'CONTACTED';
      else if (qLower.includes('admission')) targetStatus = 'ADMISSION_PROCESS';
      else if (qLower.includes('interested')) targetStatus = 'INTERESTED';

      // Extract student name or mobile
      const mobileMatch = query.match(/\b[6-9]\d{9}\b/);
      let studentTerm = mobileMatch ? mobileMatch[0] : null;

      if (!studentTerm) {
        studentTerm = query
          .replace(/\b(status|update|change|set|mark|kar|do|kardo|krdo|kr|banao|nayi|next|followup|follow-up|follow|up|date|kal|tomorrow|august|september|october|november|december|january|february|march|april|may|june|july|aug|sep|oct|nov|dec|converted|interested|not|no|response|contacted|admission|process|haan|confirm|yes|save)\b/gi, ' ')
          .replace(/[?।,!]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (studentTerm.length < 2) studentTerm = null;
      }

      // Extract follow up date
      let targetDate = null;
      if (qLower.includes('tomorrow') || qLower.includes('kal')) {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
      } else {
        const dateMatch = query.match(/\b(\d{1,2})\s*(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\b/i);
        if (dateMatch) {
          targetDate = new Date();
          const day = parseInt(dateMatch[1]);
          targetDate.setDate(day);
        }
      }

      // Check confirmation
      const isConfirm = /\b(confirm|haan|yes|save|ok|sahi|kar do|kardo|kr do)\b/i.test(query);

      // Search DB for Enquiry if studentTerm provided
      let enquiry = null;
      if (studentTerm) {
        enquiry = await Enquiry.findOne({
          $or: [
            { name: { $regex: studentTerm, $options: 'i' } },
            { mobile: { $regex: studentTerm, $options: 'i' } }
          ]
        });
      }

      // Case A: Everything present + confirmed -> Execute Update!
      if (enquiry && targetStatus && isConfirm) {
        const oldStatus = enquiry.status;
        enquiry.status = targetStatus;
        if (targetDate) enquiry.followUpDate = targetDate;

        if (!enquiry.statusHistory) enquiry.statusHistory = [];
        enquiry.statusHistory.push({
          status: targetStatus,
          note: `Status updated to ${targetStatus} via Jiya AI Chat`,
          changedBy: req.user ? req.user.id : null,
          changedAt: new Date()
        });

        await enquiry.save();

        const successMsg = language === 'hindi'
          ? `✅ **Status Successfully Updated!** 🎉\n\n- **Student Name:** ${enquiry.name}\n- **Old Status:** ${oldStatus}\n- **New Status:** ${targetStatus}\n${targetDate ? `- **Next Follow-up Date:** ${targetDate.toLocaleDateString('en-IN')}\n` : ''}\nAap CRM Enquiries list mein updated status dekh sakte hain!`
          : `✅ **Status Updated Successfully!** 🎉\n\n- **Student Name:** ${enquiry.name}\n- **Old Status:** ${oldStatus}\n- **New Status:** ${targetStatus}\n${targetDate ? `- **Next Follow-up Date:** ${targetDate.toLocaleDateString('en-IN')}\n` : ''}\nThe changes have been saved to the CRM database!`;

        return successResponse(res, { message: successMsg, intent, language, action: null }, 'Status updated');
      }

      // Case B: Student & target status found -> Show confirmation prompt!
      if (enquiry && targetStatus) {
        const confirmMsg = language === 'hindi'
          ? `📝 **Status Update Confirmation**\n\n- **Student Name:** ${enquiry.name} (${enquiry.mobile})\n- **Current Status:** ${enquiry.status}\n- **New Status:** ${targetStatus}\n${targetDate ? `- **Next Follow-up Date:** ${targetDate.toLocaleDateString('en-IN')}\n` : ''}\nKya main ye status update DB mein save kar doon? Reply **Haan** ya **Confirm** to save!`
          : `📝 **Confirm Status Update**\n\n- **Student Name:** ${enquiry.name} (${enquiry.mobile})\n- **Current Status:** ${enquiry.status}\n- **New Status:** ${targetStatus}\n${targetDate ? `- **Next Follow-up Date:** ${targetDate.toLocaleDateString('en-IN')}\n` : ''}\nWould you like me to update this status? Reply **Confirm** or **Yes** to save!`;

        return successResponse(res, { message: confirmMsg, intent, language, action: null }, 'Status update confirmation');
      }

      // Case C: Student found, but target status missing -> Ask for status & follow-up date!
      if (enquiry) {
        const promptMsg = language === 'hindi'
          ? `🔄 **Update Status for ${enquiry.name}**\n\n- **Current Status:** ${enquiry.status}\n- **Mobile:** ${enquiry.mobile}\n\nKripya **Naya Status** batayein:\n• \`INTERESTED\`\n• \`CONVERTED\`\n• \`NOT_INTERESTED\`\n• \`NO_RESPONSE\`\n• \`CONTACTED\`\n\n*(Saath hi Next Follow-up Date bhi de sakte hain, e.g. "Vikram INTERESTED Kal 4 PM")*`
          : `🔄 **Update Status for ${enquiry.name}**\n\n- **Current Status:** ${enquiry.status}\n\nPlease specify the **New Status**:\n• \`INTERESTED\`\n• \`CONVERTED\`\n• \`NOT_INTERESTED\`\n• \`NO_RESPONSE\`\n• \`CONTACTED\`\n\n*(You can also include a Next Follow-up Date!)*`;

        return successResponse(res, { message: promptMsg, intent, language, action: null }, 'Target status prompt');
      }

      // Case D: Nothing specified -> Prompt for all fields!
      const genericMsg = language === 'hindi'
        ? `🔄 **Status & Follow-up Update Wizard**\n\nKripya status update karne ke liye details batayein:\n\n1️⃣ **Student Name ya Mobile**\n2️⃣ **Naya Status** (\`INTERESTED\`, \`CONVERTED\`, \`NOT_INTERESTED\`, etc.)\n3️⃣ **Next Follow-up Date** (optional)\n\nExample type karein: *"Vikram status INTERESTED follow up kal 4 PM"*`
        : `🔄 **Status & Follow-up Update Wizard**\n\nPlease provide the details to update status:\n\n1️⃣ **Student Name or Mobile**\n2️⃣ **New Status** (\`INTERESTED\`, \`CONVERTED\`, \`NOT_INTERESTED\`, etc.)\n3️⃣ **Next Follow-up Date** (optional)\n\nExample: *"Vikram status INTERESTED follow up tomorrow 4 PM"*`;

      return successResponse(res, { message: genericMsg, intent, language, action: null }, 'Status update prompt');
    }

    // ─── Direct Follow-up Reschedule via Chat ──────────────────────────────
    else if (intent === 'reschedule_followup') {
      const qLower = query.toLowerCase();
      let targetDate = new Date();
      if (qLower.includes('tomorrow') || qLower.includes('kal')) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else {
        const dateMatch = query.match(/\b(\d{1,2})\s*(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\b/i);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          targetDate.setDate(day);
        }
      }

      let studentName = extractSearchTerm(query, 'record_search') || '';
      studentName = studentName
        .replace(/\b(followup|follow up|follow-up|reschedule|shift|change|set|postpone|tomorrow|kal|august|september|october|november|december|january|february|march|april|june|july|aug|sep|oct|nov|dec|kar|do|kardo|kr|update)\b/gi, '')
        .trim();

      if (studentName && studentName.length >= 2) {
        const enquiry = await Enquiry.findOne({ name: { $regex: studentName, $options: 'i' } });
        if (enquiry) {
          enquiry.followUpDate = targetDate;
          await enquiry.save();
          dbData = { type: 'followup_rescheduled', name: enquiry.name, newDate: targetDate.toLocaleDateString('en-IN') };
          contextHint = `Successfully rescheduled follow-up date for "${enquiry.name}" to ${targetDate.toLocaleDateString('en-IN')} in CRM database.`;
        } else {
          dbData = { type: 'reschedule_failed', searchedName: studentName };
          contextHint = `Could not find any enquiry matching "${studentName}" to reschedule follow-up.`;
        }
      }
    }

    // ─── 8B. Interested Leads ──────────────────────────────────────────────
    else if (intent === 'interested_leads') {
      const leads = await Enquiry.find({ status: { $in: ['INTERESTED', 'ADMISSION_PROCESS'] } })
        .sort({ updatedAt: -1 })
        .limit(12)
        .lean();

      dbData = {
        type: 'interested_leads',
        count: leads.length,
        leads: leads.map(l => ({
          name: l.name,
          mobile: l.mobile,
          course: l.course || 'N/A',
          status: l.status,
          followUpDate: l.followUpDate ? new Date(l.followUpDate).toLocaleDateString('en-IN') : 'N/A'
        }))
      };
      contextHint = `List of ${leads.length} high-potential interested enquiries in CRM`;
    }

    // ─── 8C. New Enquiries ──────────────────────────────────────────────────
    else if (intent === 'new_enquiries') {
      const enquiries = await Enquiry.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();

      dbData = {
        type: 'new_enquiries',
        count: enquiries.length,
        enquiries: enquiries.map(e => ({
          name: e.name,
          mobile: e.mobile,
          course: e.course || 'N/A',
          status: e.status || 'NEW',
          date: new Date(e.createdAt).toLocaleDateString('en-IN')
        }))
      };
      contextHint = `List of ${enquiries.length} recent new enquiries created in CRM`;
    }

    // ─── 9. Mobile Search ─────────────────────────────────────────────────
    else if (intent === 'mobile_search') {
      const mobile = extractSearchTerm(query, 'mobile_search');
      const [enquiry, admission] = await Promise.all([
        Enquiry.findOne({ mobile }).populate('assignedTo', 'name').lean(),
        Admission.findOne({ mobile }).lean()
      ]);

      dbData = {
        type: 'mobile_search',
        mobile,
        enquiry: enquiry ? {
          name: enquiry.name,
          mobile: enquiry.mobile,
          course: enquiry.course,
          status: enquiry.status,
          followUpDate: enquiry.followUpDate ? new Date(enquiry.followUpDate).toLocaleDateString('en-IN') : 'N/A',
          createdOn: enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString('en-IN') : 'N/A',
          assignedTo: enquiry.assignedTo ? enquiry.assignedTo.name : 'Unassigned',
          timeline: (enquiry.statusHistory || []).map(h => ({
            status: h.status,
            note: h.note || '',
            date: h.changedAt ? new Date(h.changedAt).toLocaleDateString('en-IN') : 'N/A'
          }))
        } : null,
        admission: admission ? {
          name: admission.name,
          mobile: admission.mobile,
          course: admission.course,
          totalFees: admission.totalFees,
          pendingAmount: (admission.installments || [])
            .filter((i) => i.status === 'PENDING')
            .reduce((sum, i) => sum + i.amount, 0),
          status: admission.status,
          admissionDate: admission.createdAt ? new Date(admission.createdAt).toLocaleDateString('en-IN') : 'N/A'
        } : null
      };
      contextHint = `Single student enquiry record. Present ONLY essential fields (Name, Mobile, Course, Status, Next Follow-up) and a clean chronological Timeline of status changes. Omit unnecessary extra details.`;
    }

    // ─── 10. Email Search ─────────────────────────────────────────────────
    else if (intent === 'email_search') {
      const email = extractSearchTerm(query, 'email_search');
      const [enquiry, admission] = await Promise.all([
        Enquiry.findOne({ email: email.toLowerCase() }).populate('assignedTo', 'name').lean(),
        Admission.findOne({ email: email.toLowerCase() }).lean()
      ]);

      dbData = {
        type: 'email_search',
        email,
        enquiry: enquiry ? {
          name: enquiry.name,
          mobile: enquiry.mobile,
          course: enquiry.course,
          status: enquiry.status,
          followUpDate: enquiry.followUpDate ? new Date(enquiry.followUpDate).toLocaleDateString('en-IN') : 'N/A',
          createdOn: enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString('en-IN') : 'N/A',
          timeline: (enquiry.statusHistory || []).map(h => ({
            status: h.status,
            note: h.note || '',
            date: h.changedAt ? new Date(h.changedAt).toLocaleDateString('en-IN') : 'N/A'
          }))
        } : null,
        admission: admission ? {
          name: admission.name,
          course: admission.course,
          totalFees: admission.totalFees,
          status: admission.status
        } : null
      };
      contextHint = `Student record found for email ${email}. Show essential fields and Timeline only.`;
    }

    // ─── 11. Record / Multi-Field Search (Name, Course, Mobile, Email) ───
    else if (intent === 'record_search') {
      const searchTerm = extractSearchTerm(query, 'record_search');
      const searchRegex = { $regex: searchTerm, $options: 'i' };
      const searchQuery = {
        $or: [
          { name: searchRegex },
          { course: searchRegex },
          { mobile: searchRegex },
          { email: searchRegex }
        ]
      };

      const [enquiries, admissions] = await Promise.all([
        Enquiry.find(searchQuery)
          .populate('assignedTo', 'name')
          .select('name mobile email course status followUpDate assignedTo statusHistory createdAt')
          .limit(10)
          .lean(),
        Admission.find(searchQuery)
          .select('name mobile course totalFees installments status createdAt')
          .limit(10)
          .lean()
      ]);

      const suggestions = (!enquiries.length && !admissions.length)
        ? await findNameSuggestions(searchTerm)
        : [];

      dbData = {
        type: 'name_search',
        searchTerm,
        suggestions,
        enquiries: enquiries.map((e) => ({
          name: e.name,
          mobile: e.mobile,
          course: e.course,
          status: e.status,
          followUpDate: e.followUpDate ? new Date(e.followUpDate).toLocaleDateString('en-IN') : 'N/A',
          createdOn: e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN') : 'N/A',
          timeline: (e.statusHistory || []).map(h => ({
            status: h.status,
            note: h.note || '',
            date: h.changedAt ? new Date(h.changedAt).toLocaleDateString('en-IN') : 'N/A'
          }))
        })),
        admissions: admissions.map((a) => ({
          name: a.name,
          mobile: a.mobile,
          course: a.course,
          totalFees: a.totalFees,
          pendingAmount: (a.installments || [])
            .filter((i) => i.status === 'PENDING')
            .reduce((sum, i) => sum + i.amount, 0),
          status: a.status
        }))
      };
      contextHint = `Search results for "${searchTerm}". Present essential fields (Name, Mobile, Course, Status, Next Follow-up) and chronological Timeline. Avoid redundant details.`;
    }

    // ─── 12. General AI Assistance & Custom Multi-Condition Queries ────────
    else {
      const [recentAdmissions, recentEnquiries, totalAdmissions, totalEnquiries, userNotes] = await Promise.all([
        Admission.find({ status: 'ACTIVE' })
          .select('name mobile course totalFees installments status createdAt')
          .sort({ createdAt: -1 })
          .limit(15)
          .lean(),
        Enquiry.find()
          .populate('assignedTo', 'name')
          .select('name mobile email course status followUpDate assignedTo createdAt')
          .sort({ createdAt: -1 })
          .limit(15)
          .lean(),
        Admission.countDocuments({ status: 'ACTIVE' }),
        Enquiry.countDocuments(),
        Note.find(req.user ? { userId: req.user.id } : {}).select('title content').sort({ createdAt: -1 }).limit(10).lean()
      ]);

      dbData = {
        type: 'general_assistance',
        activeStudents: totalAdmissions,
        totalLeads: totalEnquiries,
        userCustomInstructionsAndMemories: (userNotes || []).map(n => ({ title: n.title, memory: n.content })),
        institute: 'SSSAM Academy CRM',
        sampleAdmissions: recentAdmissions.map((a) => ({
          name: a.name,
          mobile: a.mobile,
          course: a.course,
          totalFees: a.totalFees,
          pendingFee: (a.installments || [])
            .filter((i) => i.status === 'PENDING')
            .reduce((sum, i) => sum + i.amount, 0),
          status: a.status
        })),
        sampleEnquiries: recentEnquiries.map((e) => ({
          name: e.name,
          mobile: e.mobile,
          course: e.course,
          status: e.status,
          assignedTo: e.assignedTo ? e.assignedTo.name : 'Unassigned'
        }))
      };
      contextHint = `General assistance, custom filtering, and reasoning for query: "${query}"`;
    }

    // ─── Generate AI Response via Groq / Gemini ───────────────────────────
    const aiResponse = await formatCRMResponse(
      `${contextHint}\nUser Query: "${query}"`,
      dbData,
      {
        language,
        inputMode,
        responseStyle
      }
    );

    return successResponse(res, {
      message: aiResponse,
      intent,
      language,
      action: action || null,
      rawData: dbData
    }, 'Chat response generated successfully');
  });

  /**
   * GET /api/notes
   * Direct notes fetch for WhatsApp popup (no AI needed)
   */
  getNotes = catchAsync(async (req, res) => {
    const filter = req.user ? { userId: req.user.id } : {};
    const notes = await Note.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return successResponse(res, { notes }, 'Notes fetched');
  });
}

module.exports = new ChatController();
