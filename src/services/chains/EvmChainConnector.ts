import {
	createPublicClient,
	encodeFunctionData,
	fallback,
	type Hex,
	http,
	maxUint256,
	type PublicClient,
} from "viem";
import {
	MESSAGE_TRANSMITTER_V2_ABI,
	TOKEN_MESSENGER_V2_ABI,
	USDC_ABI,
} from "../../cctp/abis";
import { CctpEncoder } from "../../cctp/CctpEncoder";
import { Amount } from "../../domain/Amount";
import { ChainFamily } from "../../domain/enums";
import type { Network } from "../../domain/Network";
import {
	RawEvmTransaction,
	type RawTransaction,
} from "../../domain/RawTransaction";
import { BridgeError } from "../../errors";
import type {
	BuildApproveTxParams,
	BuildBurnTxParams,
	BuildReceiveTxParams,
	GetAllowanceOnChainParams,
	GetNativeBalanceOnChainParams,
	GetTokenBalanceOnChainParams,
	IChainConnector,
} from "../../ports/IChainConnector";

const ZERO_BYTES32: Hex =
	"0x0000000000000000000000000000000000000000000000000000000000000000";

/** Chain connector for the EVM family. Wraps viem for reads; produces
 *  ready-to-sign `RawEvmTransaction`s for approve, burn, and receive. */
export class EvmChainConnector implements IChainConnector {
	readonly family = ChainFamily.EVM;

	private readonly clients = new Map<string, PublicClient>();

	async buildApproveTx(params: BuildApproveTxParams): Promise<RawTransaction> {
		const { network, token, owner, amount } = params;
		this.assertEvm(network);
		const chainId = this.requireChainId(network);
		const value = amount ? amount.scaleTo(token.decimals).raw : maxUint256;
		const data = encodeFunctionData({
			abi: USDC_ABI,
			functionName: "approve",
			args: [network.tokenMessenger as Hex, value],
		});
		return new RawEvmTransaction({
			chainId,
			from: owner as Hex,
			to: token.address as Hex,
			data,
		});
	}

	async buildBurnTx(params: BuildBurnTxParams): Promise<RawTransaction> {
		const { source, destination, token, amount, from, recipient, maxFee } =
			params;
		this.assertEvm(source);
		const chainId = this.requireChainId(source);
		const burnAmount = amount.scaleTo(token.decimals).raw;
		const mintRecipient =
			destination.family === ChainFamily.STELLAR
				? CctpEncoder.stellarAddressToBytes32(recipient)
				: CctpEncoder.evmAddressToBytes32(recipient);

		let data: Hex;
		if (params.hookData) {
			data = encodeFunctionData({
				abi: TOKEN_MESSENGER_V2_ABI,
				functionName: "depositForBurnWithHook",
				args: [
					burnAmount,
					destination.cctpDomain,
					mintRecipient,
					token.address as Hex,
					mintRecipient,
					maxFee,
					params.minFinalityThreshold,
					params.hookData,
				],
			});
		} else {
			data = encodeFunctionData({
				abi: TOKEN_MESSENGER_V2_ABI,
				functionName: "depositForBurn",
				args: [
					burnAmount,
					destination.cctpDomain,
					mintRecipient,
					token.address as Hex,
					ZERO_BYTES32,
					maxFee,
					params.minFinalityThreshold,
				],
			});
		}

		return new RawEvmTransaction({
			chainId,
			from: from as Hex,
			to: source.tokenMessenger as Hex,
			data,
		});
	}

	async buildReceiveTx(params: BuildReceiveTxParams): Promise<RawTransaction> {
		const { destination, to, message, attestation } = params;
		this.assertEvm(destination);
		const chainId = this.requireChainId(destination);
		const data = encodeFunctionData({
			abi: MESSAGE_TRANSMITTER_V2_ABI,
			functionName: "receiveMessage",
			args: [message, attestation],
		});
		return new RawEvmTransaction({
			chainId,
			from: to as Hex,
			to: destination.messageTransmitter as Hex,
			data,
		});
	}

	async getAllowance(params: GetAllowanceOnChainParams): Promise<Amount> {
		const { network, token, owner } = params;
		this.assertEvm(network);
		const client = this.clientFor(network);
		const raw = (await client.readContract({
			address: token.address as Hex,
			abi: USDC_ABI,
			functionName: "allowance",
			args: [owner as Hex, network.tokenMessenger as Hex],
		})) as bigint;
		return Amount.fromRaw(raw, network.family);
	}

	async getTokenBalance(params: GetTokenBalanceOnChainParams): Promise<Amount> {
		const { network, token, owner } = params;
		this.assertEvm(network);
		const client = this.clientFor(network);
		const raw = (await client.readContract({
			address: token.address as Hex,
			abi: USDC_ABI,
			functionName: "balanceOf",
			args: [owner as Hex],
		})) as bigint;
		return Amount.fromRaw(raw, network.family);
	}

	async getNativeBalance(
		params: GetNativeBalanceOnChainParams,
	): Promise<Amount> {
		const { network, owner } = params;
		this.assertEvm(network);
		const client = this.clientFor(network);
		const raw = await client.getBalance({ address: owner as Hex });
		return Amount.fromRawWithDecimals(raw, 18);
	}

	private clientFor(network: Network): PublicClient {
		const cached = this.clients.get(network.id);
		if (cached) {
			return cached;
		}
		const client = createPublicClient({
			transport: fallback(
				network.rpcUrls.map((url) => http(url, { retryCount: 2 })),
			),
		});
		this.clients.set(network.id, client);
		return client;
	}

	private assertEvm(network: Network): void {
		if (network.family !== ChainFamily.EVM) {
			throw new BridgeError(
				"UNSUPPORTED_ROUTE",
				`EvmChainConnector received non-EVM network ${network.id}`,
			);
		}
	}

	private requireChainId(network: Network): number {
		if (network.evmChainId == null) {
			throw new BridgeError("MISSING_EVM_CHAIN_ID");
		}
		return network.evmChainId;
	}
}
