#!/usr/bin/env node

const web3 = require("@solana/web3.js");
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = web3;
const fs = require("fs");
const path = require("path");

// Configuration
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");
const ADMIN_PUBKEY = new PublicKey("2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp");
const CLUSTER = "devnet";

async function main() {
  console.log("🗑️  Closing state account to allow re-initialization...\n");

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

  // Setup connection
  const connection = new Connection(
    `https://api.${CLUSTER}.solana.com`,
    "confirmed"
  );

  // Derive state PDA
  const [statePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  console.log("\n📋 Account Details:");
  console.log("   State PDA:", statePda.toBase58());
  console.log("   Program ID:", PROGRAM_ID.toBase58());
  console.log("   Bump:", bump);
  console.log("");

  // Check if account exists
  console.log("⏳ Checking if account exists...");
  const accountInfo = await connection.getAccountInfo(statePda);
  
  if (!accountInfo) {
    console.log("✅ Account doesn't exist - nothing to close!");
    console.log("   You can proceed with initialization.");
    process.exit(0);
  }

  console.log("   Account exists!");
  console.log("   Owner:", accountInfo.owner.toBase58());
  console.log("   Lamports:", accountInfo.lamports);
  console.log("   Data length:", accountInfo.data.length);
  console.log("");

  // Check if account is owned by our program
  if (!accountInfo.owner.equals(PROGRAM_ID)) {
    console.error("❌ Error: Account is not owned by the program!");
    console.error("   Expected owner:", PROGRAM_ID.toBase58());
    console.error("   Actual owner:", accountInfo.owner.toBase58());
    process.exit(1);
  }

  // To close a PDA account, we need to transfer the rent to the admin
  // Since it's a PDA, we can't directly close it, but we can create a program instruction
  // However, the simplest way is to use solana program close if available
  // Or we can just note that the account needs to be closed via a program instruction
  
  console.log("⚠️  Note: PDA accounts can't be closed directly via CLI.");
  console.log("   The account needs to be closed by the program itself.");
  console.log("");
  console.log("📝 Options:");
  console.log("   1. The account will be overwritten when you re-initialize");
  console.log("   2. Or you can deploy a new program version with a close instruction");
  console.log("   3. Or use a different state PDA seed (not recommended)");
  console.log("");
  console.log("💡 Since the account structure doesn't match, you have two options:");
  console.log("");
  console.log("   Option A: Re-initialize with a different seed (creates new account)");
  console.log("   Option B: The initialize instruction should fail if account exists");
  console.log("");
  console.log("🔧 To proceed, you can:");
  console.log("   1. Try to initialize anyway - it will fail if account exists");
  console.log("   2. Modify the program to use a different state seed");
  console.log("   3. Manually inspect and fix the account data");
  console.log("");
  console.log("📊 Current account info:");
  console.log("   Account:", statePda.toBase58());
  console.log("   Lamports:", accountInfo.lamports, "(rent-exempt)");
  console.log("   Data size:", accountInfo.data.length, "bytes");
  console.log("");
  console.log("   First 50 bytes of data (hex):");
  const hexData = Array.from(accountInfo.data.slice(0, 50))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log("   ", hexData);
  console.log("");
  
  // Try to parse what we can
  try {
    // Discriminator is first 8 bytes
    const discriminator = accountInfo.data.slice(0, 8);
    console.log("   Discriminator (first 8 bytes):", 
      Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Admin should be next 32 bytes (if structure matches)
    if (accountInfo.data.length >= 40) {
      const adminBytes = accountInfo.data.slice(8, 40);
      try {
        const adminPubkey = new PublicKey(adminBytes);
        console.log("   Admin (bytes 8-40):", adminPubkey.toBase58());
      } catch (e) {
        console.log("   Admin field: Could not parse as Pubkey");
      }
    }
    
    // Vec length should be next 4 bytes
    if (accountInfo.data.length >= 44) {
      const vecLength = accountInfo.data.readUInt32LE(40);
      console.log("   Verifiers vec length (bytes 40-44):", vecLength);
      
      if (vecLength > 0 && accountInfo.data.length >= 44 + (vecLength * 32)) {
        console.log("   Verifiers:");
        for (let i = 0; i < Math.min(vecLength, 10); i++) {
          const offset = 44 + (i * 32);
          try {
            const verifier = new PublicKey(accountInfo.data.slice(offset, offset + 32));
            console.log("     -", verifier.toBase58());
          } catch (e) {
            console.log("     - Could not parse verifier", i);
          }
        }
        if (vecLength > 10) {
          console.log(`     ... and ${vecLength - 10} more`);
        }
      }
    }
  } catch (err) {
    console.log("   Could not parse account data:", err.message);
  }
  
  console.log("");
  console.log("💡 Recommendation: Since the account structure doesn't match,");
  console.log("   you'll need to either:");
  console.log("   1. Update the program to match the existing account structure, OR");
  console.log("   2. Create a migration instruction, OR");
  console.log("   3. Use a different state PDA seed for a fresh start");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

