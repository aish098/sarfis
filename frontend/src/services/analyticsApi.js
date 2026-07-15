/**
 * analyticsApi.js
 * ACCOUNTELLENCE Frontend — Analytics API Service
 * Place in: src/services/analyticsApi.js
 */

import api from "./api";
import axios from "axios";

const rawBase = String(api.defaults.baseURL || "").replace(/\/+$/, "");
const altBase = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : `${rawBase}/api`;
const fallbackApi = axios.create({
  baseURL: altBase,
  headers: { "Content-Type": "application/json" },
});

function copySessionHeaders() {
  const token = localStorage.getItem("token");
  const companyId = localStorage.getItem("activeCompanyId");
  const headers = {};
  if (token && token !== "undefined" && token !== "null") {
    headers.Authorization = `Bearer ${token}`;
  }
  if (companyId && companyId !== "undefined" && companyId !== "null") {
    headers["x-company-id"] = companyId;
  }
  return headers;
}

async function withPathFallback(primaryCall, fallbackCall) {
  try {
    return await primaryCall();
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
    return fallbackCall();
  }
}

function extractData(res) {
  const payload = res?.data;
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.message || "API error");
    }
    return payload.data;
  }
  return payload;
}

export const analyticsApi = {
  getTrends: (companyId, months = 12) =>
    withPathFallback(
      () => api.get(`/analytics/trends/${companyId}?months=${months}`).then(extractData),
      () => fallbackApi.get(`/analytics/trends/${companyId}?months=${months}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  getComparative: (companyId, p1, p2) =>
    withPathFallback(
      () => api.get(`/analytics/comparative/${companyId}?p1month=${p1.month}&p1year=${p1.year}&p2month=${p2.month}&p2year=${p2.year}`).then(extractData),
      () => fallbackApi.get(`/analytics/comparative/${companyId}?p1month=${p1.month}&p1year=${p1.year}&p2month=${p2.month}&p2year=${p2.year}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  getVertical: (companyId, month, year) =>
    withPathFallback(
      () => api.get(`/analytics/vertical/${companyId}?month=${month}&year=${year}`).then(extractData),
      () => fallbackApi.get(`/analytics/vertical/${companyId}?month=${month}&year=${year}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  getSectorGrowth: (companyId, months = 6) =>
    withPathFallback(
      () => api.get(`/analytics/sector-growth/${companyId}?months=${months}`).then(extractData),
      () => fallbackApi.get(`/analytics/sector-growth/${companyId}?months=${months}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  getOperationalInsights: (companyId) =>
    withPathFallback(
      () => api.get(`/analytics/operational-insights/${companyId}`).then(extractData),
      () => fallbackApi.get(`/analytics/operational-insights/${companyId}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  // Budget
  createBudget: (companyId, data) =>
    withPathFallback(
      () => api.post(`/analytics/budgets/${companyId}`, data).then(extractData),
      () => fallbackApi.post(`/analytics/budgets/${companyId}`, data, { headers: copySessionHeaders() }).then(extractData)
    ),

  getBudgets: (companyId, year, month = null) =>
    withPathFallback(
      () => api.get(`/analytics/budgets/${companyId}?year=${year}${month ? `&month=${month}` : ""}`).then(extractData),
      () => fallbackApi.get(`/analytics/budgets/${companyId}?year=${year}${month ? `&month=${month}` : ""}`, { headers: copySessionHeaders() }).then(extractData)
    ),

  deleteBudget: (companyId, budgetId) =>
    withPathFallback(
      () => api.delete(`/analytics/budgets/${companyId}/${budgetId}`).then(() => true),
      () => fallbackApi.delete(`/analytics/budgets/${companyId}/${budgetId}`, { headers: copySessionHeaders() }).then(() => true)
    ),

  getBudgetVsActual: (companyId, year = null, month = null, mode = "all") => {
    const params = new URLSearchParams();
    if (year) params.append("year", year);
    if (month) params.append("month", month);
    if (mode) params.append("mode", mode);
    const qs = params.toString();
    return withPathFallback(
      () => api.get(`/analytics/budget-vs-actual/${companyId}?${qs}`).then(extractData),
      () => fallbackApi.get(`/analytics/budget-vs-actual/${companyId}?${qs}`, { headers: copySessionHeaders() }).then(extractData)
    );
  },
};
