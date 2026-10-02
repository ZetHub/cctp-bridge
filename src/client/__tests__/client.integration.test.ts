import { describe, expect, it, vi } from "vitest";
import {
	Amount,
	AssetSymbol,
	AttestationStatus,
	ChainFamily,
	Environment,
	FinalityThreshold,
	NetworkId,
	RawEvmTransaction,
	RawSorobanTransaction,
	ZetHubBridge,
	type AttestationResult,
	type BuildApproveTxParams,
	type BuildBurnTxParams,
	type BuildReceiveTxParams,
	type FeeQuoteParams,
	type GetAllowanceOnChainParams,
	type GetNativeBalanceOnChainParams,
	type GetTokenBalanceOnChainParams,
	type IAttestationService,
	type IChainConnector,
	type IFeeService,
	type WaitForAttestationParams,
} from "../../index";

/** Recording connector — captures the params it was called with and returns
 *  canned raw transactions so the client's plumbing can be exercised without
 *  hitting any network. */
class RecordingConnector implements IChainConnector {
	readonly family: ChainFamily;
	readonly seenAllowance: GetAllowanceOnChainParams[] = [];
	readonly seenTokenBalance: GetTokenBalanceOnChainParams[] = [];
	readonly seenNativeBalance: GetNativeBalanceOnChainParams[] = [];
	tokenBalance = 1_000_000n;
	allowance = 500_000n;

	constructor(family: ChainFamily) {
		this.family = family;
	}

	async buildApproveTx(_p: BuildApproveTxParams) {
		return this.family === ChainFamily.EVM
			? new RawEvmTransaction({
					chainId: 1,
					from: "0x0000000000000000000000000000000000000001",
					to: "0x0000000000000000000000000000000000000002",
					data: "0xdead",
				})
			: new RawSorobanTransaction({
					networkPassphrase: "x",
					from: "GAAA",
					xdr: "AAAA",
				});
	}
	async buildBurnTx(_p: BuildBurnTxParams) {
		return this.buildApproveTx({} as BuildApproveTxParams);
	}
	async buildReceiveTx(_p: BuildReceiveTxParams) {
		return this.buildApproveTx({} as BuildApproveTxParams);
	}
	async getAllowance(p: GetAllowanceOnChainParams) {
		this.seenAllowance.push(p);
		return Amount.fromRaw(this.allowance, this.family);
	}
	async getTokenBalance(p: GetTokenBalanceOnChainParams) {
		this.seenTokenBalance.push(p);
		return Amount.fromRaw(this.tokenBalance, this.family);
	}
	async getNativeBalance(p: GetNativeBalanceOnChainParams) {
		this.seenNativeBalance.push(p);
		return Amount.fromRawWithDecimals(2_500_000_000_000_000_000n, 18);
	}
}

class RecordingFeeService implements IFeeService {
	readonly seen: FeeQuoteParams[] = [];
	async getQuote(params: FeeQuoteParams) {
		this.seen.push(params);
		return {
			feeBps: 1.3,
			minFinalityThreshold: params.minFinalityThreshold,
			estimatedSeconds: 30,
		};
	}
}

class RecordingAttestationService implements IAttestationService {
	readonly seen: WaitForAttestationParams[] = [];
	host(env: Environment) {
		return `https://iris-${env}.example`;
	}
	async waitForAttestation(
		params: WaitForAttestationParams,
	): Promise<AttestationResult> {
		this.seen.push(params);
		params.onPoll?.({ attempt: 1, status: AttestationStatus.COMPLETE });
		return {
			message: "0xdead",
			attestation: "0xbeef",
			eventNonce: "42",
			status: AttestationStatus.COMPLETE,
		};
	}
}

function make() {
	const evm = new RecordingConnector(ChainFamily.EVM);
	const stellar = new RecordingConnector(ChainFamily.STELLAR);
	const fees = new RecordingFeeService();
	const attestation = new RecordingAttestationService();
	const sdk = new ZetHubBridge({
		connectors: {
			[ChainFamily.EVM]: evm,
			[ChainFamily.STELLAR]: stellar,
		},
		fees,
		attestation,
	});
	return { sdk, evm, stellar, fees, attestation };
}

describe("ZetHubBridge — balance API", () => {
	it("getTokenBalance returns a human string via the source connector", async () => {
		const { sdk, evm } = make();
		const chains = await sdk.chainDetailsMap();
		const token = chains[NetworkId.BASE].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		)!;
		evm.tokenBalance = 5_500_000n;
		const balance = await sdk.getTokenBalance({
			token,
			address: "0xowner",
		});
		expect(balance).toBe("5.5");
		expect(evm.seenTokenBalance).toHaveLength(1);
	});

	it("getNativeTokenBalance uses 18-decimal ETH-like output", async () => {
		const { sdk, evm } = make();
		const balance = await sdk.getNativeTokenBalance({
			chainSymbol: NetworkId.BASE,
			address: "0xowner",
		});
		expect(balance).toBe("2.5");
		expect(evm.seenNativeBalance).toHaveLength(1);
	});

	it("getGasBalance is an alias for getNativeTokenBalance", async () => {
		const { sdk } = make();
		expect(
			await sdk.getGasBalance({
				chainSymbol: NetworkId.BASE,
				address: "0xowner",
			}),
		).toBe("2.5");
	});
});

describe("ZetHubBridge — bridge API", () => {
	it("getAllowance returns a human string", async () => {
		const { sdk, evm } = make();
		const chains = await sdk.chainDetailsMap();
		const token = chains[NetworkId.BASE].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		)!;
		evm.allowance = 750_000n;
		const allowance = await sdk.bridge.getAllowance({
			token,
			owner: "0xowner",
		});
		expect(allowance).toBe("0.75");
	});

	it("checkAllowance is true when allowance covers amount", async () => {
		const { sdk, evm } = make();
		const chains = await sdk.chainDetailsMap();
		const token = chains[NetworkId.BASE].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		)!;
		evm.allowance = 5_000_000n;
		expect(
			await sdk.bridge.checkAllowance({
				token,
				owner: "0xowner",
				amount: "3.0",
			}),
		).toBe(true);
		expect(
			await sdk.bridge.checkAllowance({
				token,
				owner: "0xowner",
				amount: "10.0",
			}),
		).toBe(false);
	});

	it("quote calls the fee service with the right domains", async () => {
		const { sdk, fees } = make();
		const chains = await sdk.chainDetailsMap();
		const base = chains[NetworkId.BASE].tokens[0];
		const arb = chains[NetworkId.ARBITRUM].tokens[0];
		const result = await sdk.bridge.quote({
			sourceToken: base,
			destinationToken: arb,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(result.feeBps).toBe(1.3);
		expect(fees.seen[0]).toMatchObject({
			sourceDomain: base.network.cctpDomain,
			destinationDomain: arb.network.cctpDomain,
			minFinalityThreshold: FinalityThreshold.FAST,
			environment: Environment.MAINNET,
		});
	});

	it("hasTrustline returns true for EVM destinations without querying anything", async () => {
		const { sdk } = make();
		const chains = await sdk.chainDetailsMap();
		const token = chains[NetworkId.BASE].tokens[0];
		expect(
			await sdk.bridge.hasTrustline({
				token,
				address: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
			}),
		).toBe(true);
	});
});

describe("ZetHubBridge — attestation API", () => {
	it("waitFor passes through and returns an AttestationEnvelope", async () => {
		const { sdk, attestation } = make();
		const onPoll = vi.fn();
		const result = await sdk.attestation.waitFor(NetworkId.BASE, "0xburn", {
			onPoll,
		});
		expect(result.message).toBe("0xdead");
		expect(result.attestation).toBe("0xbeef");
		expect(result.status).toBe(AttestationStatus.COMPLETE);
		expect(onPoll).toHaveBeenCalledWith({
			attempt: 1,
			status: AttestationStatus.COMPLETE,
		});
		expect(attestation.seen[0]).toMatchObject({
			sourceDomain: 6, // Base
			environment: Environment.MAINNET,
			transactionHash: "0xburn",
		});
	});

	it("waitFor forwards intervalMs and timeoutMs", async () => {
		const { sdk, attestation } = make();
		await sdk.attestation.waitFor(NetworkId.BASE, "0xburn", {
			intervalMs: 100,
			timeoutMs: 5_000,
		});
		expect(attestation.seen[0].intervalMs).toBe(100);
		expect(attestation.seen[0].timeoutMs).toBe(5_000);
	});

	it("throws MISSING_SOURCE on an unknown network id", async () => {
		const { sdk } = make();
		await expect(
			sdk.attestation.waitFor(
				"not-a-real-chain" as never,
				"0xburn",
			),
		).rejects.toMatchObject({ code: "MISSING_SOURCE" });
	});
});

describe("ZetHubBridge — rawTxBuilder wiring", () => {
	it("sdk.bridge.rawTxBuilder.send resolves via the RawTxBuilder + connector chain", async () => {
		const { sdk, evm } = make();
		const chains = await sdk.chainDetailsMap();
		const source = chains[NetworkId.BASE].tokens[0];
		const destination = chains[NetworkId.ARBITRUM].tokens[0];
		const tx = await sdk.bridge.rawTxBuilder.send({
			sourceToken: source,
			destinationToken: destination,
			amount: "1.0",
			fromAccountAddress: "0xfrom",
			toAccountAddress: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
		});
		expect(tx).toBeInstanceOf(RawEvmTransaction);
		// evm.seenTokenBalance was not called for a send, but buildBurnTx was
		expect(evm.seenAllowance).toHaveLength(0);
	});
});

describe("ZetHubBridge — RPC overrides", () => {
	it("prepends custom RPC URLs onto the network's built-in defaults", async () => {
		const sdk = new ZetHubBridge({
			rpc: {
				[NetworkId.BASE]: ["https://your-node.example"],
			},
		});
		const chains = await sdk.chainDetailsMap();
		const base = chains[NetworkId.BASE].network;
		expect(base.rpcUrls[0]).toBe("https://your-node.example");
		expect(base.rpcUrls.length).toBeGreaterThan(1); // defaults still there
	});

	it("leaves untouched networks alone when only one is overridden", async () => {
		const sdk = new ZetHubBridge({
			rpc: {
				[NetworkId.BASE]: ["https://your-node.example"],
			},
		});
		const chains = await sdk.chainDetailsMap();
		const eth = chains[NetworkId.ETHEREUM].network;
		expect(eth.rpcUrls.some((u) => u.includes("your-node"))).toBe(false);
	});

	it("skips overrides that are empty or missing", async () => {
		const sdk = new ZetHubBridge({
			rpc: {
				[NetworkId.BASE]: [],
			},
		});
		const chains = await sdk.chainDetailsMap();
		expect(chains[NetworkId.BASE].network.rpcUrls[0]).toBe(
			"https://mainnet.base.org",
		);
	});

	it("passes through unchanged when no rpc option is provided", async () => {
		const sdk = new ZetHubBridge();
		const chains = await sdk.chainDetailsMap();
		expect(chains[NetworkId.BASE].network.rpcUrls.length).toBeGreaterThan(0);
	});
});
