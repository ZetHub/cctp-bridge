export const ChainFamily = {
	EVM: "evm",
	STELLAR: "stellar",
} as const;

export type ChainFamily = (typeof ChainFamily)[keyof typeof ChainFamily];

export const Environment = {
	MAINNET: "mainnet",
	TESTNET: "testnet",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const BridgeStatus = {
	IDLE: "idle",
	APPROVING: "approving",
	BURNING: "burning",
	WAITING_ATTESTATION: "waiting_attestation",
	MINTING: "minting",
	COMPLETED: "completed",
	FAILED: "failed",
} as const;

export type BridgeStatus = (typeof BridgeStatus)[keyof typeof BridgeStatus];

export const FinalityThreshold = {
	FAST: 1000,
	STANDARD: 2000,
} as const;

export type FinalityThreshold =
	(typeof FinalityThreshold)[keyof typeof FinalityThreshold];

export const RpcMode = {
	PREPEND: "prepend",
	REPLACE: "replace",
} as const;

export type RpcMode = (typeof RpcMode)[keyof typeof RpcMode];

export const BridgeSide = {
	SOURCE: "source",
	DESTINATION: "destination",
} as const;

export type BridgeSide = (typeof BridgeSide)[keyof typeof BridgeSide];

export const MemoType = {
	TEXT: "text",
	ID: "id",
	HASH: "hash",
	RETURN: "return",
} as const;

export type MemoType = (typeof MemoType)[keyof typeof MemoType];

export const AttestationStatus = {
	PENDING: "pending_confirmations",
	COMPLETE: "complete",
} as const;

export type AttestationStatus =
	(typeof AttestationStatus)[keyof typeof AttestationStatus];

export const AssetSymbol = {
	USDC: "USDC",
} as const;

export type AssetSymbol = (typeof AssetSymbol)[keyof typeof AssetSymbol];
