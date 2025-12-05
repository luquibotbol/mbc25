#!/usr/bin/env node

const anchor = require("@coral-xyz/anchor");
const web3 = require("@solana/web3.js");
const { Connection, PublicKey, Keypair, Transaction } = web3;
const fs = require("fs");
const path = require("path");

// Configuration
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");
const ADMIN_PUBKEY = new PublicKey("2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp");
const CLUSTER = "devnet";

async function main() {
  console.log("🗑️  Closing state account...\n");

  // Load wallet from Solana CLI default location
  const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}. Please set up your Solana CLI wallet.`);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("Wallet:", walletKeypair.publicKey.toBase58());
  console.log("Admin required:", ADMIN_PUBKEY.toBase58());
  
  if (!walletKeypair.publicKey.equals(ADMIN_PUBKEY)) {
    console.error("❌ Error: Your wallet is not the admin wallet!");
    console.error("   Your wallet:", walletKeypair.publicKey.toBase58());
    console.error("   Admin wallet:", ADMIN_PUBKEY.toBase58());
    process.exit(1);
  }

  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/auth_nft_program.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Please run 'anchor build' first.`);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Setup connection and provider
  const connection = new Connection(
    `https://api.${CLUSTER}.solana.com`,
    "confirmed"
  );

  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx) => {
      tx.sign(walletKeypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.sign(walletKeypair);
        return tx;
      });
    },
  };

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Derive state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("\n📋 Account Details:");
  console.log("   State PDA:", statePda.toBase58());
  console.log("   Program ID:", PROGRAM_ID.toBase58());
  console.log("");

  // Check if account exists
  const accountInfo = await connection.getAccountInfo(statePda);
  if (!accountInfo) {
    console.log("✅ Account doesn't exist - nothing to close!");
    process.exit(0);
  }

  console.log("   Account exists with", accountInfo.lamports, "lamports");
  console.log("");

  // Find close_state instruction
  const closeStateIx = idl.instructions?.find(
    (ix) => ix.name === "close_state" || ix.name === "closeState"
  );

  if (!closeStateIx) {
    console.error("❌ Error: close_state instruction not found in IDL!");
    console.error("   Please make sure you've built the program with the close_state function.");
    console.error("   Run: anchor build");
    process.exit(1);
  }

  try {
    // Manually construct the instruction to avoid IDL account structure issues
    const discriminator = Buffer.from(closeStateIx.discriminator);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletKeypair.publicKey;

    // Add close_state instruction
    transaction.add(
      new web3.TransactionInstruction({
        keys: [
          {
            pubkey: statePda,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: walletKeypair.publicKey,
            isSigner: true,
            isWritable: true, // Admin receives the rent
          },
        ],
        programId: PROGRAM_ID,
        data: discriminator,
      })
    );

    console.log("⏳ Closing state account...");
    const tx = await connection.sendTransaction(transaction, [walletKeypair], {
      skipPreflight: false,
    });
    
    // Wait for confirmation
    await connection.confirmTransaction(tx, "confirmed");

    console.log("✅ Success! State account closed.");
    console.log("   Transaction signature:", tx);
    console.log("   View on Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
    console.log("");
    console.log("💡 You can now re-initialize the program with:");
    console.log("   node scripts/initialize.js <verifier_address>");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("   Logs:", error.logs);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

