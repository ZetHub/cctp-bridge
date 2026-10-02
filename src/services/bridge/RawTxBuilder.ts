import { CctpEncoder } from "../../cctp/CctpEncoder";
import { FeeMath } from "../../cctp/FeeMath";
import { Address } from "../../domain/Address";
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
import { BridgeError, type ErrorCode } from "../../errors";
import type { IChainConnector } from "../../ports/IChainConnector";
import type { IFeeService } from "../../ports/IFeeService";
import type { INetworkService } from "../../ports/INetworkService";
import { ledgerCountSchema } from "../../validation/schemas";

const INVALID_RECIPIENT_CODE: Record<ChainFamily, ErrorCode> = {
	[ChainFamily.EVM]: "RECIPIENT_INVALID_EVM",
	[ChainFamily.STELLAR]: "RECIPIENT_INVALID_STELLAR",
};

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

interface ApproveTxBaseParams {
	token: TokenWithChainDetails;
	owner: string;
	expiresInLedgers?: number;
}

export interface ApproveExactTxParams extends ApproveTxBaseParams {
	amount: Amount | string | number;
	unlimited?: false;
}

export interface ApproveUnlimitedTxParams extends ApproveTxBaseParams {
	amount?: undefined;
	unlimited: true;
}

export type ApproveTxParams = ApproveExactTxParams | ApproveUnlimitedTxParams;

export interface SendTxParams {
	sourceToken: TokenWithChainDetails;
	destinationToken: TokenWithChainDetails;
	amount: Amount | string | number;
	fromAccountAddress: string;
	toAccountAddress: string;
	minFinalityThreshold?: FinalityThreshold;
	maxFee?: Amount | string | number;
	destinationCaller?: string;
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

	async approve(params: ApproveTxParams): Promise<RawTransaction> {
		const { token, owner, expiresInLedgers } = params;
		const amount = this.approvalAmount(params);
		if (
			expiresInLedgers !== undefined &&
			!ledgerCountSchema.safeParse(expiresInLedgers).success
		) {
			throw new BridgeError("APPROVAL_EXPIRATION_INVALID");
		}
		const connector = this.connectorFor(token.network);
		return connector.buildApproveTx({
			network: token.network,
			token: this.toTokenAsset(token),
			owner,
			amount,
			expiresInLedgers,
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

		this.assertRecipient(destination, toAccountAddress);
		this.assertDestinationCaller(destination, params.destinationCaller);
		const token = this.toTokenAsset(sourceToken);
		const burnAmount = this.toBurnAmount(
			this.parseAmount(amount, sourceToken),
			token,
		);
		const minFinalityThreshold =
			params.minFinalityThreshold ?? FinalityThreshold.FAST;

		const maxFee =
			params.maxFee === undefined
				? await this.quotedMaxFee(
						source,
						destination,
						minFinalityThreshold,
						burnAmount,
					)
				: this.explicitMaxFee(params.maxFee, sourceToken, token, burnAmount);

		const hookData = this.hookDataFor(source, destination, toAccountAddress);
		const connector = this.connectorFor(source);
		return connector.buildBurnTx({
			source,
			destination,
			token,
			amount: burnAmount,
			from: fromAccountAddress,
			recipient: this.recipientFor(source, destination, toAccountAddress),
			maxFee,
			minFinalityThreshold,
			destinationCaller: params.destinationCaller,
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

	private approvalAmount(params: ApproveTxParams): Amount | undefined {
		if (params.unlimited === true) {
			if (params.amount !== undefined) {
				throw new BridgeError("APPROVAL_AMOUNT_CONFLICT");
			}
			return undefined;
		}
		if (params.amount === undefined) {
			throw new BridgeError("APPROVAL_AMOUNT_REQUIRED");
		}
		return this.parseAmount(params.amount, params.token);
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

	private async quotedMaxFee(
		source: Network,
		destination: Network,
		minFinalityThreshold: FinalityThreshold,
		burnAmount: Amount,
	): Promise<bigint> {
		const quote = await this.deps.feeService.getQuote({
			environment: source.environment,
			sourceDomain: source.cctpDomain,
			destinationDomain: destination.cctpDomain,
			minFinalityThreshold,
		});
		return FeeMath.maxFeeWithBuffer(burnAmount.raw, quote.feeBps);
	}

	private explicitMaxFee(
		maxFee: Amount | string | number,
		sourceToken: TokenWithChainDetails,
		token: TokenAsset,
		burnAmount: Amount,
	): bigint {
		const raw = this.parseAmount(maxFee, sourceToken).scaleTo(
			token.decimals,
		).raw;
		if (raw < 0n || raw >= burnAmount.raw) {
			throw new BridgeError("MAX_FEE_INVALID");
		}
		return raw;
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

	private assertRecipient(destination: Network, recipient: string): void {
		if (!recipient) {
			throw new BridgeError("RECIPIENT_REQUIRED");
		}
		if (!Address.validate(recipient, destination.family).valid) {
			throw new BridgeError(INVALID_RECIPIENT_CODE[destination.family]);
		}
	}

	private assertDestinationCaller(
		destination: Network,
		destinationCaller: string | undefined,
	): void {
		if (destinationCaller === undefined) {
			return;
		}
		if (destination.family === ChainFamily.STELLAR) {
			throw new BridgeError("DESTINATION_CALLER_UNSUPPORTED");
		}
		if (!Address.isEvm(destinationCaller)) {
			throw new BridgeError("DESTINATION_CALLER_INVALID");
		}
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

	private toBurnAmount(amount: Amount, token: TokenAsset): Amount {
		const burnAmount = amount
			.scaleTo(CCTP_AMOUNT_DECIMALS)
			.scaleTo(token.decimals);
		if (burnAmount.raw <= 0n) {
			throw new BridgeError("AMOUNT_TOO_SMALL");
		}
		return burnAmount;
	}

	private toTokenAsset(token: TokenWithChainDetails): TokenAsset {
		return token.network.token(token.symbol);
	}
}
