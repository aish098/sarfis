const db = require('../config/db');

exports.getEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employees = await db('employees as e')
      .leftJoin('users as u', 'u.id', 'e.user_id')
      .where('e.company_id', companyId)
      .select('e.*', 'u.name as user_name', 'u.email as user_email')
      .orderBy('e.id', 'asc');
    res.json(employees);
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
