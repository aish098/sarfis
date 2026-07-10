const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runSecurityAudit() {
  console.log("=========================================================");
  console.log("             SARFIS SYSTEM SECURITY & RBAC AUDIT         ");
  console.log("=========================================================");

  let auditPassed = true;

  // 1. Static Route Middleware Scan
  console.log("\n[STATIC ANALYSIS] Scanning route files for auth middleware...");
  const routesDir = path.join(__dirname, '../src/routes');
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if authMiddleware is loaded
    const loadsAuth = content.includes('authMiddleware');
    // Check if router uses it globally or on paths
    const usesAuthGlobal = content.includes('router.use(authMiddleware)');
    
    // Exception for public routes/controllers (settings.routes.js system/health and auth.routes.js)
    const isPublicFile = file === 'settings.routes.js' || file === 'auth.routes.js';

    if (!loadsAuth && !isPublicFile) {
      console.warn(`⚠️  WARNING: ${file} does not import authMiddleware!`);
      auditPassed = false;
    } else if (!usesAuthGlobal && !isPublicFile) {
      // If it doesn't use it globally, check if each route has authMiddleware
      const routeDefLines = content.split('\n').filter(l => l.includes('router.get(') || l.includes('router.post(') || l.includes('router.put(') || l.includes('router.delete('));
      const unsecured = routeDefLines.filter(l => !l.includes('authMiddleware') && !l.includes('companyGuard'));
      if (unsecured.length > 0) {
        console.warn(`⚠️  WARNING: ${file} has potentially unprotected route lines:\n`, unsecured.join('\n'));
        auditPassed = false;
      }
    } else {
      console.log(`✅ ${file}: Authenticated & Guarded (or whitelisted).`);
    }
  }

  // 2. Dynamic Database Role & Permission Boundaries Audit
  console.log("\n[DATABASE AUDIT] Auditing role boundaries...");
  try {
    // A. Audit "Inventory Manager" permissions boundary
    const invRole = await db('roles').where({ name: 'Inventory Manager' }).first();
    if (invRole) {
      const perms = await db('role_permissions')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('role_permissions.role_id', invRole.id)
        .select('permissions.code');
      const codes = perms.map(p => p.code);

      const forbiddenForInventory = ['settings.manage', 'journal.post', 'journal.create', 'journal.view', 'ledger.view'];
      const breaches = forbiddenForInventory.filter(c => codes.includes(c));
      
      if (breaches.length > 0) {
        console.error(`❌ ROLE BOUNDARY BREACH: 'Inventory Manager' has forbidden permissions:`, breaches);
        auditPassed = false;
      } else {
        console.log(`✅ 'Inventory Manager' role complies with RBAC boundaries (No GL access).`);
      }
    } else {
      console.log(`ℹ️  'Inventory Manager' role not found in database. Skipping.`);
    }

    // B. Audit "Viewer" role boundary (Should only have read access)
    const viewerRole = await db('roles').where({ name: 'Viewer' }).first();
    if (viewerRole) {
      const perms = await db('role_permissions')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('role_permissions.role_id', viewerRole.id)
        .select('permissions.code');
      const codes = perms.map(p => p.code);

      const writeBreaches = codes.filter(c => c.includes('create') || c.includes('edit') || c.includes('delete') || c.includes('post') || c.includes('manage'));
      if (writeBreaches.length > 0) {
        console.error(`❌ ROLE BOUNDARY BREACH: 'Viewer' has write permissions:`, writeBreaches);
        auditPassed = false;
      } else {
        console.log(`✅ 'Viewer' role complies with read-only RBAC boundaries.`);
      }
    } else {
      console.log(`ℹ️  'Viewer' role not found in database. Skipping.`);
    }

  } catch (err) {
    console.error("❌ Database audit failed:", err.message);
    auditPassed = false;
  }

  console.log("\n=========================================================");
  if (auditPassed) {
    console.log("✅ SECURITY AUDIT PASSED: No security anomalies detected.");
    process.exit(0);
  } else {
    console.warn("❌ SECURITY AUDIT FAILED: Fix identified anomalies.");
    process.exit(1);
  }
}

runSecurityAudit();
