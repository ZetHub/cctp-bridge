import { CctpEncoder } from "../../cctp/CctpEncoder";
import { FeeMath } from "../../cctp/FeeMath";
import { Amount } from "../../domain/Amount";
import type { BridgeMemo } from "../../domain/BridgeMemo";
import {
	type AssetSymbol,
	ChainFamily,
	FinalityThreshold,
} from "../../domain/enums";
import type { Network } from "../../domain/Network";
import type { NetworkIdInput } from "../../domain/NetworkId";
import type { RawTransaction } from "../../domain/RawTransaction";
import { CCTP_AMOUNT_DECIMALS } from "../../domain/Token";
import type { TokenAsset } from "../../domain/TokenAsset";
import { BridgeError } from "../../errors";
import type { IChainConnector } from "../../ports/IChainConnector";
import type { IFeeService } from "../../ports/IFeeService";
import type { INetworkService } from "../../ports/INetworkService";

export interface TokenWithChainDetails {
	readonly symbol: AssetSymbol;
	readonly name: string;
	readonly decimals: number;
	readonly address: string;
	readonly issuer?: string;
	readonly assetCode?: string;
	readonly logoUrl?: string;
	readonly chainSymbol: NetworkIdInput;
	readonly network: Network;
}

export interface ApproveTxParams {
	token: TokenWithChainDetails;
	owner: string;
	amount?: Amount | string | number;
}

export interface SendTxParams {
	sourceToken: TokenWithChainDetails;
	destinationToken: TokenWithChainDetails;
	amount: Amount | string | number;
	fromAccountAddress: string;
	toAccountAddress: string;
	minFinalityThreshold?: FinalityThreshold;
	memo?: BridgeMemo;
}

export interface ReceiveTxParams {
	destinationToken: TokenWithChainDetails;
	toAccountAddress: string;
	message: `0x${string}`;
	attestation: `0x${string}`;
}

export interface RawTxBuilder {
	approve(params: ApproveTxParams): Promise<RawTransaction>;
	send(params: SendTxParams): Promise<RawTransaction>;
	receive(params: ReceiveTxParams): Promise<RawTransaction>;
}

export interface RawTxBuilderDeps {
	connectors: Record<ChainFamily, IChainConnector>;
	networks: INetworkService;
	feeService: IFeeService;
}

/** Routes raw-transaction requests to the correct chain connector.
 *  Handles the CCTP-specific bits (hook payload for EVM→Stellar, maxFee via
 *  Iris quote) that live above any single chain family. */
export class DefaultRawTxBuilder implements RawTxBuilder {
	constructor(private readonly deps: RawTxBuilderDeps) {}

	approve(params: ApproveTxParams): Promise<RawTransaction> {
		const { token, owner, amount } = params;
		const connector = this.connectorFor(token.network);
		const parsedAmount =
			amount === undefined ? undefined : this.parseAmount(amount, token);
		return connector.buildApproveTx({
			network: token.network,
			token: this.toTokenAsset(token),
			owner,
			amount: parsedAmount,
		});
	}

	async send(params: SendTxParams): Promise<RawTransaction> {
		const {
			sourceToken,
			destinationToken,
			amount,
			fromAccountAddress,
			toAccountAddress,
			memo,
		} = params;

		const source = sourceToken.network;
		const destination = destinationToken.network;
		if (source.environment !== destination.environment) {
			throw new BridgeError(
				"MISMATCHED_ENVIRONMENTS",
				"Source and destination must be on the same environment (mainnet/testnet)",
			);
		}
		if (source.id === destination.id) {
			throw new BridgeError(
				"SAME_NETWORK",
				"Source and destination networks must differ",
			);
		}

		const parsedAmount = this.parseAmount(amount, sourceToken);
		const minFinalityThreshold =
			params.minFinalityThreshold ?? FinalityThreshold.FAST;

		const quote = await this.deps.feeService.getQuote({
			environment: source.environment,
			sourceDomain: source.cctpDomain,
			destinationDomain: destination.cctpDomain,
			minFinalityThreshold,
		});
		const maxFee = FeeMath.maxFeeWithBuffer(
			parsedAmount.scaleTo(CCTP_AMOUNT_DECIMALS).raw,
			quote.feeBps,
		);

		const hookData = this.hookDataFor(source, destination, toAccountAddress);
		const connector = this.connectorFor(source);
		return connector.buildBurnTx({
			source,
			destination,
			token: this.toTokenAsset(sourceToken),
			amount: parsedAmount,
			from: fromAccountAddress,
			recipient: this.recipientFor(source, destination, toAccountAddress),
			maxFee,
			minFinalityThreshold,
			hookData,
			memo,
		});
	}

	receive(params: ReceiveTxParams): Promise<RawTransaction> {
		const { destinationToken, toAccountAddress, message, attestation } = params;
		const destination = destinationToken.network;
		const connector = this.connectorFor(destination);
		return connector.buildReceiveTx({
			destination,
			token: this.toTokenAsset(destinationToken),
			to: toAccountAddress,
			message,
			attestation,
		});
	}

	private connectorFor(network: Network): IChainConnector {
		const connector = this.deps.connectors[network.family];
		if (!connector) {
			throw new BridgeError(
				"UNSUPPORTED_ROUTE",
				`No chain connector registered for family ${network.family}`,
			);
		}
		return connector;
	}

	private hookDataFor(
		source: Network,
		destination: Network,
		toAccountAddress: string,
	): `0x${string}` | undefined {
		if (
			source.family === ChainFamily.EVM &&
			destination.family === ChainFamily.STELLAR
		) {
			return CctpEncoder.forwarderHook(toAccountAddress);
		}
		return undefined;
	}

	private recipientFor(
		source: Network,
		destination: Network,
		toAccountAddress: string,
	): string {
		if (
			source.family === ChainFamily.EVM &&
			destination.family === ChainFamily.STELLAR
		) {
			if (!destination.cctpForwarder) {
				throw new BridgeError("MISSING_FORWARDER");
			}
			return destination.cctpForwarder;
		}
		return toAccountAddress;
	}

	private parseAmount(
		amount: Amount | string | number,
		token: TokenWithChainDetails,
	): Amount {
		if (amount instanceof Amount) {
			return amount;
		}
		return Amount.fromHuman(String(amount), token.network.family);
	}

	private toTokenAsset(token: TokenWithChainDetails): TokenAsset {
		return token.network.token(token.symbol);
	}
}
