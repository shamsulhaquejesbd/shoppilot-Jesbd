/**
 * Supabase Client Configuration & Connection Manager
 * shoPPilot Inventory Management System
 */
import { createClient } from '@supabase/supabase-js';

// Default / fallback configuration or user-provided keys from localStorage / env
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);
const envKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);
const DEFAULT_URL = envUrl || 'https://tkrttsmspgvcryfjejej.supabase.co';
const DEFAULT_KEY = envKey || 'sb_publishable_vW3njY0ETCekPpP2yKsAlw_2DnJV3pC';

export function getSupabaseCredentials() {
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('SP_SUPABASE_URL') : null;
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('SP_SUPABASE_ANON_KEY') : null;
  const url = localUrl || DEFAULT_URL;
  const key = localKey || DEFAULT_KEY;
  const isConfigured = Boolean(url && key && !url.includes('xyzcompany.supabase.co'));
  return { url: url || DEFAULT_URL, key: key || DEFAULT_KEY, isConfigured };
}

export function saveSupabaseCredentials(url, key) {
  if (url) localStorage.setItem('SP_SUPABASE_URL', url.trim());
  if (key) localStorage.setItem('SP_SUPABASE_ANON_KEY', key.trim());
  window.location.reload();
}

let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const { url, key } = getSupabaseCredentials();
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (e) {
      console.warn("Could not initialize Supabase client:", e.message);
    }
  }
  return supabaseInstance;
}

export const supabase = getSupabase();
