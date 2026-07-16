import type { BridgeSide, BridgeStatus } from "./enums";

export interface BridgeEventRecord {
	name: string;
	side: BridgeSide;
	txHash?: string;
	block?: number;
	observedAt: number;
}

/** Serialisable snapshot of a transfer's progress. Consumers who persist
 *  transfers via `sdk.transfers` update this record as their caller learns
 *  the burn hash, the attestation, and the mint hash. */
export interface BridgeTransactionState {
	status: BridgeStatus;
	burnTxHash?: string;
	mintTxHash?: string;
	messageHex?: string;
	attestationHex?: string;
	error?: string;
	startedAt?: number;
	completedAt?: number;
	events?: BridgeEventRecord[];
}

export interface BridgeQuote {
	feeBps: number;
	minFinalityThreshold: number;
	estimatedSeconds: number;
}
