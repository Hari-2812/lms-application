const PDFDocument = require('pdfkit');
const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const activity = require('../services/activityService');
const razorpay = require('../services/razorpayService');
const settingsService = require('../services/settingsService');
const { notifyUser } = require('../services/notificationService');
const {
  grantCourseAccess,
  isGrantLive,
  markPaymentFailed,
  markPaymentSuccessful,
  rupees,
} = require('../services/enrolmentService');

/**
 * Payments: the admin transaction list, its PDF report and the actions on a
 * transaction, plus the Razorpay checkout endpoints and webhook.
 *
 * A "transaction" is an Enrollment row with a price. Status vocabulary:
 * completed = successful, pending, failed, cancelled.
 */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STATUS_LABEL = { completed: 'Successful', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled' };

const METHOD_LABEL = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  'bank-transfer': 'Bank transfer',
  razorpay: 'Razorpay',
  free: 'Free',
};

// The PDF's built-in Helvetica has no ₹ glyph, so the report spells it out.
const pdfMoney = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

/** Builds the Mongo filter for the list and the report from the same query string. */
async function filterFrom(query) {
  const { search, status, courseId, studentId, from, to, includeFree } = query;
  const filter = {};
  const all = [];

  // Free enrolments are left out unless asked for — except pending ones,
  // which (with free self-enrolment off) are waiting on an admin here.
  if (includeFree !== 'true') all.push({ $or: [{ amount: { $gt: 0 } }, { status: 'pending' }] });
  if (status && Enrollment.STATUSES.includes(status)) filter.status = status;
  if (courseId) filter.courseId = courseId;
  if (studentId) filter.studentId = studentId;

  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.$gte = start;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999); // inclusive of the whole "to" day
      range.$lte = end;
    }
  }
  if (Object.keys(range).length) filter.createdAt = range;

  if (search) {
    const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] }).select('_id');
    all.push({
      $or: [{ studentId: { $in: users.map((u) => u._id) } }, { transactionId: pattern }, { reference: pattern }],
    });
  }

  if (all.length) filter.$and = all;
  return filter;
}

async function findTransactions(query, limit = 500) {
  const filter = await filterFrom(query);
  return Enrollment.find(filter)
    .populate('studentId', 'name email phone')
    .populate('courseId', 'title price')
    .sort({ createdAt: -1 })
    .limit(limit);
}

function summarise(rows) {
  const summary = {
    count: rows.length,
    byStatus: { completed: 0, pending: 0, failed: 0, cancelled: 0 },
    successfulAmount: 0,
    pendingAmount: 0,
  };
  for (const row of rows) {
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + 1;
    if (row.status === 'completed') summary.successfulAmount += row.amount;
    if (row.status === 'pending') summary.pendingAmount += row.amount;
  }
  return summary;
}

/** GET /api/admin/payments?search=&status=&courseId=&studentId=&from=&to=&includeFree= */
async function listPayments(req, res, next) {
  try {
    const rows = await findTransactions(req.query);

    // A successful payment whose learner has no live access is the "payment
    // not reflected" case the admin can retry.
    const grants = await CourseAccess.find({
      studentId: { $in: rows.map((r) => r.studentId?._id).filter(Boolean) },
    }).select('studentId courseId active expiresAt');
    const live = new Set(grants.filter(isGrantLive).map((g) => `${g.studentId}:${g.courseId}`));

    res.json({
      summary: summarise(rows),
      payments: rows.map((row) => ({
        ...row.toJSON(),
        accessActive: live.has(`${row.studentId?._id}:${row.courseId?._id}`),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/payments/report.pdf — the filtered list as a PDF file. */
async function downloadReport(req, res, next) {
  try {
    const rows = await findTransactions(req.query, 2000);
    const summary = summarise(rows);
    const { branding } = await settingsService.get();

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payments-report-${stamp}.pdf"`);
    doc.pipe(res);

    const blue = '#1d3ed8';
    const ink = '#0f1b33';
    const muted = '#547096';
    const pageWidth = doc.page.width - 72;

    // --- header band ---
    doc.rect(0, 0, doc.page.width, 70).fill(blue);
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(18).text(`${branding.platformName} — Payments report`, 36, 22);
    doc.font('Helvetica').fontSize(9).text(`Generated ${new Date().toLocaleString('en-GB')}`, 36, 46);

    // --- filters + summary ---
    const filters = [];
    if (req.query.status) filters.push(`Status: ${STATUS_LABEL[req.query.status] || req.query.status}`);
    if (req.query.courseId) {
      const course = await Course.findById(req.query.courseId).select('title');
      filters.push(`Course: ${course?.title || '—'}`);
    }
    if (req.query.from || req.query.to) filters.push(`Dates: ${req.query.from || '…'} to ${req.query.to || '…'}`);
    if (req.query.search) filters.push(`Search: "${req.query.search}"`);

    doc.fill(ink).font('Helvetica').fontSize(9);
    doc.text(filters.length ? filters.join('   ·   ') : 'All transactions', 36, 86, { width: pageWidth });

    const tiles = [
      ['Transactions', String(summary.count)],
      ['Successful', `${summary.byStatus.completed}  ·  ${pdfMoney(summary.successfulAmount)}`],
      ['Pending', `${summary.byStatus.pending}  ·  ${pdfMoney(summary.pendingAmount)}`],
      ['Failed', String(summary.byStatus.failed)],
    ];
    const tileWidth = (pageWidth - 30) / 4;
    tiles.forEach(([label, value], i) => {
      const x = 36 + i * (tileWidth + 10);
      doc.roundedRect(x, 104, tileWidth, 44, 6).fill('#eff5ff');
      doc.fill(muted).fontSize(8).text(label.toUpperCase(), x + 10, 112);
      doc.fill(ink).font('Helvetica-Bold').fontSize(12).text(value, x + 10, 125, { width: tileWidth - 20 });
      doc.font('Helvetica');
    });

    // --- table ---
    const columns = [
      ['Date', 62],
      ['Transaction ID', 118],
      ['Learner', 150],
      ['Course', 170],
      ['Amount', 62],
      ['Method', 62],
      ['Reference', 90],
      ['Status', 56],
    ];
    let y = 166;

    const drawHeader = () => {
      doc.rect(36, y, pageWidth, 20).fill(blue);
      let x = 40;
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(8);
      for (const [label, width] of columns) {
        doc.text(label, x, y + 6, { width: width - 6 });
        x += width;
      }
      doc.font('Helvetica');
      y += 20;
    };
    drawHeader();

    rows.forEach((row, index) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 36;
        drawHeader();
      }
      if (index % 2 === 0) doc.rect(36, y, pageWidth, 22).fill('#f7f9fc');
      const cells = [
        new Date(row.createdAt).toLocaleDateString('en-GB'),
        row.transactionId || `TXN-${String(row._id).slice(-8).toUpperCase()}`,
        `${row.studentId?.name || 'Deleted account'}\n${row.studentId?.email || ''}`,
        row.courseId?.title || 'Deleted course',
        pdfMoney(row.amount),
        METHOD_LABEL[row.method] || row.method || '—',
        row.reference || '—',
        STATUS_LABEL[row.status] || row.status,
      ];
      let x = 40;
      doc.fill(ink).fontSize(7.5);
      cells.forEach((cell, i) => {
        const [, width] = columns[i];
        doc.text(cell, x, y + 4, { width: width - 6, height: 18, ellipsis: true });
        x += width;
      });
      y += 22;
    });

    if (!rows.length) {
      doc.fill(muted).fontSize(10).text('No transactions match these filters.', 36, y + 14);
    }

    doc.end();

    await activity.log(req, {
      category: 'payment',
      action: 'payment.report_downloaded',
      summary: `Downloaded a payments report (${rows.length} transactions)`,
      meta: { filters: req.query },
    });
  } catch (err) {
    next(err);
  }
}

async function loadTransaction(id) {
  return Enrollment.findById(id).populate('studentId', 'name email').populate('courseId', 'title price');
}

/** POST /api/admin/payments/:id/confirm  body: { reference? } — mark paid and enrol. */
async function confirmPayment(req, res, next) {
  try {
    const enrollment = await loadTransaction(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Transaction not found' });
    if (enrollment.status === 'completed') {
      return res.status(400).json({ error: 'This payment is already marked successful' });
    }

    const previous = enrollment.status;
    await markPaymentSuccessful(enrollment, { reference: req.body?.reference, by: req.user._id });

    await activity.log(req, {
      category: 'payment',
      action: 'payment.confirmed',
      summary: `Marked ${enrollment.transactionId} (${rupees(enrollment.amount)}, ${enrollment.studentId?.name}) as paid and enrolled the learner — was ${STATUS_LABEL[previous]}`,
      entityType: 'enrollment',
      entityId: enrollment._id,
      meta: { reference: enrollment.reference },
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/payments/:id/fail  body: { reason? } */
async function failPayment(req, res, next) {
  try {
    const enrollment = await loadTransaction(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Transaction not found' });
    if (enrollment.status !== 'pending') {
      return res.status(400).json({ error: 'Only a pending payment can be marked failed' });
    }

    await markPaymentFailed(enrollment, { reason: req.body?.reason, by: req.user._id });

    await activity.log(req, {
      category: 'payment',
      action: 'payment.failed',
      summary: `Marked ${enrollment.transactionId} (${enrollment.studentId?.name}) as failed${
        enrollment.failureReason ? `: ${enrollment.failureReason}` : ''
      }`,
      entityType: 'enrollment',
      entityId: enrollment._id,
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/payments/:id/cancel */
async function cancelPayment(req, res, next) {
  try {
    const enrollment = await loadTransaction(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Transaction not found' });
    if (enrollment.status === 'completed') {
      return res.status(400).json({ error: 'A successful payment cannot be cancelled here' });
    }

    enrollment.status = 'cancelled';
    enrollment.history.push({ status: 'cancelled', note: 'Cancelled by admin', by: req.user._id });
    await enrollment.save();

    await notifyUser(enrollment.studentId._id, {
      type: 'payment',
      title: 'Enrolment cancelled',
      message: `Your enrolment for "${enrollment.courseId?.title}" was cancelled. Get in touch if this looks wrong.`,
      courseId: enrollment.courseId?._id,
      link: '/my-courses',
    });

    await activity.log(req, {
      category: 'payment',
      action: 'payment.cancelled',
      summary: `Cancelled ${enrollment.transactionId} (${enrollment.studentId?.name}, "${enrollment.courseId?.title}")`,
      entityType: 'enrollment',
      entityId: enrollment._id,
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/payments/:id/retry — for a payment that "has not reflected".
 *
 *   successful but no access → run the enrolment again
 *   Razorpay order not yet successful → ask Razorpay whether it was paid
 */
async function retryPayment(req, res, next) {
  try {
    const enrollment = await loadTransaction(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Transaction not found' });
    const course = await Course.findById(enrollment.courseId?._id);
    if (!course) return res.status(404).json({ error: 'The course for this payment no longer exists' });

    if (enrollment.status === 'completed') {
      const { alreadyActive } = await grantCourseAccess(enrollment.studentId._id, course, {
        by: req.user._id,
        source: 'payment',
        learnerNotice: {
          title: 'Enrolment confirmed',
          message: `Your payment is confirmed and "${course.title}" is now unlocked.`,
          setting: 'learner.paymentConfirmed',
        },
      });
      if (alreadyActive) return res.json({ success: true, message: 'The learner already has access — nothing to fix.' });

      await activity.log(req, {
        category: 'enrolment',
        action: 'payment.retry_enrolment',
        summary: `Re-ran enrolment for ${enrollment.transactionId} — ${enrollment.studentId?.name} now has "${course.title}"`,
        entityType: 'enrollment',
        entityId: enrollment._id,
      });
      return res.json({ success: true, message: 'Enrolment completed — the learner now has access.' });
    }

    const { payments } = await settingsService.get();
    if (enrollment.gateway === 'razorpay' && enrollment.gatewayOrderId && razorpay.isReady(payments)) {
      const attempts = await razorpay.fetchOrderPayments(payments, enrollment.gatewayOrderId);
      const captured = attempts.find((p) => p.status === 'captured');
      if (captured) {
        await markPaymentSuccessful(enrollment, {
          reference: captured.id,
          by: req.user._id,
          note: 'Recovered from Razorpay by admin retry',
        });
        await activity.log(req, {
          category: 'payment',
          action: 'payment.retry_recovered',
          summary: `Retry found a captured Razorpay payment for ${enrollment.transactionId}; learner enrolled`,
          entityType: 'enrollment',
          entityId: enrollment._id,
        });
        return res.json({ success: true, message: 'Razorpay confirms the payment. The learner is now enrolled.' });
      }
      if (attempts.some((p) => p.status === 'authorized')) {
        return res.status(409).json({
          error: 'The payment is authorised but not captured yet. Capture it in the Razorpay dashboard, then retry.',
        });
      }
      return res.status(409).json({ error: 'Razorpay has no successful payment for this order yet.' });
    }

    return res.status(400).json({
      error: 'This is a manual payment, so there is nothing to re-check. Mark it as paid once the money has arrived.',
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/payments/:id  body: { reference } — correct a payment reference. */
async function updatePayment(req, res, next) {
  try {
    const enrollment = await loadTransaction(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Transaction not found' });

    const reference = String(req.body?.reference ?? '').trim().slice(0, 120);
    const previous = enrollment.reference;
    if (reference === previous) return res.json(enrollment);

    enrollment.reference = reference;
    enrollment.history.push({ status: enrollment.status, note: `Reference changed to "${reference || '—'}"`, by: req.user._id });
    await enrollment.save();

    await activity.log(req, {
      category: 'payment',
      action: 'payment.reference_edited',
      summary: `Changed the reference on ${enrollment.transactionId} from "${previous || '—'}" to "${reference || '—'}"`,
      entityType: 'enrollment',
      entityId: enrollment._id,
    });

    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------ Razorpay */

/**
 * POST /api/payments/razorpay/order  body: { courseId }
 * Creates (or reuses) the learner's transaction and a Razorpay order for it.
 */
async function createRazorpayOrder(req, res, next) {
  try {
    const { payments, branding } = await settingsService.get();
    if (!razorpay.isReady(payments)) return res.status(400).json({ error: 'Online payment is not available right now' });

    const course = await Course.findById(req.body?.courseId);
    if (!course || course.published === false) return res.status(404).json({ error: 'Course not found' });

    const amount = Number(course.price) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'This course is free — no payment needed' });

    const studentId = req.user._id;
    const grant = await CourseAccess.findOne({ studentId, courseId: course._id });
    if (req.user.fullAccess || isGrantLive(grant)) {
      return res.status(400).json({ error: 'You already have access to this course' });
    }

    let enrollment = await Enrollment.findOne({ studentId, courseId: course._id });
    if (enrollment?.status === 'completed') {
      return res.status(400).json({ error: 'This course is already paid for. Contact support if it is not unlocked.' });
    }

    if (!enrollment) {
      enrollment = new Enrollment({
        studentId,
        courseId: course._id,
        transactionId: Enrollment.generateTransactionId(),
        history: [{ status: 'pending', note: 'Online checkout started' }],
      });
    } else {
      enrollment.attempts = (enrollment.attempts || 1) + 1;
      if (!enrollment.transactionId) enrollment.transactionId = Enrollment.generateTransactionId();
      enrollment.history.push({ status: 'pending', note: `Online checkout started (attempt ${enrollment.attempts})` });
    }
    Object.assign(enrollment, {
      status: 'pending',
      amount,
      currency: payments.currency || 'INR',
      method: 'razorpay',
      gateway: 'razorpay',
      failureReason: '',
    });

    const order = await razorpay.createOrder(payments, {
      amount,
      currency: enrollment.currency,
      receipt: enrollment.transactionId,
      notes: { transactionId: enrollment.transactionId, courseId: String(course._id), studentId: String(studentId) },
    });
    enrollment.gatewayOrderId = order.id;
    await enrollment.save();

    res.json({
      keyId: payments.razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      transactionId: enrollment.transactionId,
      name: branding.platformName,
      description: course.title,
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/payments/razorpay/verify  body: { orderId, paymentId, signature } */
async function verifyRazorpayPayment(req, res, next) {
  try {
    const { orderId, paymentId, signature } = req.body || {};
    const { payments } = await settingsService.get();
    if (!razorpay.isReady(payments)) return res.status(400).json({ error: 'Online payment is not available right now' });

    const enrollment = await Enrollment.findOne({ gatewayOrderId: orderId, studentId: req.user._id });
    if (!enrollment) return res.status(404).json({ error: 'Payment not found' });

    if (!razorpay.verifyPaymentSignature(payments.razorpayKeySecret, orderId, paymentId, signature)) {
      await markPaymentFailed(enrollment, { reason: 'Payment signature could not be verified' });
      return res.status(400).json({ error: 'We could not verify this payment. If money was deducted, contact support.' });
    }

    const { granted } = await markPaymentSuccessful(enrollment, { reference: paymentId });
    res.json({ status: 'completed', granted, transactionId: enrollment.transactionId });
  } catch (err) {
    next(err);
  }
}

/** POST /api/payments/razorpay/failed  body: { orderId, paymentId?, reason? } — checkout reported a failure. */
async function reportRazorpayFailure(req, res, next) {
  try {
    const { orderId, reason } = req.body || {};
    const enrollment = await Enrollment.findOne({ gatewayOrderId: orderId, studentId: req.user._id });
    if (!enrollment) return res.status(404).json({ error: 'Payment not found' });

    // A later success on the same order (the learner retried in the same
    // checkout window) wins; never downgrade a successful payment.
    if (enrollment.status === 'pending') {
      await markPaymentFailed(enrollment, { reason: String(reason || 'Payment was declined').slice(0, 300) });
    }
    res.json({ status: enrollment.status, transactionId: enrollment.transactionId });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/webhook/razorpay — public; authenticated by signature.
 * The safety net for a learner who paid and closed the tab before the
 * checkout callback reached us.
 */
async function razorpayWebhook(req, res, next) {
  try {
    const { payments } = await settingsService.get();
    const signature = req.get('x-razorpay-signature');
    if (!razorpay.verifyWebhookSignature(payments.razorpayWebhookSecret, req.rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    const orderId = payment?.order_id || req.body?.payload?.order?.entity?.id;
    if (!orderId) return res.json({ ok: true });

    const enrollment = await Enrollment.findOne({ gatewayOrderId: orderId });
    if (!enrollment) return res.json({ ok: true });

    if ((event === 'payment.captured' || event === 'order.paid') && enrollment.status !== 'completed') {
      await markPaymentSuccessful(enrollment, { reference: payment?.id, note: 'Confirmed by Razorpay webhook' });
    } else if (event === 'payment.failed' && enrollment.status === 'pending') {
      await markPaymentFailed(enrollment, { reason: payment?.error_description || 'Payment failed' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPayments,
  downloadReport,
  confirmPayment,
  failPayment,
  cancelPayment,
  retryPayment,
  updatePayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  reportRazorpayFailure,
  razorpayWebhook,
};
