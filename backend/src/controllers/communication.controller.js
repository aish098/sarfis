const db = require('../config/db');

exports.getAdminCommunications = async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: 'Company context required.' });

    const conversations = await db('communications as c')
      .join('employees as e', 'c.employee_id', 'e.id')
      .leftJoin('users as u', 'e.user_id', 'u.id')
      .where('c.company_id', companyId)
      .andWhere('c.parent_id', null)
      .select(
        'c.id',
        'c.employee_id',
        'e.name as employee_name',
        'u.email as employee_email',
        'e.department',
        'e.role as designation',
        'c.subject',
        'c.body',
        'c.status',
        'c.sender_type',
        'c.created_at',
        'c.read_at'
      )
      .orderBy('c.created_at', 'desc');

    const result = await Promise.all(conversations.map(async (conv) => {
      const replies = await db('communications')
        .where({ parent_id: conv.id })
        .orderBy('created_at', 'asc');

      const latestMsg = replies.length > 0 ? replies[replies.length - 1] : conv;
      
      const unreadCount = replies.filter(r => r.sender_type === 'EMPLOYEE' && r.status !== 'READ').length + 
                          (conv.sender_type === 'EMPLOYEE' && conv.status !== 'READ' ? 1 : 0);

      return {
        ...conv,
        unreadCount,
        repliesCount: replies.length,
        lastMessageTime: latestMsg.created_at,
        lastMessageBody: latestMsg.body,
        lastSenderType: latestMsg.sender_type
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdminThread = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { parentId } = req.params;

    const parentMsg = await db('communications as c')
      .join('employees as e', 'c.employee_id', 'e.id')
      .leftJoin('users as u', 'e.user_id', 'u.id')
      .where({ 'c.id': parentId, 'c.company_id': companyId })
      .select('c.*', 'e.name as employee_name', 'u.email as employee_email', 'e.department', 'e.role as designation')
      .first();

    if (!parentMsg) return res.status(404).json({ error: 'Conversation not found.' });

    const replies = await db('communications')
      .where({ parent_id: parentId })
      .orderBy('created_at', 'asc');

    // Mark any employee replies in this thread as READ
    await db('communications')
      .where({ parent_id: parentId, sender_type: 'EMPLOYEE' })
      .update({ status: 'READ', read_at: db.fn.now() });

    if (parentMsg.sender_type === 'EMPLOYEE' && parentMsg.status !== 'READ') {
      await db('communications')
        .where({ id: parentId })
        .update({ status: 'READ', read_at: db.fn.now() });
      parentMsg.status = 'READ';
    }

    res.json({
      conversation: parentMsg,
      replies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminComposeMessage = async (req, res) => {
  try {
    const companyId = req.companyId;
    const senderId = req.user.id;
    const { employeeId, subject, body } = req.body;

    if (!employeeId || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required.' });
    }

    const employee = await db('employees as e')
      .leftJoin('users as u', 'e.user_id', 'u.id')
      .where({ 'e.id': employeeId, 'e.company_id': companyId })
      .select('e.*', 'u.email as email')
      .first();
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const recipientEmail = employee.email || null;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Selected employee does not have a valid email address.' });
    }

    const [communication] = await db('communications')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        sender_id: senderId,
        sender_type: 'ADMIN',
        subject,
        body,
        status: 'QUEUED'
      })
      .returning('*');

    await db('notification_queue').insert({
      company_id: companyId,
      user_id: employee.user_id || senderId,
      event_code: 'CUSTOM_COMMUNICATION',
      recipient_email: recipientEmail,
      subject,
      body,
      status: 'PENDING',
      attempts: 0,
      max_attempts: 3
    });

    res.status(201).json(communication);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminReplyMessage = async (req, res) => {
  try {
    const companyId = req.companyId;
    const senderId = req.user.id;
    const { parentId, body } = req.body;

    if (!parentId || !body) {
      return res.status(400).json({ error: 'Parent message and body are required.' });
    }

    const parentMsg = await db('communications').where({ id: parentId, company_id: companyId }).first();
    if (!parentMsg) return res.status(404).json({ error: 'Parent conversation not found.' });

    const employee = await db('employees as e')
      .leftJoin('users as u', 'e.user_id', 'u.id')
      .where({ 'e.id': parentMsg.employee_id })
      .select('e.*', 'u.email as email')
      .first();
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const [reply] = await db('communications')
      .insert({
        company_id: companyId,
        employee_id: parentMsg.employee_id,
        sender_id: senderId,
        sender_type: 'ADMIN',
        subject: `Re: ${parentMsg.subject}`,
        body,
        status: 'QUEUED',
        parent_id: parentId
      })
      .returning('*');

    if (employee.email) {
      await db('notification_queue').insert({
        company_id: companyId,
        user_id: employee.user_id || senderId,
        event_code: 'CUSTOM_COMMUNICATION',
        recipient_email: employee.email,
        subject: `Re: ${parentMsg.subject}`,
        body,
        status: 'PENDING',
        attempts: 0,
        max_attempts: 3
      });
    }

    res.status(201).json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployeeCommunications = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    const employee = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const conversations = await db('communications')
      .where({ company_id: companyId, employee_id: employee.id, parent_id: null })
      .orderBy('created_at', 'desc');

    const result = await Promise.all(conversations.map(async (conv) => {
      const replies = await db('communications')
        .where({ parent_id: conv.id })
        .orderBy('created_at', 'asc');

      const latestMsg = replies.length > 0 ? replies[replies.length - 1] : conv;
      
      const unreadCount = replies.filter(r => r.sender_type === 'ADMIN' && r.status !== 'READ').length + 
                          (conv.sender_type === 'ADMIN' && conv.status !== 'READ' ? 1 : 0);

      return {
        ...conv,
        unreadCount,
        repliesCount: replies.length,
        lastMessageTime: latestMsg.created_at,
        lastMessageBody: latestMsg.body,
        lastSenderType: latestMsg.sender_type
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployeeThread = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const { parentId } = req.params;

    const employee = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const parentMsg = await db('communications')
      .where({ id: parentId, employee_id: employee.id, company_id: companyId })
      .first();

    if (!parentMsg) return res.status(404).json({ error: 'Conversation not found.' });

    const replies = await db('communications')
      .where({ parent_id: parentId })
      .orderBy('created_at', 'asc');

    await db('communications')
      .where({ parent_id: parentId, sender_type: 'ADMIN' })
      .update({ status: 'READ', read_at: db.fn.now() });

    if (parentMsg.sender_type === 'ADMIN' && parentMsg.status !== 'READ') {
      await db('communications')
        .where({ id: parentId })
        .update({ status: 'READ', read_at: db.fn.now() });
      parentMsg.status = 'READ';
    }

    res.json({
      conversation: parentMsg,
      replies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.employeeReplyMessage = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const { parentId, body } = req.body;

    if (!parentId || !body) {
      return res.status(400).json({ error: 'Parent message and reply body are required.' });
    }

    const employee = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const parentMsg = await db('communications')
      .where({ id: parentId, employee_id: employee.id, company_id: companyId })
      .first();

    if (!parentMsg) return res.status(404).json({ error: 'Parent conversation not found.' });

    const [reply] = await db('communications')
      .insert({
        company_id: companyId,
        employee_id: employee.id,
        sender_id: userId,
        sender_type: 'EMPLOYEE',
        subject: `Re: ${parentMsg.subject}`,
        body,
        status: 'QUEUED',
        parent_id: parentId
      })
      .returning('*');

    const adminUser = parentMsg.sender_id 
      ? await db('users').where({ id: parentMsg.sender_id }).first()
      : null;

    const adminEmail = adminUser?.email || 'admin@sarfis.com';

    await db('notification_queue').insert({
      company_id: companyId,
      user_id: parentMsg.sender_id || 1,
      event_code: 'CUSTOM_COMMUNICATION',
      recipient_email: adminEmail,
      subject: `Employee Reply: ${employee.name} - Re: ${parentMsg.subject}`,
      body: `<p><strong>${employee.name}</strong> replied to conversation:</p><blockquote style="border-left:4px solid #ccc;padding-left:10px;margin:10px 0;">${body}</blockquote>`,
      status: 'PENDING',
      attempts: 0,
      max_attempts: 3
    });

    if (parentMsg.sender_id) {
      await db('notifications').insert({
        company_id: companyId,
        user_id: parentMsg.sender_id,
        event_code: 'CUSTOM_COMMUNICATION',
        title: `New reply from ${employee.name}`,
        message: `${employee.name} replied: "${body.substring(0, 60)}${body.length > 60 ? '...' : ''}"`,
        priority: 'MEDIUM',
        is_read: false
      });
    }

    res.status(201).json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEssProfile = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) return res.status(404).json({ error: 'Employee profile not found.' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEssLeaves = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) return res.json([]);
    const leaves = await db('leave_applications').where({ employee_id: emp.id }).orderBy('created_at', 'desc');
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEssLeaveBalances = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) return res.json({ total_allowed: 15, remaining: 15 });
    const balance = await db('leave_balances').where({ employee_id: emp.id }).first();
    res.json(balance || { total_allowed: 15, remaining: 15 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitEssLeave = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) return res.status(404).json({ error: 'Employee profile not found.' });

    const { leave_type, start_date, end_date, reason } = req.body;
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Leave type, start date, and end date are required.' });
    }

    const [app] = await db('leave_applications').insert({
      employee_id: emp.id,
      leave_type,
      start_date,
      end_date,
      reason,
      status: 'Pending'
    }).returning('*');

    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEssPayslips = async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) return res.json([]);
    const payslips = await db('payroll_payslips').where({ employee_id: emp.id }).orderBy('period', 'desc');
    res.json(payslips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};