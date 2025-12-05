# Supabase Storage Setup for NFT Images and Metadata

This guide will help you set up Supabase Storage to automatically handle image uploads and metadata generation.

## Step 1: Create Storage Bucket

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/lguhhbsmmttcxnjsmgxc
2. Click **Storage** in the left sidebar
3. Click **New bucket**
4. Fill in:
   - **Name**: `nft-assets`
   - **Public bucket**: ✅ **Enable this** (so images are publicly accessible)
5. Click **Create bucket**

## Step 2: Set Up Storage Policies

1. In the Storage section, click on the `nft-assets` bucket
2. Click **Policies** tab
3. Click **New Policy**
4. Select **For full customization**, then click **Use this template**
5. Name it: `Allow public read access`
6. Paste this SQL:

```sql
-- Allow anyone to read files
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'nft-assets');
```

7. Click **Review** then **Save policy**

8. Create another policy for uploads:
   - Click **New Policy** again
   - Name: `Allow authenticated uploads`
   - Paste this SQL:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'nft-assets' AND
  auth.role() = 'authenticated'
);
```

9. **OR** for MVP/testing, allow all uploads:

```sql
-- Allow all uploads (for MVP/testing)
CREATE POLICY "Allow all uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nft-assets');
```

10. Click **Review** then **Save policy**

## Step 3: Create Metadata Table (Optional - for tracking)

1. Go to **SQL Editor** in Supabase
2. Click **New Query**
3. Paste this SQL:

```sql
-- Create table to track NFT metadata
CREATE TABLE IF NOT EXISTS nft_metadata (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata_uri TEXT NOT NULL,
  image_url TEXT NOT NULL,
  verifier_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_nft_metadata_product_id ON nft_metadata(product_id);
CREATE INDEX IF NOT EXISTS idx_nft_metadata_verifier ON nft_metadata(verifier_address);

-- Enable RLS
ALTER TABLE nft_metadata ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for MVP)
CREATE POLICY "Allow all operations on nft_metadata"
  ON nft_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

4. Click **Run**

## Step 4: Verify Setup

1. Go to **Storage** → `nft-assets` bucket
2. You should see it's empty (or has folders if you've uploaded before)
3. The bucket should show as **Public**

## How It Works

1. **User uploads image** → Stored in `nft-assets/nft-images/`
2. **Metadata JSON generated** → Stored in `nft-assets/metadata/`
3. **Public URLs returned** → Used in NFT minting
4. **Reference saved** → In `nft_metadata` table for easy lookup

## Folder Structure in Storage

```
nft-assets/
├── nft-images/
│   ├── 1234567890_abc123.png
│   └── 1234567891_def456.jpg
└── metadata/
    ├── metadata_1234567890_abc123.json
    └── metadata_1234567891_def456.json
```

## Testing

1. Go to `/verify` page
2. Fill in product details
3. Upload an image
4. Click "Upload Image & Generate Metadata"
5. You should see:
   - Image preview
   - Metadata URI generated
   - Success message

6. Check Supabase Storage:
   - Go to Storage → `nft-assets`
   - You should see your uploaded image and metadata JSON

## Troubleshooting

### "Bucket not found" error
- Make sure the bucket name is exactly `nft-assets`
- Check that the bucket exists in Storage section

### "Permission denied" error
- Check that storage policies are set up correctly
- For testing, use the "Allow all uploads" policy

### Images not showing
- Make sure the bucket is set to **Public**
- Check that the public URL is correct
- Verify the file was uploaded successfully

### Metadata not generating
- Check browser console for errors
- Verify Supabase credentials in `.env.local`
- Make sure the `nft_metadata` table exists

## Security Notes

For production:
1. **Restrict uploads** to authenticated users only
2. **Add file size limits** (e.g., max 5MB)
3. **Validate file types** (only images)
4. **Add rate limiting** to prevent abuse
5. **Use signed URLs** instead of public URLs for sensitive content

For now, the MVP setup allows public uploads for easy testing.

