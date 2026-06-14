import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  companies: [],
  activeCompany: null,
  permissions: [],
  companyRole: null,
  settings: {},
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  error: null,
  isLoading: false,

  setUser: (user, token) => {
    if (token) localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, error: null });
  },

  fetchPermissions: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ 
        permissions: response.data.permissions || [], 
        companyRole: response.data.companyRole || null 
      });
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    }
  },

  fetchSettings: async (companyId) => {
    if (!companyId) return;
    try {
      const response = await api.get(`/settings/${companyId}`);
      set({ settings: response.data || {} });
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  },

  setSettings: (settings) => set({ settings }),

  setActiveCompany: (company) => {
    if (company) {
      localStorage.setItem('activeCompanyId', company.id);
    } else {
      localStorage.removeItem('activeCompanyId');
    }
    set({ activeCompany: company });
    
    // Fetch permissions and settings for the newly active company
    if (company) {
      setTimeout(() => {
        useAuthStore.getState().fetchPermissions();
        useAuthStore.getState().fetchSettings(company.id);
      }, 0);
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const response = await api.post('/auth/login', { email: normalizedEmail, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      
      // Initially, we don't have companies, we fetch them next
      set({ user, token, isAuthenticated: true, isLoading: false });
      
      // Auto-fetch companies after login
      await useAuthStore.getState().fetchUserCompanies();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (name, email, password, role) => {
    set({ isLoading: true, error: null });
    try {
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const response = await api.post('/auth/register', { name, email: normalizedEmail, password, role });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      
      // Auto-fetch companies after registration
      await useAuthStore.getState().fetchUserCompanies();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeCompanyId');
    set({ user: null, token: null, isAuthenticated: false, activeCompany: null, companies: [] });
  },

  fetchUserCompanies: async () => {
    try {
      const response = await api.get('/companies');
      const companies = response.data;
      set({ companies });
      
      // Auto-select first company if none selected or if previously selected company is in the list
      const savedId = localStorage.getItem('activeCompanyId');
      if (companies.length > 0) {
        const found = companies.find(c => c.id.toString() === savedId);
        if (found) {
          useAuthStore.getState().setActiveCompany(found);
        } else {
          useAuthStore.getState().setActiveCompany(companies[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch companies', err);
    }
  },

  fetchCurrentUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    set({ isLoading: true });
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
      
      // After getting user, get their companies
      useAuthStore.getState().fetchUserCompanies();
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('activeCompanyId');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, activeCompany: null, companies: [] });
    }
  }
}));

export default useAuthStore;
