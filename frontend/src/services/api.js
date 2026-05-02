import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach the token and company ID if they exist in localStorage
api.interceptors.request.use(
  (config) => {
    const path = String(config.url ?? '');
    const isPublicAuth =
      path.includes('/auth/login') || path.includes('/auth/register');
    const isCompaniesList = path.endsWith('/companies') || path.includes('/companies?');

    // Never send session headers on login/register — avoids stale JWT / company
    // context interfering with public auth endpoints.
    if (isPublicAuth) {
      delete config.headers.Authorization;
      delete config.headers['x-company-id'];
      return config;
    }

    const token = localStorage.getItem('token');
    const activeCompanyId = localStorage.getItem('activeCompanyId');

    if (token && token !== 'undefined' && token !== 'null') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Attempt to extract company ID from the URL if it's an ERP route
    // e.g. /warehouses/2 or /products/2
    const urlParts = path.split('/');
    let urlCompanyId = null;

    // ERP routes usually follow patterns like /warehouses/:companyId
    // We check if any part of the path is a number and follows a known resource name
    const erpResources = ['warehouses', 'products', 'stock', 'inventory', 'sectors', 'clients', 'deliveries', 'distribution'];
    erpResources.forEach(resource => {
      const idx = urlParts.indexOf(resource);
      if (idx !== -1 && urlParts[idx + 1]) {
        const potentialId = parseInt(urlParts[idx + 1]);
        if (!isNaN(potentialId)) {
          urlCompanyId = potentialId.toString();
        }
      }
    });

    const finalCompanyId = String(urlCompanyId || activeCompanyId || '').trim();

    // Only attach x-company-id if we are NOT fetching the companies list itself,
    // and if we have a valid-looking company ID.
    if (!isCompaniesList && finalCompanyId && finalCompanyId !== 'undefined' && finalCompanyId !== 'null' && finalCompanyId !== '') {
      config.headers['x-company-id'] = finalCompanyId;
    } else {
      delete config.headers['x-company-id'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
