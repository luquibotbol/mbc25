import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Onchain } from "../target/types/onchain";
import idl from "../target/idl/auth_nft_program.json";

import { PublicKey, SystemProgram, Connection, Keypair } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import { assert } from "chai";

// Metaplex Token Metadata program ID (standard)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Program ID
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");

describe("auth-nft", () => {
  // Use local validator or devnet according to Anchor.toml
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load IDL properly
  const programIdl = idl as any;
  const program = new Program(programIdl, PROGRAM_ID, provider) as Program<Onchain>;
  const wallet = provider.wallet as anchor.Wallet;

  it("initializes state and mints an auth NFT", async () => {
    // 1. Derive State PDA
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      PROGRAM_ID
    );

    // Initialize - admin is hardcoded, but we need to use the admin wallet for this test
    // For testing, we'll use the wallet as the authorized verifier
    // In production, the admin (2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp) would call this
    const adminPubkey = new PublicKey("2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp");
    
    // Note: This test will fail unless run with the admin wallet
    // For testing purposes, you may need to adjust the admin check or use the admin wallet
    const txInit = await program.methods
      .initialize(wallet.publicKey) // Set wallet as authorized verifier
      .accounts({
        state: statePda,
        admin: adminPubkey, // Must be the hardcoded admin
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize tx:", txInit);

    // 2. Prepare mint + ATAs + PDAs

    // Mint account for the NFT
    const mintKeypair = anchor.web3.Keypair.generate();

    // Owner = the same wallet for this test
    const owner = wallet.publicKey;

    // Associated token account for the owner
    const ownerTokenAccount = await splToken.getAssociatedTokenAddress(
      mintKeypair.publicKey,
      owner,
      false,
      splToken.TOKEN_PROGRAM_ID,
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Metadata PDA (Metaplex)
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Master Edition PDA
    const [masterEditionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // 3. Call mint_auth_nft

    const productId = "SKU-1234";
    const brand = "HackathonBrand";
    const category = "Sneaker";
    // For now you can point this to any valid JSON file URL
    const metadataUri =
      "https://raw.githubusercontent.com/your-user/your-repo/main/metadata.json";

    const txMint = await program.methods
      .mintAuthNft(productId, brand, category, metadataUri)
      .accounts({
        state: statePda,
        verifier: wallet.publicKey,
        owner, // recipient
        mint: mintKeypair.publicKey,
        ownerTokenAccount,
        metadata: metadataPda,
        masterEdition: masterEditionPda,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([mintKeypair]) // mint is being created here
      .rpc();

    console.log("Mint tx:", txMint);

    // 4. Assert the owner has exactly 1 token

    const accountInfo = await splToken.getAccount(
      provider.connection,
      ownerTokenAccount
    );

    assert.strictEqual(Number(accountInfo.amount), 1, "Owner ATA should hold 1 NFT");
  });
});
