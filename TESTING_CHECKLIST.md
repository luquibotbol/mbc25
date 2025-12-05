# 🧪 AuthNFT Testing Checklist

## ✅ Verification Steps

### 1. **Verify Program Deployment**
```bash
cd onchain
solana program show PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b
```
**Expected:** Program account exists with correct data length and owner

### 2. **Run Anchor Test**
```bash
cd onchain
anchor test --skip-local-validator
```
**Expected:** 
- ✅ State initialization succeeds
- ✅ NFT minting succeeds
- ✅ Token account contains exactly 1 token
- ✅ Transaction signatures printed

### 3. **Test Frontend Integration**

#### A. Install Dependencies
```bash
cd web
npm install
```

#### B. Update Program ID
Make sure `web/src/lib/anchor.ts` has the correct program ID:
```typescript
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");
```

#### C. Start Frontend
```bash
cd web
npm run dev
```

#### D. Test `/verify` Page
1. Connect Phantom wallet (devnet)
2. Fill in form:
   - Product ID: `SKU-1234`
   - Brand: `Nike`
   - Category: `Sneaker`
   - Metadata URI: `https://raw.githubusercontent.com/...` (or any valid JSON URL)
   - Owner Address: (leave empty to mint to yourself)
3. Click "Mint AuthNFT Certificate"
4. **Expected:** 
   - ✅ Transaction succeeds
   - ✅ Success message appears
   - ✅ Solana Explorer link works

#### E. Test `/my-items` Page
1. Navigate to `/my-items`
2. **Expected:**
   - ✅ Your minted NFT appears
   - ✅ Image displays (if metadata has image)
   - ✅ Name and attributes show correctly
   - ✅ Explorer link works

### 4. **Verify in Phantom Wallet**
1. Open Phantom wallet
2. Switch to Devnet
3. **Expected:**
   - ✅ NFT appears in your wallet
   - ✅ Shows correct name and image
   - ✅ Can view details

### 5. **Verify on Solana Explorer**
1. Click transaction link from `/verify` page
2. **Expected:**
   - ✅ Transaction shows as successful
   - ✅ All accounts are correct
   - ✅ Program logs visible

## 🔍 What to Check

### Program State
- [ ] Program deployed successfully
- [ ] Program ID matches in all files
- [ ] IDL generated correctly

### Smart Contract
- [ ] `initialize()` works
- [ ] `mint_auth_nft()` works
- [ ] Verifier check works (only authorized wallet can mint)
- [ ] NFT is 1-of-1 (supply locked)
- [ ] Token account created correctly

### Frontend
- [ ] Wallet connects
- [ ] Form submits successfully
- [ ] Transaction confirms
- [ ] NFTs display in `/my-items`
- [ ] Error handling works

### Integration
- [ ] Frontend can call program
- [ ] Transactions appear on Explorer
- [ ] NFTs visible in Phantom
- [ ] Metadata loads correctly

## 🐛 Common Issues & Fixes

### "Program ID mismatch"
- Check `programs/onchain/src/lib.rs` `declare_id!()`
- Check `web/src/lib/anchor.ts` `PROGRAM_ID`
- Check `Anchor.toml` `[programs.devnet]`
- Rebuild: `anchor build`

### "State not initialized"
- Run `initialize()` first
- Or add initialization flow in frontend

### "Metadata not showing"
- Verify metadata JSON is publicly accessible
- Check JSON format is valid
- Ensure CORS headers allow access

### "Transaction failed"
- Check wallet has enough SOL
- Verify all accounts are correct
- Check browser console for errors

## 📊 Success Criteria

**MVP Complete When:**
- ✅ Program deployed to devnet
- ✅ Can mint NFT from frontend
- ✅ NFT appears in `/my-items`
- ✅ NFT visible in Phantom wallet
- ✅ Transaction visible on Explorer

