const { Enquiry, Admission, Payment, Note } = require('../models');
const { formatCRMResponse } = require('../services/geminiService');
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
  const hindiWords = ['batao', 'dikhao', 'hai', 'hain', 'ka', 'ki', 'ke', 'aaj', 'sab', 'kiska', 'uska', 'baki'];

  if (hindiChars.test(q) || hindiWords.some(w => q.includes(w))) {
    return 'hindi';
  }
  return 'english';
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
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Query is required', 400);
    }

    const intent = detectIntent(query);
    const language = detectLanguage(query);
    let dbData = {};
    let contextHint = '';

    // ─── Call / WhatsApp intent ──────────────────────────────────────────
    if (intent === 'call' || intent === 'whatsapp') {
      const searchTerm = extractSearchTerm(query, intent);

      // Check if mobile number directly given
      const directMobile = query.match(/\b[6-9]\d{9}\b/);
      let targetMobile = null;
      let targetName = null;

      if (directMobile) {
        targetMobile = directMobile[0];
        // Try to find name from DB
        const found = await Enquiry.findOne({ mobile: targetMobile }).select('name').lean()
          || await Admission.findOne({ mobile: targetMobile }).select('name').lean();
        targetName = found ? found.name : `(${targetMobile})`;
      } else if (searchTerm && searchTerm.length >= 2) {
        // Search by name
        const found = await Enquiry.findOne({ name: { $regex: searchTerm, $options: 'i' } })
          .select('name mobile').lean()
          || await Admission.findOne({ name: { $regex: searchTerm, $options: 'i' } })
          .select('name mobile').lean();

        if (found) {
          targetMobile = found.mobile;
          targetName = found.name;
        }
      }

      if (!targetMobile) {
        const notFound = language === 'hindi'
          ? `❌ "${searchTerm}" naam ka koi record nahi mila. Sahi naam ya mobile number bolo.`
          : `❌ No record found for "${searchTerm}". Please provide correct name or mobile.`;
        return successResponse(res, {
          message: notFound,
          intent,
          language,
          action: null
        }, 'Chat response generated');
      }

      const actionType = intent; // 'call' or 'whatsapp'
      const aiMsg = language === 'hindi'
        ? `📞 ${targetName} ka number hai: **${targetMobile}**\nNeeche button dabao ${actionType === 'call' ? 'call' : 'WhatsApp'} karne ke liye! 👇`
        : `📞 ${targetName}'s number: **${targetMobile}**\nTap the button below to ${actionType === 'call' ? 'call' : 'WhatsApp'}! 👇`;

      return successResponse(res, {
        message: aiMsg,
        intent,
        language,
        action: {
          type: actionType,       // 'call' or 'whatsapp'
          mobile: targetMobile,
          name: targetName
        }
      }, 'Chat response generated successfully');
    }

    // ─── Save Custom Note intent ──────────────────────────────────────────
    if (intent === 'save_note') {
      const noteContent = extractSearchTerm(query, 'save_note');

      if (!noteContent || noteContent.trim().length < 2) {
        const errResponse = language === 'hindi'
          ? '❌ Kuch valid message ya note likhne ko kaho (example: "save note: kal test hai").'
          : '❌ Please provide a valid message to save (example: "save note: test tomorrow").';
        return successResponse(res, { message: errResponse, intent, language, action: null }, 'Note empty');
      }

      const newNote = await Note.create({
        userId: req.user.id,
        content: noteContent
      });

      const responseText = language === 'hindi'
        ? `✅ Note successfully save ho gaya hai: "${noteContent}"\nJab bhi chahiye ho, bolo "saved notes dikhao".`
        : `✅ Note successfully saved: "${noteContent}"\nWhenever you need it, ask "show saved notes".`;

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
      const notes = await Note.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      dbData = {
        type: 'user_saved_notes',
        count: notes.length,
        notes: notes.map(n => ({
          content: n.content,
          date: new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        }))
      };
      contextHint = 'List of saved notes/messages by this staff member';
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

      dbData = {
        type: 'name_search',
        searchTerm,
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
      language
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
