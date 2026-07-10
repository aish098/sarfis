const db = require('../config/db');

exports.getEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employees = await db('employees as e')
      .leftJoin('users as u', 'u.id', 'e.user_id')
      .where('e.company_id', companyId)
      .select('e.*', 'u.name as user_name', 'u.email as user_email')
      .orderBy('e.id', 'asc');

    const subsCount = await db('employee_notification_subscriptions as ens')
      .join('notification_events as ne', 'ens.event_id', 'ne.id')
      .select('ens.employee_id', 'ne.module')
      .count('ens.id as count')
      .where('ens.company_id', companyId)
      .andWhere('ens.enabled', true)
      .groupBy('ens.employee_id', 'ne.module');

    const formatted = employees.map(emp => {
      const empCounts = {};
      subsCount.filter(s => s.employee_id === emp.id).forEach(s => {
        empCounts[s.module] = parseInt(s.count || 0);
      });
      return {
        ...emp,
        notification_counts: empCounts
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, role, department, salary, bankName, accountNumber, status, userId } = req.body;
    
    if (!name || salary === undefined) {
      return res.status(400).json({ error: 'Name and salary are required.' });
    }

    const [employee] = await db('employees')
      .insert({
        company_id: companyId,
        user_id: userId || null,
        name,
        role: role || null,
        department: department || null,
        salary: parseFloat(salary),
        bank_name: bankName || null,
        account_number: accountNumber || null,
        status: status || 'Active'
      })
      .returning('*');
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { name, role, department, salary, bankName, accountNumber, status, userId } = req.body;

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (role !== undefined) payload.role = role;
    if (department !== undefined) payload.department = department;
    if (salary !== undefined) payload.salary = parseFloat(salary);
    if (bankName !== undefined) payload.bank_name = bankName;
    if (accountNumber !== undefined) payload.account_number = accountNumber;
    if (status !== undefined) payload.status = status;
    if (userId !== undefined) payload.user_id = userId || null;

    payload.updated_at = db.fn.now();

    const [updated] = await db('employees')
      .where({ id, company_id: companyId })
      .update(payload)
      .returning('*');

    if (!updated) return res.status(404).json({ error: 'Employee not found.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const deleted = await db('employees')
      .where({ id, company_id: companyId })
      .del();

    if (!deleted) return res.status(404).json({ error: 'Employee not found.' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotificationSubscriptions = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    
    // Verify employee exists
    const employee = await db('employees').where({ id, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const events = await db('notification_events').orderBy('module').orderBy('event_name');
    const subs = await db('employee_notification_subscriptions').where({ employee_id: id, company_id: companyId });

    const channelsSupported = ['EMAIL', 'APP', 'SMS', 'WHATSAPP', 'SLACK', 'TEAMS'];

    const result = events.map(ev => {
      const eventSubs = subs.filter(s => s.event_id === ev.id);
      const channels = {};
      channelsSupported.forEach(ch => {
        const match = eventSubs.find(s => s.channel === ch);
        channels[ch] = match ? match.enabled : false;
      });

      return {
        eventId: ev.id,
        eventCode: ev.event_code,
        eventName: ev.event_name,
        module: ev.module,
        category: ev.category,
        channels
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateNotificationSubscriptions = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { subscriptions } = req.body;

    // Verify employee exists
    const employee = await db('employees').where({ id, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    if (!Array.isArray(subscriptions)) {
      return res.status(400).json({ error: 'Subscriptions array is required.' });
    }

    await db.transaction(async (trx) => {
      for (const sub of subscriptions) {
        const { eventId, channels } = sub;
        if (!eventId || !channels) continue;

        for (const [channel, enabled] of Object.entries(channels)) {
          await trx('employee_notification_subscriptions')
            .insert({
              company_id: companyId,
              employee_id: id,
              event_id: eventId,
              channel: channel.toUpperCase(),
              enabled: !!enabled,
              updated_at: trx.fn.now()
            })
            .onConflict(['company_id', 'employee_id', 'event_id', 'channel'])
            .merge({
              enabled: !!enabled,
              updated_at: trx.fn.now()
            });
        }
      }
    });

    res.json({ message: 'Notification preferences updated successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
