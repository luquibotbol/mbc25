# 🚀 AuthNFT Quick Start Guide

## ✅ What's Been Completed

1. **Anchor Program** - Fully functional NFT minting program
2. **Frontend Pages** - `/verify` and `/my-items` pages created
3. **Anchor Client Integration** - Helper functions for program interaction
4. **Navigation** - Home page with links to all pages

## 🎯 Immediate Next Steps

### 1. Install Frontend Dependencies

```bash
cd web
npm install
# or
yarn install
```

This will install:
- `@metaplex-foundation/js` - For fetching NFTs
- `@solana/spl-token` - For token operations

### 2. Deploy Program to Devnet

```bash
cd ../onchain

# Switch to devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Build and deploy
anchor build
anchor deploy
```

**Important:** After deployment, you'll get a new program ID. Update:
- `programs/onchain/src/lib.rs` - `declare_id!("NEW_PROGRAM_ID")`
- `web/src/lib/anchor.ts` - `PROGRAM_ID` constant
- `Anchor.toml` - Add `[programs.devnet]` section with new ID

Then rebuild:
```bash
anchor build
```

### 3. Initialize Program State

Before minting, you need to initialize the program state:

```bash
cd onchain
anchor test --skip-local-validator
```

Or create a simple script to call `initialize()` with your verifier wallet.

### 4. Update Frontend Configuration

1. **Update Program ID** in `web/src/lib/anchor.ts`
2. **Update Connection** - Make sure `WalletProvider` uses devnet:
   ```typescript
   // In WalletProvider.tsx
   const network = WalletAdapterNetwork.Devnet;
   ```

### 5. Create Sample Metadata

Create a JSON file (e.g., `metadata.json`):
```json
{
  "name": "Nike Air Jordan 1 - SKU-1234",
  "symbol": "AUTHNFT",
  "description": "Authenticated Nike Air Jordan 1 sneaker",
  "image": "https://example.com/shoe-image.png",
  "attributes": [
    { "trait_type": "Brand", "value": "Nike" },
    { "trait_type": "Product ID", "value": "SKU-1234" },
    { "trait_type": "Category", "value": "Sneaker" }
  ]
}
```

Host it on:
- GitHub (raw link)
- IPFS (via Pinata or similar)
- Any public URL

### 6. Test the Flow

1. **Start Frontend:**
   ```bash
   cd web
   npm run dev
   ```

2. **Connect Wallet** (Phantom on devnet)

3. **Go to `/verify`** and mint an NFT:
   - Fill in product details
   - Use your metadata URL
   - Click "Mint AuthNFT Certificate"

4. **Check `/my-items`** to see your NFT

5. **Verify in Phantom** - The NFT should appear in your wallet

## 🐛 Common Issues

### "Program ID mismatch"
- Make sure program ID in `lib.rs` matches `anchor.ts`
- Rebuild after changing program ID: `anchor build`

### "State not initialized"
- Call `initialize()` first before minting
- The verifier is set during initialization

### "Metadata not showing"
- Make sure metadata JSON is publicly accessible
- Check CORS headers if hosting yourself
- Verify JSON format is valid

### "Transaction failed"
- Check you have enough SOL for fees
- Verify all accounts are correct
- Check browser console for detailed errors

## 📝 Notes

- **Metadata Creation**: The program validates PDAs but doesn't create metadata. You'll need to create metadata client-side using Metaplex SDK (this is a TODO in the verify page).

- **State Management**: The state PDA needs to be initialized before minting. Consider adding an initialization flow in the frontend.

- **Error Handling**: Add better error messages and loading states as needed.

## 🎨 Next Enhancements

- [ ] Add metadata creation in verify page
- [ ] Add state initialization flow
- [ ] Improve error handling
- [ ] Add transaction history
- [ ] Polish UI/UX
- [ ] Add NFT transfer functionality

