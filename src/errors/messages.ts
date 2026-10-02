import type { ErrorCode } from "./codes";

export const ErrorMessage: Record<ErrorCode, string> = {
	AMOUNT_REQUIRED: "Enter an amount.",
	AMOUNT_INVALID: "Enter a valid number.",
	AMOUNT_TOO_SMALL: "Amount must be greater than zero.",
	AMOUNT_EXCEEDS_BALANCE: "Amount exceeds your USDC balance.",
	APPROVAL_AMOUNT_REQUIRED:
		"Pass the amount to approve, or unlimited: true to grant an unlimited allowance.",
	APPROVAL_AMOUNT_CONFLICT:
		"Pass either an approval amount or unlimited: true, not both.",
	APPROVAL_EXPIRATION_INVALID:
		"expiresInLedgers must be a positive whole number of ledgers.",
	MAX_FEE_INVALID: "maxFee must be zero or more, and less than the amount.",
	RECIPIENT_REQUIRED: "Enter a recipient address.",
	RECIPIENT_INVALID_EVM:
		"Recipient must be a 0x-prefixed Ethereum-style address (40 hex characters, valid checksum).",
	RECIPIENT_INVALID_STELLAR:
		"Recipient must be a Stellar G (account), C (contract) or M (muxed) address with a valid checksum.",
	MEMO_INVALID_TEXT: "Memo text must be 28 characters or fewer (ASCII).",
	MEMO_INVALID_ID: "Memo ID must be an unsigned integer.",
	MEMO_INVALID_HASH: "Memo hash/return must be 32 bytes (64 hex characters).",
	TX_HASH_INVALID:
		"Transaction hash must be 64 hex characters, with or without a 0x prefix.",
	NONCE_INVALID:
		"Event nonce must be a 0x-prefixed bytes32 (64 hex characters), as Iris returns it.",
	DESTINATION_CALLER_INVALID:
		"destinationCaller must be a 0x-prefixed EVM address on the destination chain.",
	DESTINATION_CALLER_UNSUPPORTED:
		"Transfers to Stellar must use the CctpForwarder as destination caller; a custom destinationCaller is not supported.",
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
	ATTESTATION_REQUEST_FAILED:
		"Circle's attestation service rejected the request. Check the source chain and the burn transaction hash.",
	FEE_QUOTE_FAILED:
		"Could not get a fee quote from Circle. Retry, or pass maxFee to send().",
	FEE_TIER_UNAVAILABLE:
		"Circle did not quote a fee for this finality threshold on this route.",
	BURN_FAILED: "Burn transaction failed on the source chain.",
	UNKNOWN: "Something went wrong. Check the developer console for details.",
};
