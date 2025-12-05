// Supabase client for managing verifier aliases (off-chain)
// This file will be populated once you provide Supabase credentials

import { createClient } from '@supabase/supabase-js';

// These will be set via environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for verifier aliases
export interface VerifierAlias {
  id?: number;
  address: string;
  alias: string;
  created_at?: string;
  updated_at?: string;
}

// Get alias for an address
export async function getAlias(address: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('verifier_aliases')
    .select('alias')
    .eq('address', address)
    .single();
  
  if (error || !data) return null;
  return data.alias;
}

// Set alias for an address
export async function setAlias(address: string, alias: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_aliases')
    .upsert(
      { address, alias, updated_at: new Date().toISOString() },
      { onConflict: 'address' }
    );
  
  return !error;
}

// Get all verifiers with aliases
export async function getAllVerifiers(): Promise<VerifierAlias[]> {
  const { data, error } = await supabase
    .from('verifier_aliases')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) return [];
  return data;
}

// Delete alias
export async function deleteAlias(address: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_aliases')
    .delete()
    .eq('address', address);
  
  return !error;
}

