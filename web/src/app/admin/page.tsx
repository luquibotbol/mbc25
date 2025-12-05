"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAnchorProgram, getStatePda, ADMIN_PUBKEY } from "@/lib/anchor";
import { getAlias, setAlias, getAllVerifiers, deleteAlias, VerifierAlias } from "@/lib/supabase";

export default function AdminPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State management
  const [currentVerifier, setCurrentVerifier] = useState<string | null>(null);
  const [newVerifierAddress, setNewVerifierAddress] = useState("");
  const [aliases, setAliases] = useState<VerifierAlias[]>([]);
  const [editingAlias, setEditingAlias] = useState<{ address: string; alias: string } | null>(null);
  const [newAlias, setNewAlias] = useState("");

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
      const stateAccount = await connection.getAccountInfo(statePda);
      
      if (stateAccount) {
        const program = getAnchorProgram(connection, {
          publicKey: publicKey!,
          signTransaction: signTransaction!,
          signAllTransactions: signAllTransactions,
        } as any);
        
        // Fetch state account - Anchor converts "State" to "state" in camelCase
        const stateData = await (program.account as any).state.fetch(statePda);
        // The field name in the IDL is "authorized_verifier" (snake_case)
        const authorizedVerifier = stateData?.authorized_verifier || stateData?.authorizedVerifier;
        if (authorizedVerifier) {
          setCurrentVerifier(authorizedVerifier.toBase58());
        }
      }
    } catch (err: any) {
      console.error("Error loading state:", err);
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
    if (!publicKey || !signTransaction) {
      setError("Please connect your wallet");
      return;
    }

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

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const program = getAnchorProgram(connection, {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      } as any);

      const statePda = getStatePda();
      const verifierPubkey = new PublicKey(newVerifierAddress);

      const tx = await program.methods
        .initialize(verifierPubkey)
        .accounts({
          state: statePda,
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Program initialized! Transaction: ${tx}`);
      setNewVerifierAddress("");
      await loadState();
    } catch (err: any) {
      setError(err.message || "Failed to initialize program");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVerifier = async () => {
    if (!publicKey || !signTransaction) {
      setError("Please connect your wallet");
      return;
    }

    if (!newVerifierAddress) {
      setError("Please enter a new verifier address");
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
      const program = getAnchorProgram(connection, {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      } as any);

      const statePda = getStatePda();
      const verifierPubkey = new PublicKey(newVerifierAddress);

      const tx = await program.methods
        .updateVerifier(verifierPubkey)
        .accounts({
          state: statePda,
          admin: publicKey,
        })
        .rpc();

      setSuccess(`Verifier updated! Transaction: ${tx}`);
      setNewVerifierAddress("");
      await loadState();
    } catch (err: any) {
      setError(err.message || "Failed to update verifier");
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

          {!publicKey ? (
            <p className="text-slate-400">Please connect your admin wallet</p>
          ) : (
            <>
              {/* Current Verifier Status */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Current Authorized Verifier</h2>
                {currentVerifier ? (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      <span className="font-medium">Address:</span>{" "}
                      <span className="font-mono text-emerald-400">{currentVerifier}</span>
                    </p>
                    <a
                      href={`https://explorer.solana.com/address/${currentVerifier}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                    >
                      View on Explorer
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-400">Program not initialized yet</p>
                )}
              </div>

              {/* Initialize/Update Verifier */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">
                  {currentVerifier ? "Update Authorized Verifier" : "Initialize Program"}
                </h2>
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
                    onClick={currentVerifier ? handleUpdateVerifier : handleInitialize}
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {loading
                      ? "Processing..."
                      : currentVerifier
                      ? "Update Verifier"
                      : "Initialize Program"}
                  </button>
                </div>
              </div>

              {/* Verifier Aliases */}
              <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Verifier Aliases</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Set friendly names for verifier addresses (stored off-chain in Supabase)
                </p>

                {/* Add alias for current verifier */}
                {currentVerifier && (
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-lg">
                    <h3 className="font-medium mb-2">Add/Edit Alias for Current Verifier</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAlias}
                        onChange={(e) => setNewAlias(e.target.value)}
                        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter alias name"
                      />
                      <button
                        onClick={() => handleSaveAlias(currentVerifier, newAlias)}
                        disabled={loading || !newAlias.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        Save
                      </button>
                    </div>
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

