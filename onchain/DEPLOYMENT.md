# NFT Minting Program - Deployment Guide

## Current Status

The Anchor program has been updated with NFT minting logic:
- ✅ Token minting (1-of-1 NFT)
- ✅ Account validation for metadata and master edition PDAs
- ⚠️ Metadata creation via Metaplex should be done client-side due to dependency conflicts

## Build Issues

There are currently compilation errors related to Anchor macro expansion with `anchor-spl` account types. The program structure is correct but needs version alignment.

## Steps to Deploy

### 1. Fix Build Issues

The program needs to compile successfully. Current errors are related to:
- Account constraint macro expansion
- Version compatibility between `anchor-lang` 0.31.1 and `anchor-spl` 0.29.0

**Potential fixes:**
- Update `anchor-spl` to a compatible version
- Or adjust account constraints to use `AccountInfo` instead of typed accounts

### 2. Build the Program

```bash
cd onchain
anchor build
```

### 3. Deploy to Devnet

```bash
# Set cluster to devnet
solana config set --url devnet

# Airdrop SOL (if needed)
solana airdrop 2

# Deploy
anchor deploy

# Save the program ID from the output
```

### 4. Update Program ID

After deployment, update the program ID in:
- `programs/onchain/src/lib.rs` - `declare_id!()` macro
- `Anchor.toml` - `[programs.devnet]` section

### 5. Create Metadata JSON

1. Use the template in `metadata-template.json`
2. Update with your product information
3. Host on GitHub (raw link) or IPFS
4. Use the URL in the `mint_auth_nft` call

### 6. Client-Side Metadata Creation

Since the program validates PDAs but doesn't create metadata (due to dependency issues), you'll need to create metadata client-side using `@metaplex-foundation/mpl-token-metadata`:

```typescript
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';

// Create metadata instruction
const metadataInstruction = createCreateMetadataAccountV3Instruction(
  {
    metadata: metadataPda,
    mint: mintKeypair.publicKey,
    mintAuthority: verifierKeypair.publicKey,
    payer: verifierKeypair.publicKey,
    updateAuthority: {
      address: verifierKeypair.publicKey,
      isSigner: true,
    },
  },
  {
    createMetadataAccountArgsV3: {
      data: {
        name: `${brand} - ${productId}`,
        symbol: 'AUTHNFT',
        uri: metadataUri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
    },
  }
);
```

### 7. Testing

Run the test suite:
```bash
anchor test
```

Or test on devnet:
```bash
anchor test --provider.cluster devnet
```

## Notes

- The program mints the token and validates all PDAs
- Metadata creation should be done in a separate transaction or combined with the mint transaction
- The verifier must sign both the program instruction and the metadata creation instruction

