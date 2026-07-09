const { Enquiry, Admission, Payment } = require('../models');
const { formatCRMResponse } = require('../services/geminiService');
const catchAsync = require('../utils/catchAsync');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Detect query intent from user message
function detectIntent(query) {
  const q = query.toLowerCase();

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
      rawData: dbData
    }, 'Chat response generated successfully');
  });
}

module.exports = new ChatController();
