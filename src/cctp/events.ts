export const CctpEvent = {
	EVM_DEPOSIT_FOR_BURN: "DepositForBurn",
	EVM_MESSAGE_SENT: "MessageSent",
	EVM_MESSAGE_RECEIVED: "MessageReceived",
	EVM_MINT_AND_WITHDRAW: "MintAndWithdraw",
	STELLAR_DEPOSIT_FOR_BURN: "deposit_for_burn",
	STELLAR_MINT_AND_FORWARD: "mint_and_forward",
} as const;

export type CctpEvent = (typeof CctpEvent)[keyof typeof CctpEvent];

export const CctpEventDescription: Record<CctpEvent, string> = {
	DepositForBurn:
		"TokenMessenger logs the burn parameters (amount, destinationDomain, mintRecipient).",
	MessageSent:
		"MessageTransmitter emits the cross-chain message bytes Iris will sign.",
	MessageReceived:
		"MessageTransmitter records that the attested message was delivered.",
	MintAndWithdraw:
		"TokenMinter logs the destination mint amount and recipient.",
	deposit_for_burn:
		"Stellar TokenMessenger contract event for the burn invocation.",
	mint_and_forward:
		"CctpForwarder contract event when minted USDC is forwarded to the final recipient.",
};
