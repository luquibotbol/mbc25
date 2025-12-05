# 🚀 AuthNFT - Next Steps Roadmap

## ✅ Completed
- [x] Anchor program compiles successfully
- [x] NFT minting logic implemented
- [x] Basic frontend structure with wallet connection
- [x] Metadata template created

## 🎯 Immediate Next Steps (Priority Order)

### 1. **Deploy Program to Devnet** ⚡
```bash
cd onchain
solana config set --url devnet
solana airdrop 2  # Get devnet SOL
anchor build
anchor deploy
```
**After deployment:**
- Update `programs/onchain/src/lib.rs` with new program ID
- Update `Anchor.toml` with devnet program ID
- Rebuild: `anchor build`

### 2. **Create Frontend Pages** 🎨

#### `/verify` Page (Verifier Dashboard)
- Form with fields: Product ID, Brand, Category, Metadata URL
- Wallet connection check
- Verify wallet is the authorized verifier
- Call `mint_auth_nft` instruction
- Show transaction status and Solana Explorer link

#### `/my-items` Page (Customer View)
- Display all AuthNFTs owned by connected wallet
- Fetch NFTs using Solana RPC + Metaplex
- Show metadata (image, name, attributes)
- Display transaction history

### 3. **Set Up Anchor Client Integration** 🔌
- Create `lib/anchor.ts` with program connection
- Load IDL from `onchain/target/idl/onchain.json`
- Create helper functions for minting
- Handle transaction signing and confirmation

### 4. **Add Navigation** 🧭
- Update main page with links to `/verify` and `/my-items`
- Add navigation component
- Show current page in header

### 5. **Create Sample Metadata** 📄
- Create 2-3 sample metadata JSON files
- Host on GitHub (raw links) or use IPFS
- Test with real metadata URLs

### 6. **End-to-End Testing** 🧪
- Test minting flow from frontend
- Verify NFT appears in Phantom wallet
- Test `/my-items` page displays NFTs correctly
- Verify transaction links work

## 📋 Detailed Implementation Checklist

### Frontend Structure
```
web/src/
├── app/
│   ├── page.tsx (home/landing)
│   ├── verify/
│   │   └── page.tsx (verifier mint form)
│   └── my-items/
│       └── page.tsx (NFT gallery)
├── lib/
│   ├── anchor.ts (program client)
│   └── utils.ts (helper functions)
└── components/
    └── Navigation.tsx
```

### Required Dependencies
- `@metaplex-foundation/mpl-token-metadata` (for metadata creation)
- `@solana/spl-token` (already have)
- `@coral-xyz/anchor` (already have)

## 🎯 MVP Completion Criteria

**Must Have:**
- [ ] Program deployed to devnet
- [ ] `/verify` page functional
- [ ] `/my-items` page displays NFTs
- [ ] Successful mint from frontend
- [ ] NFT visible in Phantom wallet

**Nice to Have:**
- [ ] Polished UI/UX
- [ ] Error handling and loading states
- [ ] Transaction history
- [ ] NFT transfer functionality
- [ ] Landing page with project description

## 🚨 Critical Notes

1. **Metadata Creation**: The program validates PDAs but doesn't create metadata. You'll need to create metadata client-side using Metaplex SDK before calling `mint_auth_nft`.

2. **Verifier Setup**: The verifier public key is set during `initialize()`. Make sure to initialize the program state first.

3. **Devnet vs Localnet**: Currently configured for localnet. Switch to devnet for hackathon demo.

