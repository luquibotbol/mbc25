"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAnchorProgram, getStatePda, ADMIN_PUBKEY, PROGRAM_ID } from "@/lib/anchor";
import { getAlias, setAlias, getAllVerifiers, deleteAlias, VerifierAlias } from "@/lib/supabase";

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function AdminPage() {
  const { publicKey, signTransaction, signAllTransactions, connect, connected, connecting, disconnect, wallet } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State management
  const [verifiers, setVerifiers] = useState<string[]>([]);
  const [admin, setAdmin] = useState<string | null>(null);
  const [newVerifierAddress, setNewVerifierAddress] = useState("");
  const [aliases, setAliases] = useState<VerifierAlias[]>([]);
  const [editingAlias, setEditingAlias] = useState<{ address: string; alias: string } | null>(null);
  const [newAlias, setNewAlias] = useState("");

  // Debug wallet state on mount and changes
  useEffect(() => {
    console.log("[DEBUG] Wallet state changed:", {
      connected,
      connecting,
      publicKey: publicKey?.toBase58(),
      hasSignTransaction: !!signTransaction,
      hasSignAllTransactions: !!signAllTransactions,
      walletName: wallet?.adapter?.name,
      walletReadyState: wallet?.adapter?.readyState,
      walletPublicKey: wallet?.adapter?.publicKey?.toBase58(),
      connectionEndpoint: connection?.rpcEndpoint,
    });
  }, [connected, connecting, publicKey, signTransaction, signAllTransactions, wallet, connection]);

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (publicKey && !publicKey.equals(ADMIN_PUBKEY)) {
      router.push("/");
    }
  }, [publicKey, router]);

  // Load current verifier and aliases
  useEffect(() => {
    if (publicKey && publicKey.equals(ADMIN_PUBKEY)) {
      loadState();
      loadAliases();
    }
  }, [publicKey, connection]);

  const loadState = async () => {
    if (!connection) return;
    
    try {
      const statePda = getStatePda();
      
      // Try with timeout to avoid hanging
      const getAccountInfoWithTimeout = async () => {
        const getAccountInfoPromise = connection.getAccountInfo(statePda);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 8000)
        );
        return await Promise.race([getAccountInfoPromise, timeoutPromise]);
      };
      
      const stateAccount = await getAccountInfoWithTimeout() as any;
      
      if (stateAccount) {
        const program = getAnchorProgram(connection, {
          publicKey: publicKey!,
          signTransaction: signTransaction!,
          signAllTransactions: signAllTransactions,
        } as any);
        
        // Fetch state account - Anchor converts "State" to "state" in camelCase
        const stateData = await (program.account as any).state.fetch(statePda);
        
        // Get admin and verifiers list
        if (stateData?.admin) {
          setAdmin(stateData.admin.toBase58());
        }
        
        if (stateData?.verifiers && Array.isArray(stateData.verifiers)) {
          const verifierAddresses = stateData.verifiers.map((v: any) => 
            typeof v === 'string' ? v : v.toBase58()
          );
          setVerifiers(verifierAddresses);
        }
      } else {
        setVerifiers([]);
        setAdmin(null);
      }
    } catch (err: any) {
      console.error("Error loading state:", err);
      
      // If it's a timeout but we know the program is initialized, 
      // set admin to the current public key so the UI shows the Add Verifier section
      if (err.message?.includes("Timeout") || err.message?.includes("timeout")) {
        console.log("[DEBUG] State load timed out, but assuming program is initialized");
        // Set admin to current public key so Add Verifier section shows
        if (publicKey && publicKey.equals(ADMIN_PUBKEY)) {
          setAdmin(publicKey.toBase58());
        }
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("network") || err.name === "TypeError") {
        setError("Network error: Please check your internet connection and try again.");
        // Still try to show Add Verifier if we're the admin
        if (publicKey && publicKey.equals(ADMIN_PUBKEY)) {
          setAdmin(publicKey.toBase58());
        }
      } else {
        // Only show error if it's not a network issue (to avoid spam)
        console.error("Failed to load state:", err.message);
      }
    }
  };

  const loadAliases = async () => {
    try {
      const verifiers = await getAllVerifiers();
      setAliases(verifiers);
    } catch (err: any) {
      console.error("Error loading aliases:", err);
    }
  };

  const handleInitialize = async () => {
    console.log("[DEBUG] handleInitialize called");
    console.log("[DEBUG] Wallet state:", {
      connected,
      connecting,
      publicKey: publicKey?.toBase58(),
      hasSignTransaction: !!signTransaction,
      hasSignAllTransactions: !!signAllTransactions,
      walletName: wallet?.adapter?.name,
      walletReadyState: wallet?.adapter?.readyState,
    });

    if (!connected) {
      setError("Please connect your wallet first");
      if (connect) {
        try {
          await connect();
        } catch (err: any) {
          setError(`Failed to connect wallet: ${err.message}`);
        }
      }
      return;
    }

    if (!publicKey || !signTransaction) {
      console.error("[DEBUG] Wallet validation failed:", {
        hasPublicKey: !!publicKey,
        hasSignTransaction: !!signTransaction,
      });
      setError("Wallet not properly connected. Please reconnect your wallet.");
      return;
    }

    if (!newVerifierAddress) {
      setError("Please enter an initial verifier address");
      return;
    }

    try {
      new PublicKey(newVerifierAddress);
    } catch {
      setError("Invalid public key address");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[DEBUG] Creating wallet object for Anchor:", {
        publicKey: publicKey.toBase58(),
        signTransactionType: typeof signTransaction,
        signAllTransactionsType: typeof signAllTransactions,
      });

      const walletObj = {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      };

      console.log("[DEBUG] Wallet object created:", {
        hasPublicKey: !!walletObj.publicKey,
        hasSignTransaction: !!walletObj.signTransaction,
        hasSignAllTransactions: !!walletObj.signAllTransactions,
      });

      const program = getAnchorProgram(connection, walletObj as any);
      console.log("[DEBUG] Program created, proceeding to check state account...");

      const statePda = getStatePda();
      console.log("[DEBUG] State PDA derived:", statePda.toBase58());
      
      console.log("[DEBUG] Checking if state account exists...");
      console.log("[DEBUG] State PDA:", statePda.toBase58());
      console.log("[DEBUG] Connection endpoint:", connection.rpcEndpoint);
      console.log("[DEBUG] Connection object:", {
        hasConnection: !!connection,
        rpcEndpoint: connection?.rpcEndpoint,
        commitment: (connection as any)?.commitment,
      });
      
      // Skip the account check for initialization - just try to initialize
      // If state already exists, the transaction will fail with a clear error
      console.log("[DEBUG] Skipping account check - proceeding directly to initialization");
      console.log("[DEBUG] If state already exists, the transaction will fail with an error we can handle");

      const verifierPubkey = new PublicKey(newVerifierAddress);

      console.log("[DEBUG] Building initialize transaction:", {
        verifier: verifierPubkey.toBase58(),
        statePda: statePda.toBase58(),
        admin: publicKey.toBase58(),
      });

      const txBuilder = program.methods
        .initialize(verifierPubkey)
        .accounts({
          state: statePda,
          admin: publicKey,
          payer: publicKey,
          systemProgram: SystemProgram.programId,
        });

      console.log("[DEBUG] Transaction builder created");
      console.log("[DEBUG] Provider wallet state:", {
        providerPublicKey: (program.provider as any).publicKey?.toBase58(),
        providerWallet: (program.provider as any).wallet,
      });

      // Build transaction manually instead of using .rpc() to have better control
      console.log("[DEBUG] Building transaction manually...");
      const transaction = await txBuilder.transaction();
      
      console.log("[DEBUG] Transaction built, fetching recent blockhash...");
      // Get recent blockhash - required for transaction signing
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Set fee payer - required for transaction signing
      transaction.feePayer = publicKey;
      
      console.log("[DEBUG] Blockhash and fee payer set, requesting wallet signature...");
      console.log("[DEBUG] About to call signTransaction - Phantom should prompt now!");
      
      if (!signTransaction) {
        throw new Error("signTransaction is not available");
      }

      // Sign the transaction with the wallet
      const signedTx = await signTransaction(transaction);
      
      console.log("[DEBUG] Transaction signed by wallet, sending...");
      
      // Send the transaction
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log("[DEBUG] Transaction sent, confirming...");
      
      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      
      console.log("[DEBUG] Transaction confirmed:", tx);
      
      console.log("[DEBUG] Transaction sent successfully:", tx);

      setSuccess(`Program initialized! Transaction: ${tx}`);
      setNewVerifierAddress("");
      await loadState();
    } catch (err: any) {
      console.error("[DEBUG] Error in handleInitialize:", err);
      console.error("[DEBUG] Error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        logs: err.logs,
      });
      
      // Check if the error is because the state account already exists
      const errorMessage = err.message || "";
      const errorLogs = err.logs || [];
      const logsString = Array.isArray(errorLogs) ? errorLogs.join(" ") : String(errorLogs);
      const fullErrorText = errorMessage + " " + logsString;
      
      console.log("[DEBUG] Checking error for 'already in use' condition:", {
        errorMessage,
        logsString: logsString.substring(0, 200), // First 200 chars
        fullErrorText: fullErrorText.substring(0, 300),
        hasAlreadyInUse: fullErrorText.includes("already in use"),
        hasAllocateError: fullErrorText.includes("Allocate: account"),
      });
      
      // Check for various indicators that the account already exists
      const isAlreadyInitialized = 
        fullErrorText.includes("already in use") ||
        (fullErrorText.includes("Allocate: account") && fullErrorText.includes("already in use")) ||
        (errorMessage.includes("custom program error: 0x0") && logsString.includes("already in use"));
      
      if (isAlreadyInitialized) {
        // State already exists - reload state to update UI
        console.log("[DEBUG] Detected 'already in use' error - program already initialized");
        setError("Program is already initialized. Please use the 'Add Verifier' section below to add verifiers.");
        await loadState();
      } else {
        console.log("[DEBUG] Different error - showing generic error message");
        setError(err.message || "Failed to initialize program");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddVerifier = async () => {
    // Check wallet connection status
    if (!connected) {
      setError("Please connect your wallet first");
      if (connect) {
        try {
          await connect();
        } catch (err: any) {
          setError(`Failed to connect wallet: ${err.message}`);
        }
      }
      return;
    }

    if (!publicKey) {
      setError("Wallet public key not available. Please reconnect your wallet.");
      return;
    }
    
    if (!signTransaction) {
      setError("Wallet signTransaction function not available. Please reconnect your wallet.");
      return;
    }
    
    console.log("Wallet connection status:", {
      connected,
      connecting,
      publicKey: publicKey?.toBase58(),
      hasSignTransaction: !!signTransaction,
      hasSignAllTransactions: !!signAllTransactions,
      wallet: wallet?.adapter?.name,
    });

    if (!newVerifierAddress) {
      setError("Please enter a verifier address");
      return;
    }

    try {
      new PublicKey(newVerifierAddress);
    } catch {
      setError("Invalid public key address");
      return;
    }

    // Check if verifier already exists
    if (verifiers.includes(newVerifierAddress)) {
      setError("This verifier is already in the list");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[DEBUG] handleAddVerifier - Creating wallet object:", {
        publicKey: publicKey.toBase58(),
        signTransactionType: typeof signTransaction,
        signTransactionFunction: signTransaction?.toString?.().substring(0, 100),
        signAllTransactionsType: typeof signAllTransactions,
      });

      const walletObj = {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      };

      console.log("[DEBUG] Wallet object created, calling getAnchorProgram...");
      const program = getAnchorProgram(connection, walletObj as any);

      // Get state PDA - make sure we're using the correct one
      const [statePdaWithBump, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        PROGRAM_ID
      );
      
      console.log("[DEBUG] State PDA derivation:", {
        statePda: statePdaWithBump.toBase58(),
        bump,
        programId: PROGRAM_ID.toBase58(),
      });
      
      // Try to fetch the state account to see its current structure (with timeout to avoid hanging)
      try {
        console.log("[DEBUG] Attempting to fetch state account info (with 5s timeout)...");
        const getAccountInfoPromise = connection.getAccountInfo(statePdaWithBump);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        
        const stateAccountInfo = await Promise.race([getAccountInfoPromise, timeoutPromise]) as any;
        console.log("[DEBUG] State account info:", {
          exists: !!stateAccountInfo,
          dataLength: stateAccountInfo?.data?.length,
          owner: stateAccountInfo?.owner?.toBase58(),
          executable: stateAccountInfo?.executable,
        });
        
        if (stateAccountInfo) {
          // Log raw account data to see what's actually stored
          console.log("[DEBUG] Raw account data (first 100 bytes):", 
            Array.from(stateAccountInfo.data.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' ')
          );
          console.log("[DEBUG] Account data length:", stateAccountInfo.data.length);
          
          // Try to deserialize with the program to see what error we get
          try {
            const stateData = await (program.account as any).state.fetch(statePdaWithBump);
            console.log("[DEBUG] Successfully fetched state data:", stateData);
          } catch (fetchErr: any) {
            console.error("[DEBUG] Error fetching state data:", fetchErr);
            console.error("[DEBUG] This suggests the IDL doesn't match the on-chain account structure");
            console.error("[DEBUG] The account exists but can't be deserialized - IDL mismatch!");
            // Don't throw - continue with transaction anyway, but warn user
            setError("Warning: State account structure mismatch. The IDL may not match the deployed program. Transaction may fail.");
          }
        }
      } catch (err: any) {
        if (err.message?.includes("Timeout")) {
          console.log("[DEBUG] Account info fetch timed out - continuing anyway (transaction will fail if account doesn't exist)");
        } else {
          console.error("[DEBUG] Error getting account info:", err);
        }
        // Continue anyway - the transaction will fail if there's a real issue
      }
      
      // Validate and create Pubkey
      let verifierPubkey: PublicKey;
      try {
        verifierPubkey = new PublicKey(newVerifierAddress);
      } catch (err) {
        throw new Error("Invalid verifier public key address");
      }

      console.log("[DEBUG] Building transaction to add verifier:", {
        verifier: verifierPubkey.toBase58(),
        admin: publicKey.toBase58(),
        statePda: statePdaWithBump.toBase58(),
      });

      // Build transaction
      console.log("[DEBUG] Creating transaction builder...");

      const txBuilder = program.methods
        .addVerifier(verifierPubkey)
        .accounts({
          state: statePdaWithBump,
          admin: publicKey,
        });
      
      console.log("[DEBUG] Transaction builder accounts:", {
        state: statePdaWithBump.toBase58(),
        admin: publicKey.toBase58(),
      });

      console.log("[DEBUG] Transaction builder created");
      console.log("[DEBUG] Provider state before transaction:", {
        providerPublicKey: (program.provider as any).publicKey?.toBase58(),
        providerWalletKeys: (program.provider as any).wallet ? Object.keys((program.provider as any).wallet) : null,
        providerSignTransaction: !!(program.provider as any).wallet?.signTransaction,
      });

      // Build transaction manually instead of using .rpc() to have better control
      console.log("[DEBUG] Building transaction manually...");
      const transaction = await txBuilder.transaction();
      
      console.log("[DEBUG] Transaction built, fetching recent blockhash...");
      // Get recent blockhash - required for transaction signing
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Set fee payer - required for transaction signing
      transaction.feePayer = publicKey;
      
      console.log("[DEBUG] Blockhash and fee payer set, requesting wallet signature...");
      console.log("[DEBUG] About to call signTransaction - Phantom should prompt now!");
      
      if (!signTransaction) {
        throw new Error("signTransaction is not available");
      }

      // Sign the transaction with the wallet
      const signedTx = await signTransaction(transaction);
      
      console.log("[DEBUG] Transaction signed by wallet, sending...");
      
      // Send the transaction
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log("[DEBUG] Transaction sent, confirming...");
      
      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      
      console.log("[DEBUG] Transaction confirmed:", tx);
      
      console.log("[DEBUG] Transaction sent successfully:", tx);

      setSuccess(`Verifier added! Transaction: ${tx}`);
      setNewVerifierAddress("");
      await loadState();
    } catch (err: any) {
      console.error("[DEBUG] Error adding verifier:", err);
      console.error("[DEBUG] Error details:", {
        message: err.message,
        logs: err.logs,
        name: err.name,
      });
      
      // Check for deserialization error
      const errorMessage = err.message || "";
      const errorLogs = err.logs || [];
      const logsString = Array.isArray(errorLogs) ? errorLogs.join(" ") : String(errorLogs);
      
      if (errorMessage.includes("AccountDidNotDeserialize") || 
          logsString.includes("AccountDidNotDeserialize") ||
          logsString.includes("Failed to deserialize")) {
        setError("IDL Mismatch: The program's IDL doesn't match the on-chain state account structure. The state account was likely initialized with a different program version. You may need to regenerate the IDL or re-initialize the program.");
      } else {
        // Provide more helpful error messages
        let errorMessage = "Failed to add verifier";
        if (err.message) {
          errorMessage = err.message;
        } else if (err.logs) {
          errorMessage = `Transaction failed: ${err.logs.join(", ")}`;
        } else if (typeof err === "string") {
          errorMessage = err;
        }
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVerifier = async (verifierAddress: string) => {
    console.log("[DEBUG] handleRemoveVerifier called");
    
    if (!publicKey || !signTransaction) {
      console.error("[DEBUG] Wallet not ready for removeVerifier");
      setError("Please connect your wallet");
      return;
    }

    if (!confirm(`Are you sure you want to remove verifier ${verifierAddress.slice(0, 8)}...?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[DEBUG] Creating program for removeVerifier");
      const program = getAnchorProgram(connection, {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      } as any);

      const statePda = getStatePda();
      const verifierPubkey = new PublicKey(verifierAddress);

      console.log("[DEBUG] Building removeVerifier transaction...");
      const txBuilder = program.methods
        .removeVerifier(verifierPubkey)
        .accounts({
          state: statePda,
          admin: publicKey,
        });

      const transaction = await txBuilder.transaction();
      
      console.log("[DEBUG] Transaction built, fetching recent blockhash...");
      // Get recent blockhash - required for transaction signing
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Set fee payer - required for transaction signing
      transaction.feePayer = publicKey;
      
      console.log("[DEBUG] Blockhash and fee payer set, requesting wallet signature...");
      console.log("[DEBUG] About to call signTransaction - Phantom should prompt now!");
      
      if (!signTransaction) {
        throw new Error("signTransaction is not available");
      }

      const signedTx = await signTransaction(transaction);
      
      console.log("[DEBUG] Transaction signed, sending...");
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log("[DEBUG] Transaction sent, confirming...");
      await connection.confirmTransaction(tx, "confirmed");
      
      console.log("[DEBUG] Transaction confirmed:", tx);

      console.log("[DEBUG] Verifier removed successfully:", tx);
      setSuccess(`Verifier removed! Transaction: ${tx}`);
      await loadState();
    } catch (err: any) {
      console.error("[DEBUG] Error removing verifier:", err);
      setError(err.message || "Failed to remove verifier");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlias = async (address: string, alias: string) => {
    if (!alias.trim()) {
      setError("Alias cannot be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await setAlias(address, alias.trim());
      if (success) {
        setSuccess(`Alias "${alias}" saved for ${address.slice(0, 8)}...`);
        setEditingAlias(null);
        await loadAliases();
      } else {
        setError("Failed to save alias");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save alias");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlias = async (address: string) => {
    if (!confirm("Are you sure you want to delete this alias?")) return;

    setLoading(true);
    setError(null);

    try {
      const success = await deleteAlias(address);
      if (success) {
        setSuccess("Alias deleted");
        await loadAliases();
      } else {
        setError("Failed to delete alias");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete alias");
    } finally {
      setLoading(false);
    }
  };

  // Show loading/redirect if not admin
  if (publicKey && !publicKey.equals(ADMIN_PUBKEY)) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Access Denied</p>
          <p className="text-slate-400 mb-6">Only the admin can access this page.</p>
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 underline">
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-slate-400 hover:text-white">
            ← Back to Home
          </Link>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
          <p className="text-slate-300 mb-6">
            Manage authorized verifiers and their aliases
          </p>

          <div className="mb-6">
            <WalletMultiButton />
          </div>

          {!connected || !publicKey ? (
            <div className="space-y-4">
              <p className="text-slate-400">
                {connecting 
                  ? "Connecting wallet..." 
                  : "Please connect your admin wallet to continue"}
              </p>
              {!connecting && connect && (
                <button
                  onClick={async () => {
                    try {
                      await connect();
                    } catch (err: any) {
                      setError(`Failed to connect: ${err.message}`);
                    }
                  }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Program Status */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Program Status</h2>
                {admin ? (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      <span className="font-medium">Admin:</span>{" "}
                      <span className="font-mono text-emerald-400">{admin}</span>
                    </p>
                    <p className="text-slate-300">
                      <span className="font-medium">Authorized Verifiers:</span>{" "}
                      <span className="text-emerald-400">{verifiers.length}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400">Program not initialized yet</p>
                )}
              </div>

              {/* Initialize Program */}
              {!admin && (
                <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4">Initialize Program</h2>
                  <p className="text-sm text-slate-400 mb-4">
                    Initialize the program with an initial verifier address. You will become the admin.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Initial Verifier Address
                      </label>
                      <input
                        type="text"
                        value={newVerifierAddress}
                        onChange={(e) => setNewVerifierAddress(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter Solana public key"
                      />
                    </div>
                    <button
                      onClick={handleInitialize}
                      disabled={loading}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {loading ? "Processing..." : "Initialize Program"}
                    </button>
                  </div>
                </div>
              )}

              {/* Add Verifier */}
              {admin && (
                <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4">Add Verifier</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Verifier Address
                      </label>
                      <input
                        type="text"
                        value={newVerifierAddress}
                        onChange={(e) => setNewVerifierAddress(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter Solana public key"
                      />
                    </div>
                    <button
                      onClick={handleAddVerifier}
                      disabled={loading}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {loading ? "Processing..." : "Add Verifier"}
                    </button>
                  </div>
                </div>
              )}

              {/* Verifiers List */}
              {admin && verifiers.length > 0 && (
                <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4">Authorized Verifiers ({verifiers.length})</h2>
                  <div className="space-y-2">
                    {verifiers.map((verifier) => {
                      const alias = aliases.find(a => a.address === verifier);
                      return (
                        <div
                          key={verifier}
                          className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex-1">
                            {alias && (
                              <p className="font-medium text-emerald-400">{alias.alias}</p>
                            )}
                            <p className="text-sm text-slate-300 font-mono">{verifier}</p>
                            <a
                              href={`https://explorer.solana.com/address/${verifier}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                            >
                              View on Explorer
                            </a>
                          </div>
                          <button
                            onClick={() => handleRemoveVerifier(verifier)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verifier Aliases */}
              <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Verifier Aliases</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Set friendly names for verifier addresses (stored off-chain in Supabase)
                </p>

                {/* Add alias for verifiers */}
                {verifiers.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-lg">
                    <h3 className="font-medium mb-2">Add/Edit Alias for Verifier</h3>
                    <div className="space-y-2 mb-2">
                      <select
                        value={editingAlias?.address || ""}
                        onChange={(e) => {
                          const address = e.target.value;
                          if (address) {
                            const existing = aliases.find(a => a.address === address);
                            setEditingAlias({ address, alias: existing?.alias || "" });
                            setNewAlias(existing?.alias || "");
                          } else {
                            setEditingAlias(null);
                            setNewAlias("");
                          }
                        }}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select a verifier...</option>
                        {verifiers.map((v) => (
                          <option key={v} value={v}>
                            {v.slice(0, 8)}...{v.slice(-8)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {editingAlias && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newAlias}
                          onChange={(e) => setNewAlias(e.target.value)}
                          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter alias name"
                        />
                        <button
                          onClick={() => handleSaveAlias(editingAlias.address, newAlias)}
                          disabled={loading || !newAlias.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* List of aliases */}
                <div className="space-y-2">
                  {aliases.length === 0 ? (
                    <p className="text-slate-400">No aliases set yet</p>
                  ) : (
                    aliases.map((item) => (
                      <div
                        key={item.address}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-emerald-400">{item.alias}</p>
                          <p className="text-sm text-slate-400 font-mono">{item.address}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingAlias({ address: item.address, alias: item.alias });
                              setNewAlias(item.alias);
                            }}
                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAlias(item.address)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-700 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-6 p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg text-emerald-300">
                  {success}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

