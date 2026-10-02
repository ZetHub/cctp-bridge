import type { ErrorCode } from "./codes";

export const ErrorMessage: Record<ErrorCode, string> = {
	AMOUNT_REQUIRED: "Enter an amount.",
	AMOUNT_INVALID: "Enter a valid number.",
	AMOUNT_TOO_SMALL: "Amount must be greater than zero.",
	AMOUNT_EXCEEDS_BALANCE: "Amount exceeds your USDC balance.",
	RECIPIENT_REQUIRED: "Enter a recipient address.",
	RECIPIENT_INVALID_EVM:
		"Recipient must be a 0x-prefixed Ethereum-style address (40 hex characters, valid checksum).",
	RECIPIENT_INVALID_STELLAR:
		"Recipient must be a Stellar G (account), C (contract) or M (muxed) address with a valid checksum.",
	MEMO_INVALID_TEXT: "Memo text must be 28 characters or fewer (ASCII).",
	MEMO_INVALID_ID: "Memo ID must be an unsigned integer.",
	MEMO_INVALID_HASH: "Memo hash/return must be 32 bytes (64 hex characters).",
	MISSING_SOURCE: "Pick a source chain.",
	MISSING_DESTINATION: "Pick a destination chain.",
	MISSING_EVM_CHAIN_ID: "Network is missing its EVM chain id.",
	MISSING_FORWARDER:
		"Stellar network is missing the CctpForwarder configuration.",
	MISSING_TRUSTLINE:
		"The Stellar recipient has no trustline for this asset. Establish the trustline before bridging.",
	UNSUPPORTED_ASSET: "The selected asset is not supported on this route.",
	UNSUPPORTED_ROUTE:
		"No chain connector registered for one side of this route.",
	MISMATCHED_ENVIRONMENTS:
		"Source and destination must be on the same environment (mainnet or testnet).",
	SAME_NETWORK: "Source and destination networks must differ.",
	WRONG_NETWORK: "Switch your wallet to the correct network.",
	WALLET_SIGN_REJECTED: "Transaction was rejected in the wallet.",
	RPC_ERROR: "RPC request failed. Check your network and retry.",
	RPC_TIMEOUT: "RPC request timed out. Retrying with a fallback endpoint.",
	ATTESTATION_TIMEOUT:
		"Timed out waiting for Circle to issue the attestation. Your transfer is safe; retry the mint step.",
	BURN_FAILED: "Burn transaction failed on the source chain.",
	UNKNOWN: "Something went wrong. Check the developer console for details.",
};
