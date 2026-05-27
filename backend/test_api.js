const jwt = require('jsonwebtoken');

async function testApi() {
  const token = jwt.sign({ id: 1, companyId: 1, role: 'Company Admin' }, process.env.JWT_SECRET || 'scafis_super_secret_key_2025', { expiresIn: '1h' });
  
  try {
    const res = await fetch('http://localhost:5001/api/accounts/4', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        code: '1120',
        name: 'Interest Receivable Updated',
        category: 'Asset',
        normal_balance: 'Credit',
        is_contra: true
      })
    });
      
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testApi();
