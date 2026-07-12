const db = require('../src/config/db');

async function test() {
  console.log('1. Fetching token for admin@sarfis.com...');
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sarfis.com', password: 'password' })
  });
  if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
  const { token } = await loginRes.json();
  console.log('   Token acquired successfully.');

  console.log('2. Querying current settings in DB for company 12...');
  const before = await db('settings').where({ scope: 'company', target_id: '12' }).first();
  console.log('   Before:', before ? before.value : 'None (will insert)');

  console.log('3. Sending PUT request to update settings...');
  const updatePayload = {
    ...(before ? before.value : {}),
    inventoryEnabled: false,
    payrollEnabled: true,
    riskEnabled: false,
    fixedAssetsEnabled: false
  };

  const updateRes = await fetch('http://localhost:5001/api/settings/12', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-company-id': '12'
    },
    body: JSON.stringify(updatePayload)
  });
  if (!updateRes.ok) throw new Error('Update failed: ' + await updateRes.text());
  const updatedSettings = await updateRes.json();
  console.log('   API Response:', updatedSettings);

  console.log('4. Querying database settings after update...');
  const after = await db('settings').where({ scope: 'company', target_id: '12' }).first();
  console.log('   After:', after.value);

  // Reset back to original
  console.log('5. Resetting settings back to original...');
  const resetRes = await fetch('http://localhost:5001/api/settings/12', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-company-id': '12'
    },
    body: JSON.stringify(before ? before.value : {})
  });
  if (!resetRes.ok) throw new Error('Reset failed: ' + await resetRes.text());
  console.log('   Done.');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
