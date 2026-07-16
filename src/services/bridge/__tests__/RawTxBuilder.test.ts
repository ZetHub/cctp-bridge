import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Amount,
	AssetSymbol,
	ChainFamily,
	Environment,
	FinalityThreshold,
	MemoType,
	NetworkId,
	NetworkService,
	RawEvmTransaction,
	RawSorobanTransaction,
	type BuildApproveTxParams,
	type BuildBurnTxParams,
	type BuildReceiveTxParams,
	type FeeQuoteParams,
	type GetAllowanceOnChainParams,
	type GetNativeBalanceOnChainParams,
	type GetTokenBalanceOnChainParams,
	type IChainConnector,
	type IFeeService,
	type TokenWithChainDetails,
} from "../../../index";
import { DefaultRawTxBuilder } from "../RawTxBuilder";

class FakeConnector implements IChainConnector {
	readonly family: ChainFamily;
	readonly seen = {
		approve: [] as BuildApproveTxParams[],
		burn: [] as BuildBurnTxParams[],
		receive: [] as BuildReceiveTxParams[],
	};

	constructor(family: ChainFamily) {
		this.family = family;
	}

	async buildApproveTx(params: BuildApproveTxParams) {
		this.seen.approve.push(params);
		return this.family === ChainFamily.EVM
			? new RawEvmTransaction({
					chainId: 1,
					from: "0x0000000000000000000000000000000000000001",
					to: "0x0000000000000000000000000000000000000002",
					data: "0xdeadbeef",
				})
			: new RawSorobanTransaction({
					networkPassphrase: "Public Global Stellar Network ; September 2015",
					from: "GAAA",
					xdr: "AAAAxdr",
				});
	}

	async buildBurnTx(params: BuildBurnTxParams) {
		this.seen.burn.push(params);
		return this.buildApproveTx({} as BuildApproveTxParams);
	}

	async buildReceiveTx(params: BuildReceiveTxParams) {
		this.seen.receive.push(params);
		return this.buildApproveTx({} as BuildApproveTxParams);
	}

	async getAllowance(_p: GetAllowanceOnChainParams) {
		return Amount.fromRaw(0n, this.family);
	}
	async getTokenBalance(_p: GetTokenBalanceOnChainParams) {
		return Amount.fromRaw(0n, this.family);
	}
	async getNativeBalance(_p: GetNativeBalanceOnChainParams) {
		return Amount.fromRawWithDecimals(0n, 18);
	}
}

class FakeFeeService implements IFeeService {
	readonly seen: FeeQuoteParams[] = [];
	feeBps = 1.3;

	async getQuote(params: FeeQuoteParams) {
		this.seen.push(params);
		return {
			feeBps: this.feeBps,
			minFinalityThreshold: params.minFinalityThreshold,
			estimatedSeconds: 30,
		};
	}
}

const networks = new NetworkService();

function tokenFor(
	networkId: string,
	env: Environment = Environment.MAINNET,
): TokenWithChainDetails {
	const network = networks.byId(env, networkId);
	if (!network) throw new Error(`No network ${networkId}`);
	const token = network.token(AssetSymbol.USDC);
	return {
		symbol: token.symbol,
		name: token.name,
		decimals: token.decimals,
		address: token.address,
		issuer: token.issuer,
		assetCode: token.assetCode,
		logoUrl: token.logoUrl,
		chainSymbol: network.id,
		network,
	};
}

describe("DefaultRawTxBuilder", () => {
	let evm: FakeConnector;
	let stellar: FakeConnector;
	let fees: FakeFeeService;
	let builder: DefaultRawTxBuilder;

	beforeEach(() => {
		evm = new FakeConnector(ChainFamily.EVM);
		stellar = new FakeConnector(ChainFamily.STELLAR);
		fees = new FakeFeeService();
		builder = new DefaultRawTxBuilder({
			connectors: {
				[ChainFamily.EVM]: evm,
				[ChainFamily.STELLAR]: stellar,
			},
			networks,
			feeService: fees,
		});
	});

	describe("approve", () => {
		it("routes to the source connector", async () => {
			await builder.approve({
				token: tokenFor(NetworkId.BASE),
				owner: "0xowner",
				amount: "1.0",
			});
			expect(evm.seen.approve).toHaveLength(1);
			expect(stellar.seen.approve).toHaveLength(0);
		});

		it("parses the amount against source chain family", async () => {
			await builder.approve({
				token: tokenFor(NetworkId.BASE),
				owner: "0xowner",
				amount: "1.0",
			});
			expect(evm.seen.approve[0].amount?.raw).toBe(1_000_000n);
			expect(evm.seen.approve[0].amount?.decimals).toBe(6);
		});

		it("Stellar approve uses 7 decimals", async () => {
			await builder.approve({
				token: tokenFor(NetworkId.STELLAR),
				owner: "GAAA",
				amount: "1.0",
			});
			expect(stellar.seen.approve[0].amount?.raw).toBe(10_000_000n);
			expect(stellar.seen.approve[0].amount?.decimals).toBe(7);
		});

		it("passes undefined amount through for unlimited approval", async () => {
			await builder.approve({
				token: tokenFor(NetworkId.BASE),
				owner: "0xowner",
			});
			expect(evm.seen.approve[0].amount).toBeUndefined();
		});
	});

	describe("send — EVM to EVM", () => {
		it("routes to EVM connector with no hook data", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.BASE),
				destinationToken: tokenFor(NetworkId.ARBITRUM),
				amount: "5.0",
				fromAccountAddress: "0xfrom",
				toAccountAddress: "0xrecipient",
			});
			expect(evm.seen.burn).toHaveLength(1);
			const call = evm.seen.burn[0];
			expect(call.hookData).toBeUndefined();
			expect(call.recipient).toBe("0xrecipient");
			expect(call.from).toBe("0xfrom");
		});

		it("fetches a fee quote and applies the 20% buffer to maxFee", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.BASE),
				destinationToken: tokenFor(NetworkId.ARBITRUM),
				amount: "1000",
				fromAccountAddress: "0xfrom",
				toAccountAddress: "0xrecipient",
			});
			expect(fees.seen).toHaveLength(1);
			// 1.3 bps on 1000 USDC (1_000_000_000 subunits) = 130_000, buffered × 1.2 = 156_000
			expect(evm.seen.burn[0].maxFee).toBe(156_000n);
		});

		it("defaults min finality to FAST", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.BASE),
				destinationToken: tokenFor(NetworkId.ARBITRUM),
				amount: "1.0",
				fromAccountAddress: "0xfrom",
				toAccountAddress: "0xrecipient",
			});
			expect(evm.seen.burn[0].minFinalityThreshold).toBe(FinalityThreshold.FAST);
		});
	});

	describe("send — EVM to Stellar", () => {
		it("injects forwarder hook data and forwarder as recipient", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.BASE),
				destinationToken: tokenFor(NetworkId.STELLAR),
				amount: "5.0",
				fromAccountAddress: "0xfrom",
				toAccountAddress:
					"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			});
			const call = evm.seen.burn[0];
			expect(call.hookData).toBeDefined();
			expect(call.hookData?.startsWith("0x")).toBe(true);
			// recipient inside the burn tx is the forwarder, real recipient is in the hook
			expect(call.recipient).toBe(
				tokenFor(NetworkId.STELLAR).network.cctpForwarder,
			);
		});

		it("throws MISSING_FORWARDER if destination is missing forwarder config", async () => {
			const stellarToken = tokenFor(NetworkId.STELLAR);
			const patchedDestination: TokenWithChainDetails = {
				...stellarToken,
				network: {
					...stellarToken.network,
					cctpForwarder: undefined,
				} as unknown as (typeof stellarToken)["network"],
			};
			await expect(
				builder.send({
					sourceToken: tokenFor(NetworkId.BASE),
					destinationToken: patchedDestination,
					amount: "1.0",
					fromAccountAddress: "0xfrom",
					toAccountAddress:
						"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
				}),
			).rejects.toMatchObject({ code: "MISSING_FORWARDER" });
		});
	});

	describe("send — Stellar to EVM", () => {
		it("routes to Stellar connector with no hook data", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.STELLAR),
				destinationToken: tokenFor(NetworkId.BASE),
				amount: "5.0",
				fromAccountAddress: "GAAA",
				toAccountAddress: "0xrecipient",
			});
			expect(stellar.seen.burn).toHaveLength(1);
			expect(evm.seen.burn).toHaveLength(0);
			const call = stellar.seen.burn[0];
			expect(call.hookData).toBeUndefined();
			expect(call.recipient).toBe("0xrecipient");
		});

		it("propagates the memo through to the Stellar connector", async () => {
			await builder.send({
				sourceToken: tokenFor(NetworkId.STELLAR),
				destinationToken: tokenFor(NetworkId.BASE),
				amount: "5.0",
				fromAccountAddress: "GAAA",
				toAccountAddress: "0xrecipient",
				memo: { type: MemoType.TEXT, value: "test" },
			});
			expect(stellar.seen.burn[0].memo).toEqual({
				type: MemoType.TEXT,
				value: "test",
			});
		});
	});

	describe("send — error paths", () => {
		it("throws SAME_NETWORK when source and destination are equal", async () => {
			const token = tokenFor(NetworkId.BASE);
			await expect(
				builder.send({
					sourceToken: token,
					destinationToken: token,
					amount: "1.0",
					fromAccountAddress: "0xfrom",
					toAccountAddress: "0xrecipient",
				}),
			).rejects.toMatchObject({ code: "SAME_NETWORK" });
		});

		it("throws MISMATCHED_ENVIRONMENTS across mainnet and testnet", async () => {
			await expect(
				builder.send({
					sourceToken: tokenFor(NetworkId.BASE, Environment.MAINNET),
					destinationToken: tokenFor(
						NetworkId.ARBITRUM_SEPOLIA,
						Environment.TESTNET,
					),
					amount: "1.0",
					fromAccountAddress: "0xfrom",
					toAccountAddress: "0xrecipient",
				}),
			).rejects.toMatchObject({ code: "MISMATCHED_ENVIRONMENTS" });
			// no calls should have gone through to connectors
			expect(evm.seen.burn).toHaveLength(0);
			expect(fees.seen).toHaveLength(0);
		});

		it("throws UNSUPPORTED_ROUTE when no connector is registered for a family", async () => {
			const brokenBuilder = new DefaultRawTxBuilder({
				connectors: {
					[ChainFamily.EVM]: evm,
				} as unknown as Record<ChainFamily, IChainConnector>,
				networks,
				feeService: fees,
			});
			await expect(
				brokenBuilder.send({
					sourceToken: tokenFor(NetworkId.STELLAR),
					destinationToken: tokenFor(NetworkId.BASE),
					amount: "1.0",
					fromAccountAddress: "GAAA",
					toAccountAddress: "0xrecipient",
				}),
			).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
		});
	});

	describe("receive", () => {
		it("routes to the destination connector", async () => {
			await builder.receive({
				destinationToken: tokenFor(NetworkId.STELLAR),
				toAccountAddress: "GAAA",
				message: "0xdead",
				attestation: "0xbeef",
			});
			expect(stellar.seen.receive).toHaveLength(1);
			expect(stellar.seen.receive[0].message).toBe("0xdead");
			expect(stellar.seen.receive[0].attestation).toBe("0xbeef");
		});

		it("passes the recipient through unchanged", async () => {
			await builder.receive({
				destinationToken: tokenFor(NetworkId.ARBITRUM),
				toAccountAddress: "0xrecipient",
				message: "0xdead",
				attestation: "0xbeef",
			});
			expect(evm.seen.receive[0].to).toBe("0xrecipient");
		});
	});

	describe("Amount instance accepted directly", () => {
		it("passes an Amount through without re-parsing", async () => {
			const amount = Amount.fromRaw(4_242_424n, ChainFamily.EVM);
			await builder.approve({
				token: tokenFor(NetworkId.BASE),
				owner: "0xowner",
				amount,
			});
			expect(evm.seen.approve[0].amount?.raw).toBe(4_242_424n);
		});
	});

	// silence unused warning
	void vi;
});
