"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";

interface NFTItem {
  mint: string;
  name: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: any[];
}

export default function MyItemsPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey && connection) {
      fetchNFTs();
    }
  }, [publicKey, connection]);

  const fetchNFTs = async () => {
    if (!publicKey || !connection) return;

    setLoading(true);
    setError(null);

    try {
      // Use Solana RPC to fetch token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        }
      );

      // Filter for NFTs (tokens with 0 decimals and supply of 1)
      const nftPromises = tokenAccounts.value
        .filter((account) => {
          const parsedInfo = account.account.data.parsed.info;
          return parsedInfo.tokenAmount.decimals === 0 && 
                 parsedInfo.tokenAmount.amount === "1";
        })
        .map(async (account) => {
          try {
            const mintAddress = account.account.data.parsed.info.mint;
            
            // Derive metadata PDA
            const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
              "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
            );
            const [metadataPda] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                new PublicKey(mintAddress).toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
            );

            // Fetch metadata account
            const metadataAccount = await connection.getAccountInfo(metadataPda);
            if (!metadataAccount) {
              return {
                mint: mintAddress,
                name: `NFT ${mintAddress.slice(0, 8)}...`,
                uri: "",
              };
            }

            // Parse metadata URI from account data
            // Metadata account structure: [key(1), update_authority(32), mint(32), data_size(4), name(string), symbol(string), uri(string), ...]
            const data = metadataAccount.data;
            let uri = "";
            let name = "";
            
            try {
              // Skip key (1 byte) + update_authority (32 bytes) + mint (32 bytes) + data_size (4 bytes)
              let offset = 1 + 32 + 32 + 4;
              
              // Read name (string with 4-byte length prefix)
              const nameLength = data.readUInt32LE(offset);
              offset += 4;
              name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
              offset += nameLength;
              
              // Read symbol (string with 4-byte length prefix)
              const symbolLength = data.readUInt32LE(offset);
              offset += 4;
              offset += symbolLength;
              
              // Read URI (string with 4-byte length prefix)
              const uriLength = data.readUInt32LE(offset);
              offset += 4;
              uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
              
              // Fetch JSON metadata from URI
              let image = "";
              let description = "";
              let attributes: any[] = [];
              
              if (uri) {
                try {
                  const metadataResponse = await fetch(uri);
                  const metadataJson = await metadataResponse.json();
                  image = metadataJson.image || "";
                  description = metadataJson.description || "";
                  attributes = metadataJson.attributes || [];
                  if (!name || name === "") {
                    name = metadataJson.name || `NFT ${mintAddress.slice(0, 8)}...`;
                  }
                } catch (fetchErr) {
                  console.error(`Error fetching metadata from ${uri}:`, fetchErr);
                }
              }
              
              return {
                mint: mintAddress,
                name: name || `NFT ${mintAddress.slice(0, 8)}...`,
                uri,
                image,
                description,
                attributes,
              };
            } catch (parseErr) {
              console.error(`Error parsing metadata:`, parseErr);
              return {
                mint: mintAddress,
                name: `NFT ${mintAddress.slice(0, 8)}...`,
                uri: "",
              };
            }
          } catch (err) {
            console.error(`Error loading NFT:`, err);
            return null;
          }
        });

      const nftResults = await Promise.all(nftPromises);
      const validNfts = nftResults.filter((nft) => nft !== null) as NFTItem[];
      
      setNfts(validNfts);
    } catch (err: any) {
      console.error("Error fetching NFTs:", err);
      setError(err.message || "Failed to fetch NFTs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-slate-400 hover:text-white">
            ← Back to Home
          </Link>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">My AuthNFT Certificates</h1>
          <p className="text-slate-300 mb-6">
            View all authenticity certificates in your wallet
          </p>

          <div className="mb-6">
            <WalletMultiButton />
          </div>

          {!publicKey ? (
            <p className="text-slate-400">Please connect your wallet to view your NFTs</p>
          ) : loading ? (
            <p className="text-slate-400">Loading your NFTs...</p>
          ) : error ? (
            <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          ) : nfts.length === 0 ? (
            <p className="text-slate-400">No NFTs found in your wallet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nfts.map((nft) => (
                <div
                  key={nft.mint}
                  className="border border-slate-800 rounded-xl bg-slate-900/40 p-6 hover:border-emerald-600 transition-colors"
                >
                  {nft.image ? (
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  ) : (
                    <div className="w-full h-48 bg-slate-800 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-slate-500">No Image</span>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold mb-2">{nft.name}</h3>
                  {nft.description && (
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {nft.description}
                    </p>
                  )}
                  {nft.attributes && nft.attributes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-2">Attributes:</p>
                      <div className="flex flex-wrap gap-2">
                        {nft.attributes.slice(0, 3).map((attr: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-slate-800 rounded"
                          >
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <a
                    href={`https://explorer.solana.com/address/${nft.mint}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                  >
                    View on Explorer
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

