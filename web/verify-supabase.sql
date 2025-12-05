-- Run this SQL in your Supabase SQL Editor to create the verifier_aliases table
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- Create table for verifier aliases
CREATE TABLE IF NOT EXISTS verifier_aliases (
  id BIGSERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verifier_aliases_address ON verifier_aliases(address);

-- Enable Row Level Security (RLS)
ALTER TABLE verifier_aliases ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for MVP - you can restrict this later)
CREATE POLICY "Allow all operations on verifier_aliases"
  ON verifier_aliases
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verify the table was created
SELECT * FROM verifier_aliases;

