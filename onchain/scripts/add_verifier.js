#!/usr/bin/env node

const anchor = require("@coral-xyz/anchor");
const web3 = require("@solana/web3.js");
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction } = web3;
const fs = require("fs");
const path = require("path");

// Configuration
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");
const ADMIN_PUBKEY = new PublicKey("2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp");
const VERIFIER_ADDRESS = "B8yQuZiC4Ku6VNuGDLRrUQnVRC4LJFnzGVUC6ArrMk51";
const CLUSTER = "devnet";

async function main() {
  console.log("🔧 Adding verifier to the program...\n");

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

  // Create program - use the IDL as-is (Anchor will handle it)
  // Create program with a workaround for account structure
  // We'll use the instruction builder directly
  const programIdl = idl;
  
  // Derive state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  const verifierPubkey = new PublicKey(VERIFIER_ADDRESS);

  console.log("\n📋 Transaction Details:");
  console.log("   Program ID:", PROGRAM_ID.toBase58());
  console.log("   State PDA:", statePda.toBase58());
  console.log("   Verifier to add:", verifierPubkey.toBase58());
  console.log("   Admin:", walletKeypair.publicKey.toBase58());
  console.log("");

  try {
    // Create program without account client (workaround)
    // Find the add_verifier instruction
    const addVerifierIx = programIdl.instructions.find(
      (ix) => ix.name === "add_verifier"
    );
    
    if (!addVerifierIx) {
      throw new Error("add_verifier instruction not found in IDL");
    }

    // Build instruction data manually
    const discriminator = Buffer.from(addVerifierIx.discriminator);
    const verifierBuffer = verifierPubkey.toBuffer();
    const instructionData = Buffer.concat([discriminator, verifierBuffer]);

    // Create transaction
    const transaction = new Transaction();
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletKeypair.publicKey;

    // Add instruction
    transaction.add(
      new TransactionInstruction({
        keys: [
          {
            pubkey: statePda,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: walletKeypair.publicKey,
            isSigner: true,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      })
    );

    console.log("⏳ Sending transaction...");
    const tx = await connection.sendTransaction(transaction, [walletKeypair], {
      skipPreflight: false,
    });
    
    // Wait for confirmation
    await connection.confirmTransaction(tx, "confirmed");

    console.log("✅ Success! Transaction signature:", tx);
    console.log("   View on Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");

    // Verify the verifier was added by checking the account
    console.log("\n⏳ Verifying verifier was added...");
    try {
      // Try to fetch state account and parse manually
      const stateAccount = await connection.getAccountInfo(statePda);
      if (stateAccount) {
        // Parse the state account manually
        // Structure: discriminator (8) + admin (32) + verifiers vec (4 + 32*n)
        const data = stateAccount.data;
        const adminPubkey = new PublicKey(data.slice(8, 40));
        const verifiersLength = data.readUInt32LE(40);
        const verifiers = [];
        for (let i = 0; i < verifiersLength; i++) {
          const offset = 44 + (i * 32);
          verifiers.push(new PublicKey(data.slice(offset, offset + 32)));
        }
        
        console.log("\n📋 Current State:");
        console.log("   Admin:", adminPubkey.toBase58());
        console.log("   Verifiers:", verifiers.map(v => v.toBase58()));

        const isInList = verifiers.some(v => v.equals(verifierPubkey));
        if (isInList) {
          console.log("\n✅ Verifier confirmed in the list!");
        } else {
          console.log("\n⚠️  Warning: Verifier not found in list (transaction may have failed)");
        }
      } else {
        console.log("\n⚠️  Could not fetch state account to verify");
      }
    } catch (err) {
      console.log("\n⚠️  Could not verify (but transaction succeeded):", err.message);
    }
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

