# Supabase Setup Instructions

This document explains how to set up Supabase for storing verifier aliases (off-chain data).

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Project Name**: `authnft` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait for the project to be set up (takes ~2 minutes)

## Step 2: Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste this SQL:

```sql
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

-- Create policy to allow all operations (for now - you can restrict this later)
CREATE POLICY "Allow all operations on verifier_aliases"
  ON verifier_aliases
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 3: Get Your Supabase Credentials

1. In Supabase dashboard, go to **Settings** (gear icon, left sidebar)
2. Click **API** (under Project Settings)
3. You'll see:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (a long string starting with `eyJ...`)

## Step 4: Add Environment Variables

1. In your `web` directory, create a `.env.local` file (if it doesn't exist)
2. Add these lines:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2ODAwMCwiZXhwIjoxOTU0NTQ0MDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

3. **Important**: Restart your Next.js dev server after adding these variables:
   ```bash
   # Stop the server (Ctrl+C) and restart:
   npm run dev
   ```

## Step 5: Install Supabase Client

Run this command in the `web` directory:

```bash
npm install @supabase/supabase-js
```

## Step 6: Verify Setup

1. Start your dev server: `npm run dev`
2. Connect with your admin wallet (`2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp`)
3. You should be redirected to `/admin`
4. Try adding an alias for a verifier address
5. Check in Supabase dashboard → **Table Editor** → `verifier_aliases` to see if the data was saved

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the full `anon/public` key (it's very long)
- Check that `.env.local` has no extra spaces or quotes
- Restart your dev server

### "relation does not exist" error
- Make sure you ran the SQL query in Step 2
- Check that the table name is exactly `verifier_aliases`

### Can't see data in Supabase
- Go to **Table Editor** in Supabase dashboard
- Select `verifier_aliases` table
- Refresh the page

## Security Notes

The current setup allows anyone to read/write aliases. For production:

1. **Restrict RLS policies** to only allow admin operations
2. **Add authentication** (e.g., require wallet signature verification)
3. **Use service role key** for admin operations (never expose this in frontend!)

For now, the MVP setup is fine for development and testing.

