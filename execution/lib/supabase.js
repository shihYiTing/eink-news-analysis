const { loadEnv } = require('./env');
loadEnv();

const BASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function configured() {
  return Boolean(BASE_URL && SERVICE_KEY);
}

async function request(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  if (!configured()) {
    throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
  }
  const url = `${BASE_URL}/${pathAndQuery}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${pathAndQuery} failed: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

module.exports = { request, configured };
