
import { createClient } from '@supabase/supabase-js';

// Helper function to get env safely in browser
const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  // @ts-ignore - check for injected global if process.env fails
  return window.process?.env?.[key] || '';
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === 'https://your-project.supabase.co') {
  console.warn("Supabase configuration is missing. Please check your environment variables.");
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);
