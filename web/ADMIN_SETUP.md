# Admin Dashboard Setup

## What's Been Created

✅ **Admin Page** (`/admin`) - Full dashboard for managing verifiers
✅ **Supabase Integration** - Off-chain storage for verifier aliases
✅ **Auto-redirect** - Admin wallet automatically redirects to `/admin` page

## Features

1. **View Current Verifier**: See which address currently has minting access
2. **Initialize Program**: Set up the program with the first authorized verifier
3. **Update Verifier**: Change which address has minting access
4. **Manage Aliases**: 
   - Add friendly names for verifier addresses
   - Edit existing aliases
   - Delete aliases
   - All stored off-chain in Supabase

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

This will install `@supabase/supabase-js` which was added to `package.json`.

### 2. Set Up Supabase

Follow the instructions in `SUPABASE_SETUP.md` to:
- Create a Supabase project
- Create the database table
- Get your API credentials
- Add them to `.env.local`

### 3. Create `.env.local`

In the `web` directory, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Start the Dev Server

```bash
npm run dev
```

### 5. Access Admin Dashboard

1. Connect with your admin wallet: `2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp`
2. You'll be automatically redirected to `/admin`
3. If not admin, you'll see "Access Denied"

## What I Need From You

To complete the setup, I need:

1. **Supabase Project URL** - After creating your Supabase project
2. **Supabase Anon Key** - The public/anonymous key from Supabase settings
3. **Confirmation** - That you've run the SQL query to create the `verifier_aliases` table

Once you provide these, I can help you:
- Add them to `.env.local`
- Test the admin dashboard
- Verify everything works

## How It Works

1. **On-Chain (Solana)**:
   - Program state stores the authorized verifier address
   - Only admin can update this via `update_verifier()` instruction

2. **Off-Chain (Supabase)**:
   - Aliases are stored in `verifier_aliases` table
   - Format: `{ address: string, alias: string }`
   - Can be updated without blockchain transactions

3. **Admin Dashboard**:
   - Shows current verifier from on-chain state
   - Allows admin to update verifier (on-chain transaction)
   - Allows admin to manage aliases (off-chain, instant)

## Testing

1. Connect with admin wallet → Should redirect to `/admin`
2. Initialize program with a test verifier address
3. Add an alias for that verifier
4. Update verifier to a different address
5. Check Supabase dashboard to see aliases stored

## Next Steps

After Supabase is set up:
- Test the full flow
- Deploy to production
- Add more features (e.g., multiple verifiers, permissions, etc.)

