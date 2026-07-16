import type { ChainFamily } from "./enums";

/**
 * An unsigned transaction ready for the caller to sign and broadcast with
 * their own wallet library. The SDK never touches keys.
 */
export type RawTransaction = RawEvmTransaction | RawSorobanTransaction;

export interface RawEvmTransactionProps {
	readonly family: typeof ChainFamily.EVM;
	readonly chainId: number;
	readonly from: `0x${string}`;
	readonly to: `0x${string}`;
	readonly data: `0x${string}`;
	readonly value?: bigint;
}

export class RawEvmTransaction implements RawEvmTransactionProps {
	readonly family = "evm" as const;
	readonly chainId: number;
	readonly from: `0x${string}`;
	readonly to: `0x${string}`;
	readonly data: `0x${string}`;
	readonly value?: bigint;

	constructor(props: Omit<RawEvmTransactionProps, "family">) {
		this.chainId = props.chainId;
		this.from = props.from;
		this.to = props.to;
		this.data = props.data;
		this.value = props.value;
	}
}

export interface RawSorobanTransactionProps {
	readonly family: typeof ChainFamily.STELLAR;
	readonly networkPassphrase: string;
	readonly from: string;
	readonly xdr: string;
}

export class RawSorobanTransaction implements RawSorobanTransactionProps {
	readonly family = "stellar" as const;
	readonly networkPassphrase: string;
	readonly from: string;
	readonly xdr: string;

	constructor(props: Omit<RawSorobanTransactionProps, "family">) {
		this.networkPassphrase = props.networkPassphrase;
		this.from = props.from;
		this.xdr = props.xdr;
	}
}

export function isRawEvm(tx: RawTransaction): tx is RawEvmTransaction {
	return tx.family === "evm";
}

export function isRawSoroban(tx: RawTransaction): tx is RawSorobanTransaction {
	return tx.family === "stellar";
}
