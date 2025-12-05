import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Onchain } from "../target/types/onchain";
import idl from "../target/idl/auth_nft_program.json";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

// Program ID - Deployed on devnet
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");

// Admin address - only this wallet can add verifiers
const ADMIN_PUBKEY = new PublicKey("2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp");

// Verifier address to add
const VERIFIER_ADDRESS = "B8yQuZiC4Ku6VNuGDLRrUQnVRC4LJFnzGVUC6ArrMk51";

describe("Add Verifier", () => {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load IDL properly
  const programIdl = idl as any;
  const program = new Program(programIdl, PROGRAM_ID, provider) as Program<Onchain>;
  const wallet = provider.wallet as anchor.Wallet;

  it("Adds a verifier to the authorized list", async () => {
    const verifierPubkey = new PublicKey(VERIFIER_ADDRESS);
    const admin = ADMIN_PUBKEY; // Use the hardcoded admin address

    // Derive state PDA
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      PROGRAM_ID
    );

    console.log("Admin:", admin.toBase58());
    console.log("Current wallet:", wallet.publicKey.toBase58());
    console.log("Verifier to add:", verifierPubkey.toBase58());
    console.log("State PDA:", statePda.toBase58());

    // Check if current wallet is the admin
    if (!wallet.publicKey.equals(admin)) {
      console.warn("⚠️  Warning: Current wallet is not the admin!");
      console.warn("   Admin should be:", admin.toBase58());
      console.warn("   Current wallet:", wallet.publicKey.toBase58());
      console.warn("   The transaction will fail if you're not the admin.");
    }

    try {
      // Call add_verifier instruction
      const tx = await program.methods
        .addVerifier(verifierPubkey)
        .accounts({
          state: statePda,
          admin: admin,
        })
        .rpc();

      console.log("✅ Transaction signature:", tx);
      console.log("✅ Verifier added successfully!");
      console.log("   View on Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");

      // Verify the verifier was added by fetching the state
      const state = await program.account.state.fetch(statePda);
      console.log("\n📋 Current state:");
      console.log("   Admin:", state.admin.toBase58());
      console.log("   Verifiers:", state.verifiers.map((v: PublicKey) => v.toBase58()));

      // Check if our verifier is in the list
      const isInList = state.verifiers.some((v: PublicKey) => v.equals(verifierPubkey));
      expect(isInList).to.be.true;
      console.log("\n✅ Verifier confirmed in the list!");
    } catch (error: any) {
      console.error("❌ Error adding verifier:", error);
      if (error.logs) {
        console.error("   Logs:", error.logs);
      }
      throw error;
    }
  });
});

