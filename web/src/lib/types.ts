export type Onchain = {
  "version": "0.1.0",
  "name": "onchain",
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgCz7s8RDr5F",
  "metadata": {
    "name": "onchain",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintAuthNft",
      "discriminator": [51, 57, 225, 47, 182, 146, 137, 166],
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "verifier",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metadata",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "masterEdition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenMetadataProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "productId",
          "type": "string"
        },
        {
          "name": "brand",
          "type": "string"
        },
        {
          "name": "category",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "State",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "publicKey"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "AuthNftMinted",
      "fields": [
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "productId",
          "type": "string",
          "index": false
        },
        {
          "name": "brand",
          "type": "string",
          "index": false
        },
        {
          "name": "category",
          "type": "string",
          "index": false
        },
        {
          "name": "metadataUri",
          "type": "string",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidVerifierKey",
      "msg": "Invalid verifier public key string."
    },
    {
      "code": 6001,
      "name": "UnauthorizedVerifier",
      "msg": "Caller is not authorized verifier."
    }
  ]
};

