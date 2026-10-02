export const ValidationMessage = {
	ADDRESS_REQUIRED: "Address required.",
	INVALID_EVM_ADDRESS:
		"Invalid EVM address (expected 0x followed by 40 hex characters).",
	INVALID_EVM_CHECKSUM:
		"Invalid EVM address checksum. Check the address for a typo, or pass it in lowercase.",
	INVALID_STELLAR_ADDRESS:
		"Invalid Stellar address (expected a G account, C contract or M muxed account with a valid checksum).",
	INVALID_STRKEY:
		"Stellar address must be a G, C or M address with a valid checksum.",
	INVALID_HEX: "Invalid hex string.",
	ODD_HEX_LENGTH: "Hex string must have an even number of characters.",
	INVALID_AMOUNT: "Enter a valid number.",
	AMOUNT_NEGATIVE: "Amount must not be negative.",
	INVALID_MEMO_TEXT: "Memo text must be 28 characters or fewer (ASCII).",
	INVALID_MEMO_ID: "Memo ID must be an unsigned integer.",
	INVALID_MEMO_HASH: "Memo hash/return must be 32 bytes (64 hex characters).",
} as const;

export type ValidationMessage =
	(typeof ValidationMessage)[keyof typeof ValidationMessage];
