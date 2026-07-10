const { Enquiry, Admission, Payment, Note } = require('../models');
const { formatCRMResponse, parseJSONResponse } = require('../services/geminiService');
const catchAsync = require('../utils/catchAsync');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Detect query intent from user message
function detectIntent(query) {
  const q = query.toLowerCase();

  // Call intent
  if (q.includes('call karo') || q.includes('call kro') || q.includes('call kr') ||
      q.includes('call karna') || q.includes('phone karo') || q.includes('phone kro') ||
      q.includes('call kijiye') || q.includes('ko call') || q.includes('ring karo') ||
      q.includes('फोन करो') || q.includes('कॉल करो')) {
    return 'call';
  }

  // WhatsApp intent
  if (q.includes('whatsapp') || q.includes('whatsapp karo') || q.includes('whatsapp kro') ||
      q.includes('whatsapp bhejo') || q.includes('wp karo') || q.includes('wa karo') ||
      q.includes('message bhejo') || q.includes('व्हाट्सएप')) {
    return 'whatsapp';
  }

  // Save note intent
  if (q.includes('save note') || q.includes('save message') || q.includes('save data') ||
      q.includes('save information') || q.includes('save details') || q.includes('kuch save') ||
      q.includes('isey save') || q.includes('isko save') || q.includes('note likho') ||
      q.includes('सेव करो') || q.includes('लिखो') || q.includes('याद रखना') ||
      q.includes('save kr do') || q.includes('save kro') || q.includes('save karo')) {
    return 'save_note';
  }

  // Get notes intent
  if (q.includes('my notes') || q.includes('saved notes') || q.includes('saved note') ||
      q.includes('saved message') || q.includes('saved messages') ||
      q.includes('mere saved') || q.includes('mere notes') || q.includes('saved list') ||
      q.includes('क्या सेव किया') || q.includes('नोट्स दिखाओ') || q.includes('नोट्स बताओ')) {
    return 'get_notes';
  }

  // Guide intent
  if (q.includes('help') || q.includes('guide') || q.includes('kaise use') ||
      q.includes('use kaise') || q.includes('tutorial') || q.includes('kaise chalaye') ||
      q.includes('मदद') || q.includes('कैसे इस्तेमाल') || q.includes('kaise chalega')) {
    return 'guide';
  }

  // Follow-up intent
  if (q.includes('follow up') || q.includes('followup') || q.includes('follow-up') ||
      q.includes('फॉलो') || q.includes('aaj') || q.includes('आज') || q.includes('today')) {
    return 'followup';
  }

  // Pending fee intent
  if (q.includes('pending fee') || q.includes('pending fees') || q.includes('fee') ||
      q.includes('fees') || q.includes('baki') || q.includes('बाकी') ||
      q.includes('installment') || q.includes('pending') || q.includes('due')) {
    return 'pending_fee';
  }

  // Mobile number detection (10 digit number)
  const mobileMatch = q.match(/\b[6-9]\d{9}\b/);
  if (mobileMatch) {
    return 'mobile_search';
  }

  // Email detection
  const emailMatch = q.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    return 'email_search';
  }

  // Default: name search
  return 'name_search';
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
    // Extract name — remove action words
    const cleaned = q
      .replace(/\b(call|whatsapp|whatsapp|phone|ring|ko|karo|kro|kr|karna|kijiye|bhejo|wp|wa|message|फोन|करो|कॉल|व्हाट्सएप)\b/gi, '')
      .replace(/[?।,]/g, '')
      .trim();
    return cleaned || null;
  }

  if (intent === 'save_note') {
    // Extract what to save
    const cleaned = q
      .replace(/^(is message ko\s+)?save\s+(note|message|data)?(\s*karo|\s*kro|\s*kr\s*do)?(\s*:\s*|\s+)/gi, '')
      .replace(/^(सेव करो|लिखो|याद रखना)(\s*:\s*|\s+)/g, '')
      .replace(/\s+(ko\s+)?save\s*(karo|kro|kr\s*do|kr)?$/gi, '')
      .replace(/\s*(सेव करो|लिखो|याद रखना)$/g, '')
      .trim();
    return cleaned || q;
  }

  if (intent === 'name_search') {
    // Remove common Hindi/English filler words
    const cleaned = q
      .replace(/\b(ka|ki|ke|ko|data|dikhao|batao|detail|show|find|search|tell|me|mujhe|find)\b/gi, '')
      .replace(/[?।,]/g, '')
      .trim();
    return cleaned || q;
  }

  return null;
}


// Detect language preference from query
function detectLanguage(query) {
  const q = query.toLowerCase();
  const hindiChars = /[\u0900-\u097F]/;
  const hindiWords = ['batao', 'dikhao', 'hai', 'hain', 'ka', 'ki', 'ke', 'aaj', 'sab', 'kiska', 'uska', 'baki', 'karo', 'karna', 'mujhe', 'mera'];

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
      ? `Mujhe "${safeSearchTerm}" ka exact match nahi mila. Thoda aur specific bolo, jaise poora naam, mobile number, ya email.`
      : `I couldn't find an exact match for "${safeSearchTerm}". Please be a bit more specific with the full name, mobile number, or email.`;
  }

  const suggestionText = suggestions.map((item, index) => `${index + 1}. ${item}`).join('\n');
  return language === 'hindi'
    ? `Mujhe "${safeSearchTerm}" ka exact match nahi mila. Kya aap inmein se kisi ko dhoondh rahe the?\n${suggestionText}`
    : `I couldn't find an exact match for "${safeSearchTerm}". Did you mean one of these?\n${suggestionText}`;
}

async function findNameSuggestions(searchTerm) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const tokens = [...new Set(searchTerm.toLowerCase().split(/\s+/).filter((token) => token.length >= 2))];
  if (!tokens.length) {
    return [];
  }

  const query = {
    $or: tokens.map((token) => ({ name: { $regex: token, $options: 'i' } }))
  };

  const [enquiries, admissions] = await Promise.all([
    Enquiry.find(query).select('name mobile course').limit(5).lean(),
    Admission.find(query).select('name mobile course').limit(5).lean()
  ]);

  const merged = [...enquiries, ...admissions];
  const seen = new Set();
  return merged
    .filter((item) => {
      const key = `${item.name}|${item.mobile || ''}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((item) => `${item.name}${item.course ? ` (${item.course})` : ''}${item.mobile ? ` - ${item.mobile}` : ''}`);
}

// Format date range for today
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

class ChatController {

  /**
   * POST /api/chat
   * Main chat endpoint — processes user query and returns AI-formatted response
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

    // ─── Call / WhatsApp intent ──────────────────────────────────────────
    if (intent === 'call' || intent === 'whatsapp') {
      const searchTerm = extractSearchTerm(query, intent);

      // Check if mobile number directly given
      const directMobile = query.match(/\b[6-9]\d{9}\b/);
      let targetMobile = null;
      let targetName = null;
      let prefilledText = null;

      // Use Gemini to check if they specified a note subject to attach to WhatsApp
      if (intent === 'whatsapp') {
        try {
          const sysPrompt = `Analyze the user query. They want to send a WhatsApp message to a student/enquiry.
Check if they are specifying a saved note's title/subject or keyword to pre-fill the WhatsApp text (e.g. 'WhatsApp Priya admission message' -> studentName: 'Priya', noteKeyword: 'admission message').
Return a JSON object with keys: "studentName" (string), "noteKeyword" (string or null).`;
          
          const parsedWP = await parseJSONResponse(sysPrompt, query);
          if (parsedWP && parsedWP.studentName) {
            targetName = parsedWP.studentName;
            
            // Search for student
            const found = await Enquiry.findOne({ name: { $regex: targetName, $options: 'i' } }).select('name mobile').lean()
              || await Admission.findOne({ name: { $regex: targetName, $options: 'i' } }).select('name mobile').lean();
              
            if (found) {
              targetMobile = found.mobile;
              targetName = found.name;
            }
            
            // If they specified a note keyword, search for it
            if (parsedWP.noteKeyword) {
              const matchedNote = await Note.findOne({
                userId: req.user.id,
                $text: { $search: parsedWP.noteKeyword }
              }).select('content').lean()
              || await Note.findOne({
                userId: req.user.id,
                title: { $regex: parsedWP.noteKeyword, $options: 'i' }
              }).select('content').lean();
              
              if (matchedNote) {
                prefilledText = matchedNote.content;
              }
            }
          }
        } catch (e) {
          console.error('Gemini WhatsApp parsing failed:', e);
        }
      }

      // Fallback to legacy extraction if Gemini parsing was skipped or failed to find contact
      if (!targetMobile) {
        if (directMobile) {
          targetMobile = directMobile[0];
          const found = await Enquiry.findOne({ mobile: targetMobile }).select('name').lean()
            || await Admission.findOne({ mobile: targetMobile }).select('name').lean();
          targetName = found ? found.name : `(${targetMobile})`;
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
        const suggestions = await findNameSuggestions(searchTerm || query);
        const notFound = buildClarificationMessage(language, searchTerm || query, suggestions);
        return successResponse(res, {
          message: notFound,
          intent,
          language,
          action: null
        }, 'Chat response generated');
      }

      const actionType = intent; // 'call' or 'whatsapp'
      
      let aiMsg = '';
      if (actionType === 'whatsapp' && prefilledText) {
        aiMsg = language === 'hindi'
          ? `💬 ${targetName} ko saved template ke sath WhatsApp karne ke liye ready hai!\n\n**Template Content:**\n"${prefilledText}"\n\nNeeche button dabaiye WhatsApp send karne ke liye! 👇`
          : `💬 Ready to WhatsApp ${targetName} with the saved template!\n\n**Template Content:**\n"${prefilledText}"\n\nTap the button below to send! 👇`;
      } else {
        aiMsg = language === 'hindi'
          ? `📞 ${targetName} ka number hai: **${targetMobile}**\nNeeche button dabao ${actionType === 'call' ? 'call' : 'WhatsApp'} karne ke liye! 👇`
          : `📞 ${targetName}'s number: **${targetMobile}**\nTap the button below to ${actionType === 'call' ? 'call' : 'WhatsApp'}! 👇`;
      }

      return successResponse(res, {
        message: aiMsg,
        intent,
        language,
        action: {
          type: actionType,       // 'call' or 'whatsapp'
          mobile: targetMobile,
          name: targetName,
          text: prefilledText
        }
      }, 'Chat response generated successfully');
    }

    // ─── Save Custom Note intent ──────────────────────────────────────────
    if (intent === 'save_note') {
      let noteContent = extractSearchTerm(query, 'save_note');
      let noteTitle = 'General';

      try {
        // Use Gemini to parse structured note
        const sysPrompt = `You are a parser. Analyze the user query wishing to save a note/message template.
Extract:
1. 'title' (a short subject, label, or keyword like 'Admission confirmed', 'Fee reminder', etc.). If no subject/title is clear, use 'General'.
2. 'content' (the actual complete message text to save).
Return JSON object with keys: "title" and "content".`;
        
        const parsedNote = await parseJSONResponse(sysPrompt, query);
        if (parsedNote && parsedNote.content) {
          noteTitle = parsedNote.title || 'General';
          noteContent = parsedNote.content;
        }
      } catch (e) {
        console.error('Gemini JSON note parsing failed:', e);
      }

      if (!noteContent || noteContent.trim().length < 2) {
        const errResponse = language === 'hindi'
          ? '❌ Kuch valid message ya note likhne ko kaho (example: "save note: kal test hai").'
          : '❌ Please provide a valid message to save (example: "save note: test tomorrow").';
        return successResponse(res, { message: errResponse, intent, language, action: null }, 'Note empty');
      }

      const newNote = await Note.create({
        userId: req.user.id,
        title: noteTitle,
        content: noteContent
      });

      const responseText = language === 'hindi'
        ? `✅ Subject **"${noteTitle}"** ke sath note successfully save ho gaya hai!\n\n**Note Content:**\n"${noteContent}"\n\nIs message ko kisi ko WhatsApp karne ke liye bole: *"WhatsApp [Student Name] ko [Subject]"*`
        : `✅ Note successfully saved with subject **"${noteTitle}"**!\n\n**Note Content:**\n"${noteContent}"\n\nTo send this to someone via WhatsApp, say: *"WhatsApp [Student Name] [Subject]"*`;

      return successResponse(res, {
        message: responseText,
        intent,
        language,
        action: null,
        rawData: newNote
      }, 'Note saved successfully');
    }

    // ─── Get Saved Notes intent ───────────────────────────────────────────
    if (intent === 'get_notes') {
      // Check if user is searching for specific notes by keyword
      const searchKeyword = extractSearchTerm(query, 'get_notes');

      let notes;
      if (searchKeyword && searchKeyword.length > 1) {
        // Try text search first, then regex fallback
        notes = await Note.find({
          userId: req.user.id,
          $or: [
            { $text: { $search: searchKeyword } },
            { title: { $regex: searchKeyword, $options: 'i' } },
            { content: { $regex: searchKeyword, $options: 'i' } }
          ]
        }).sort({ createdAt: -1 }).limit(10).lean();
      } else {
        notes = await Note.find({ userId: req.user.id })
          .sort({ createdAt: -1 })
          .limit(15)
          .lean();
      }

      if (!notes || notes.length === 0) {
        const noNotesMsg = language === 'hindi'
          ? `📝 Koi saved note nahi mila.\n\n**Note save karne ke liye** kaho: *"mujhe note save karna hai"* ya *"save note"*\n\nMain step-by-step help karunga! 👇`
          : `📝 No saved notes found.\n\n**To save a note** say: *"I want to save a note"* or *"save note"*\n\nI'll guide you step by step! 👇`;
        return successResponse(res, { message: noNotesMsg, intent, language, action: null }, 'No notes');
      }

      const headerMsg = language === 'hindi'
        ? `📋 **${notes.length} saved note${notes.length > 1 ? 's' : ''} mile:**\n\nKisi bhi note ke neeche **"WhatsApp Bhejo"** dabao kisi student ko send karne ke liye! 👇`
        : `📋 **Found ${notes.length} saved note${notes.length > 1 ? 's' : ''}:**\n\nTap **"WhatsApp Bhejo"** below any note to send it to a student! 👇`;

      return successResponse(res, {
        message: headerMsg,
        intent,
        language,
        action: {
          type: 'notes_list',
          notes: notes.map(n => ({
            _id: n._id,
            title: n.title || 'General',
            content: n.content,
            date: new Date(n.createdAt).toLocaleDateString('en-IN')
          }))
        }
      }, 'Notes fetched');
    }


    // ─── Chatbot Guide/Help intent ────────────────────────────────────────
    if (intent === 'guide') {
      const helpMsg = language === 'hindi'
        ? `📖 **SSSAM AI Chat Assistant Guide**\n\n` +
          `Aap is Chatbot se voice (बोलकर) ya text (लिखकर) data manage kar sakte hain:\n\n` +
          `🔍 **Student/Enquiry Search:**\n` +
          `• *"Rahul ka details batao"* (Naam se search)\n` +
          `• *"9876543210 ka status kya hai?"* (Mobile se search)\n` +
          `• *"priya@gmail.com ka data dikhao"* (Email se search)\n\n` +
          `📅 **Follow-ups:**\n` +
          `• *"aaj ke follow-ups batao"* (Aaj ki appointments/follow-ups)\n\n` +
          `💰 **Fees & Payments:**\n` +
          `• *"pending fees kiske hai"* (Pending fee structure wale students)\n` +
          `• *"Amit ki kitni fee pending hai?"* (Kisi student ki specific fee detail)\n\n` +
          `📞 **Calling & WhatsApp Actions:**\n` +
          `• *"Priya ko WhatsApp karo"* (Direct chat link button milega)\n` +
          `• *"Rohan ko call karo"* (Direct dialing button milega)\n\n` +
          `📝 **Custom Notes & Messages:**\n` +
          `• *"save note: Aaj shaam ko new admissions check karne hain"* (Database mein save karne ke liye)\n` +
          `• *"mere saved messages dikhao"* (Aapke save kiye saare notes list karne ke liye)\n\n` +
          `🔊 Har message ke niche **Sunao** dabakar audio sun sakte hain!`
        : `📖 **SSSAM AI Chat Assistant Guide**\n\n` +
          `You can interact with this AI assistant using Voice or Typing:\n\n` +
          `🔍 **Search Records:**\n` +
          `• *"Show details of Rahul"* (Search by name)\n` +
          `• *"Search status for 9876543210"* (Search by phone)\n` +
          `• *"Find student priya@gmail.com"* (Search by email)\n\n` +
          `📅 **Follow-ups:**\n` +
          `• *"show today follow-ups"* (List of today's follow-up tasks)\n\n` +
          `💰 **Fees Check:**\n` +
          `• *"who has pending fees"* (List students with due amount)\n` +
          `• *"how much fee is pending for Amit"* (Specific student fee details)\n\n` +
          `📞 **Call/WhatsApp Commands:**\n` +
          `• *"Call Rohan"* or *"WhatsApp Priya"* (Shows direct call/chat action buttons)\n\n` +
          `📝 **Save Personal Notes:**\n` +
          `• *"save note: review registrations tomorrow"* (Saves text directly to DB)\n` +
          `• *"show my saved notes"* (Retrieves all saved notes)\n\n` +
          `🔊 Tap **Sunao** below any response to hear it out loud!`;

      return successResponse(res, {
        message: helpMsg,
        intent,
        language,
        action: null
      }, 'Guide response generated');
    }

    // ─── Follow-up queries ───────────────────────────────────────────────
    if (intent === 'followup') {
      const { start, end } = getTodayRange();

      const followups = await Enquiry.find({
        followUpDate: { $gte: start, $lte: end }
      })
        .populate('assignedTo', 'name')
        .select('name mobile course status followUpDate assignedTo')
        .sort({ followUpDate: 1 })
        .limit(50)
        .lean();

      dbData = {
        type: 'today_followups',
        date: new Date().toLocaleDateString('en-IN'),
        count: followups.length,
        followups: followups.map(f => ({
          name: f.name,
          mobile: f.mobile,
          course: f.course,
          status: f.status,
          followUpTime: f.followUpDate ? new Date(f.followUpDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          assignedTo: f.assignedTo ? f.assignedTo.name : 'Unassigned'
        }))
      };
      contextHint = `Today's follow-up list for ${new Date().toLocaleDateString('en-IN')}`;
    }

    // ─── Pending fee queries ─────────────────────────────────────────────
    else if (intent === 'pending_fee') {
      const searchTerm = extractSearchTerm(query, 'name_search');

      // Check if searching for specific student or all
      const isSpecificSearch = searchTerm && searchTerm.length > 2 &&
        !['pending', 'fee', 'fees', 'sab', 'all', 'sabki', 'kitna'].some(w => searchTerm.includes(w));

      let admissionQuery = {};
      if (isSpecificSearch) {
        admissionQuery = {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { mobile: { $regex: searchTerm, $options: 'i' } }
          ]
        };
      }

      const admissions = await Admission.find(admissionQuery)
        .select('name mobile course totalFees registrationAmount installments status')
        .limit(20)
        .lean();

      const studentsWithPending = admissions
        .map(a => {
          const pendingInstallments = a.installments.filter(i => i.status === 'PENDING');
          const pendingAmount = pendingInstallments.reduce((sum, i) => sum + i.amount, 0);
          const paidAmount = a.installments
            .filter(i => i.status === 'PAID')
            .reduce((sum, i) => sum + i.amount, 0) + a.registrationAmount;

          return {
            name: a.name,
            mobile: a.mobile,
            course: a.course,
            totalFees: a.totalFees,
            paidAmount,
            pendingAmount,
            pendingInstallments: pendingInstallments.map(i => ({
              amount: i.amount,
              dueDate: i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : 'N/A'
            }))
          };
        })
        .filter(s => s.pendingAmount > 0);

      dbData = {
        type: 'pending_fees',
        searchTerm: isSpecificSearch ? searchTerm : 'all',
        count: studentsWithPending.length,
        students: studentsWithPending
      };
      contextHint = isSpecificSearch
        ? `Pending fee details for students matching "${searchTerm}"`
        : 'All students with pending fees';
    }

    // ─── Mobile number search ────────────────────────────────────────────
    else if (intent === 'mobile_search') {
      const mobile = extractSearchTerm(query, 'mobile_search');

      const [enquiry, admission] = await Promise.all([
        Enquiry.findOne({ mobile })
          .populate('assignedTo', 'name')
          .lean(),
        Admission.findOne({ mobile })
          .lean()
      ]);

      dbData = {
        type: 'mobile_search',
        mobile,
        enquiry: enquiry ? {
          name: enquiry.name,
          email: enquiry.email,
          mobile: enquiry.mobile,
          course: enquiry.course,
          status: enquiry.status,
          source: enquiry.source,
          followUpDate: enquiry.followUpDate ? new Date(enquiry.followUpDate).toLocaleDateString('en-IN') : null,
          assignedTo: enquiry.assignedTo ? enquiry.assignedTo.name : 'Unassigned',
          createdAt: new Date(enquiry.createdAt).toLocaleDateString('en-IN')
        } : null,
        admission: admission ? {
          name: admission.name,
          mobile: admission.mobile,
          course: admission.course,
          totalFees: admission.totalFees,
          pendingAmount: admission.installments
            .filter(i => i.status === 'PENDING')
            .reduce((sum, i) => sum + i.amount, 0),
          admissionDate: new Date(admission.admissionDate).toLocaleDateString('en-IN'),
          status: admission.status
        } : null
      };
      contextHint = `Student details for mobile number ${mobile}`;
    }

    // ─── Email search ────────────────────────────────────────────────────
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
          email: enquiry.email,
          mobile: enquiry.mobile,
          course: enquiry.course,
          status: enquiry.status,
          assignedTo: enquiry.assignedTo ? enquiry.assignedTo.name : 'Unassigned'
        } : null,
        admission: admission ? {
          name: admission.name,
          course: admission.course,
          totalFees: admission.totalFees,
          status: admission.status
        } : null
      };
      contextHint = `Student details for email ${email}`;
    }

    // ─── Name search ─────────────────────────────────────────────────────
    else {
      const searchTerm = extractSearchTerm(query, 'name_search');

      if (!searchTerm || searchTerm.length < 2) {
        return errorResponse(res, 'Kuch aur specific bolo — naam, mobile, ya email chahiye', 400);
      }

      const [enquiries, admissions] = await Promise.all([
        Enquiry.find({ $text: { $search: searchTerm } })
          .populate('assignedTo', 'name')
          .select('name mobile email course status followUpDate assignedTo createdAt')
          .limit(5)
          .lean()
          .catch(() =>
            // Fallback if text index not available
            Enquiry.find({ name: { $regex: searchTerm, $options: 'i' } })
              .populate('assignedTo', 'name')
              .select('name mobile email course status followUpDate assignedTo createdAt')
              .limit(5)
              .lean()
          ),
        Admission.find({ name: { $regex: searchTerm, $options: 'i' } })
          .select('name mobile course totalFees installments admissionDate status')
          .limit(5)
          .lean()
      ]);

      const suggestions = !enquiries.length && !admissions.length
        ? await findNameSuggestions(searchTerm)
        : [];

      dbData = {
        type: 'name_search',
        searchTerm,
        suggestions,
        enquiries: enquiries.map(e => ({
          name: e.name,
          mobile: e.mobile,
          email: e.email,
          course: e.course,
          status: e.status,
          followUpDate: e.followUpDate ? new Date(e.followUpDate).toLocaleDateString('en-IN') : null,
          assignedTo: e.assignedTo ? e.assignedTo.name : 'Unassigned',
          addedOn: new Date(e.createdAt).toLocaleDateString('en-IN')
        })),
        admissions: admissions.map(a => ({
          name: a.name,
          mobile: a.mobile,
          course: a.course,
          totalFees: a.totalFees,
          pendingAmount: a.installments
            .filter(i => i.status === 'PENDING')
            .reduce((sum, i) => sum + i.amount, 0),
          admissionDate: new Date(a.admissionDate).toLocaleDateString('en-IN'),
          status: a.status
        }))
      };
      contextHint = `Search results for "${searchTerm}"`;
    }

    // ─── Get AI-formatted response from Gemini ───────────────────────────
    const aiResponse = await formatCRMResponse(
      `${contextHint}\nOriginal user query: "${query}"`,
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
      action: null,
      rawData: dbData
    }, 'Chat response generated successfully');
  });
}

module.exports = new ChatController();


