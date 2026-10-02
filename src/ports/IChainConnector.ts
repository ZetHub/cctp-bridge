import type { Amount } from "../domain/Amount";
import type { BridgeMemo } from "../domain/BridgeMemo";
import type { ChainFamily } from "../domain/enums";
import type { Network } from "../domain/Network";
import type { RawTransaction } from "../domain/RawTransaction";
import type { TokenAsset } from "../domain/TokenAsset";

/**
 * A chain-family adapter. One implementation per chain family (EVM, Stellar,
 * and any future family) — each knows how to build unsigned CCTP txs, read
 * allowances, and read balances against its family's RPCs. Adding a new
 * chain family = implementing this interface.
 */
export interface IChainConnector {
	readonly family: ChainFamily;

	/** Build an unsigned `approve` tx: `owner` grants the source
	 *  TokenMessenger permission to move `amount` of `token`. Pass `undefined`
	 *  for `amount` to request an unlimited approval. */
	buildApproveTx(params: BuildApproveTxParams): Promise<RawTransaction>;

	/** Build the source-chain burn tx. `hookData` is populated when the
	 *  destination chain requires a forwarder (Stellar). */
	buildBurnTx(params: BuildBurnTxParams): Promise<RawTransaction>;

	/** Build the destination-chain receive tx: mint on EVM, mint_and_forward
	 *  on Stellar. */
	buildReceiveTx(params: BuildReceiveTxParams): Promise<RawTransaction>;

	/** Current allowance from `owner` to the source TokenMessenger. */
	getAllowance(params: GetAllowanceOnChainParams): Promise<Amount>;

	/** Token balance for `owner`. */
	getTokenBalance(params: GetTokenBalanceOnChainParams): Promise<Amount>;

	/** Native (gas) token balance for `owner`. */
	getNativeBalance(params: GetNativeBalanceOnChainParams): Promise<Amount>;

	isMessageReceived(params: IsMessageReceivedOnChainParams): Promise<boolean>;
}

export interface BuildApproveTxParams {
	readonly network: Network;
	readonly token: TokenAsset;
	readonly owner: string;
	readonly amount: Amount | undefined;
	readonly expiresInLedgers?: number;
	readonly sorobanInclusionFee?: number;
}

export interface BuildBurnTxParams {
	readonly source: Network;
	readonly destination: Network;
	readonly token: TokenAsset;
	readonly amount: Amount;
	readonly from: string;
	readonly recipient: string;
	readonly maxFee: bigint;
	readonly minFinalityThreshold: number;
	readonly destinationCaller?: string;
	readonly hookData?: `0x${string}`;
	readonly memo?: BridgeMemo;
	readonly sorobanInclusionFee?: number;
}

export interface BuildReceiveTxParams {
	readonly destination: Network;
	readonly token: TokenAsset;
	readonly to: string;
	readonly message: `0x${string}`;
	readonly attestation: `0x${string}`;
	readonly sorobanInclusionFee?: number;
}

export interface GetAllowanceOnChainParams {
	readonly network: Network;
	readonly token: TokenAsset;
	readonly owner: string;
}

export interface GetTokenBalanceOnChainParams {
	readonly network: Network;
	readonly token: TokenAsset;
	readonly owner: string;
}

export interface GetNativeBalanceOnChainParams {
	readonly network: Network;
	readonly owner: string;
}

export interface IsMessageReceivedOnChainParams {
	readonly network: Network;
	readonly nonce: `0x${string}`;
}
