import {
	Account,
	Address,
	Networks,
	TransactionBuilder,
	nativeToScVal,
	scValToNative,
	xdr,
	type rpc,
} from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Amount,
	AssetSymbol,
	ChainFamily,
	Environment,
	MemoType,
	NetworkId,
	NetworkService,
	StellarRpc,
	isRawSoroban,
	type StellarRpcOp,
	type Network,
} from "../../../index";
import { StellarChainConnector } from "../StellarChainConnector";

const networks = new NetworkService();
const stellar = networks.byId(Environment.MAINNET, NetworkId.STELLAR)!;
const base = networks.byId(Environment.MAINNET, NetworkId.BASE)!;

const SENDER_G = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const RECIPIENT_EVM = "0x9f70008A83912b19B3e64B58d5F4A08bBD7b3F0e";

interface FakeServerOptions {
	balance?: bigint;
	allowance?: bigint;
	nativeXlmStroops?: string;
}

function makeFakeServer(opts: FakeServerOptions = {}) {
	return {
		getAccount: async (address: string) => new Account(address, "42"),
		getLatestLedger: async () => ({ sequence: 100_000, id: "abc", protocolVersion: 22 }),
		prepareTransaction: async (tx: unknown) => tx as never,
		simulateTransaction: async (_tx: unknown) => ({
			result: {
				retval: nativeToScVal(opts.balance ?? opts.allowance ?? 0n, {
					type: "i128",
				}),
			},
		}),
		sendTransaction: async () => ({ hash: "sent", status: "PENDING", latestLedger: 1 }),
	} as unknown as rpc.Server;
}

class FakeStellarRpc extends StellarRpc {
	constructor(private readonly server: rpc.Server) {
		super();
	}
	async run<T>(_network: Network, op: StellarRpcOp<T>): Promise<T> {
		return op(this.server, "https://fake");
	}
}

function decodeInvoke(txXdr: string): xdr.HostFunction {
	const tx = TransactionBuilder.fromXDR(txXdr, Networks.PUBLIC);
	// biome-ignore lint/suspicious/noExplicitAny: introspecting a Soroban tx envelope
	const op = (tx as any).operations[0];
	return op.func;
}

function readInvocation(hostFn: xdr.HostFunction): {
	contractAddress: string;
	functionName: string;
	args: xdr.ScVal[];
} {
	const invoke = hostFn.invokeContract();
	return {
		contractAddress: Address.contract(
			invoke.contractAddress().contractId(),
		).toString(),
		functionName: invoke.functionName().toString(),
		args: invoke.args(),
	};
}

function i128Arg(arg: xdr.ScVal): bigint {
	expect(arg.switch().name).toBe("scvI128");
	return scValToNative(arg) as bigint;
}

describe("StellarChainConnector — approve", () => {
	let connector: StellarChainConnector;

	beforeEach(() => {
		connector = new StellarChainConnector(new FakeStellarRpc(makeFakeServer()));
	});

	it("builds a Soroban approve XDR against the USDC SAC", async () => {
		const tx = await connector.buildApproveTx({
			network: stellar,
			token: stellar.token(AssetSymbol.USDC),
			owner: SENDER_G,
			amount: Amount.fromRaw(5_000_000n, ChainFamily.STELLAR),
		});
		if (!isRawSoroban(tx)) throw new Error();
		expect(tx.from).toBe(SENDER_G);
		expect(tx.networkPassphrase).toBe(Networks.PUBLIC);
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(invocation.functionName).toBe("approve");
		expect(invocation.contractAddress).toBe(
			stellar.token(AssetSymbol.USDC).address,
		);
	});

	it("approves the amount in 7-decimal Stellar subunits", async () => {
		const tx = await connector.buildApproveTx({
			network: stellar,
			token: stellar.token(AssetSymbol.USDC),
			owner: SENDER_G,
			amount: Amount.fromHuman("1", ChainFamily.STELLAR),
		});
		if (!isRawSoroban(tx)) {
			throw new Error();
		}
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(i128Arg(invocation.args[2])).toBe(10_000_000n);
	});

	it("rescales a 6-decimal amount to Stellar subunits", async () => {
		const tx = await connector.buildApproveTx({
			network: stellar,
			token: stellar.token(AssetSymbol.USDC),
			owner: SENDER_G,
			amount: Amount.fromHuman("1", ChainFamily.EVM),
		});
		if (!isRawSoroban(tx)) {
			throw new Error();
		}
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(i128Arg(invocation.args[2])).toBe(10_000_000n);
	});
});

describe("StellarChainConnector — burn", () => {
	let connector: StellarChainConnector;

	beforeEach(() => {
		connector = new StellarChainConnector(new FakeStellarRpc(makeFakeServer()));
	});

	it("passes caller as the first arg to deposit_for_burn (regression: MismatchingParameterLen fix)", async () => {
		const tx = await connector.buildBurnTx({
			source: stellar,
			destination: base,
			token: stellar.token(AssetSymbol.USDC),
			amount: Amount.fromRaw(5_000_000n, ChainFamily.STELLAR),
			from: SENDER_G,
			recipient: RECIPIENT_EVM,
			maxFee: 6_000n,
			minFinalityThreshold: 1000,
		});
		if (!isRawSoroban(tx)) throw new Error();
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(invocation.functionName).toBe("deposit_for_burn");
		// The Soroban contract requires 8 args, first being the caller's Address.
		expect(invocation.args).toHaveLength(8);
		const callerArg = invocation.args[0];
		// The first arg is an ScAddress (account type)
		expect(callerArg.switch().name).toBe("scvAddress");
	});

	it("targets the TokenMessenger contract", async () => {
		const tx = await connector.buildBurnTx({
			source: stellar,
			destination: base,
			token: stellar.token(AssetSymbol.USDC),
			amount: Amount.fromRaw(5_000_000n, ChainFamily.STELLAR),
			from: SENDER_G,
			recipient: RECIPIENT_EVM,
			maxFee: 6_000n,
			minFinalityThreshold: 1000,
		});
		if (!isRawSoroban(tx)) throw new Error();
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(invocation.contractAddress).toBe(stellar.tokenMessenger);
	});

	it("burns the amount and max_fee in 7-decimal Stellar subunits", async () => {
		const tx = await connector.buildBurnTx({
			source: stellar,
			destination: base,
			token: stellar.token(AssetSymbol.USDC),
			amount: Amount.fromHuman("1", ChainFamily.STELLAR),
			from: SENDER_G,
			recipient: RECIPIENT_EVM,
			maxFee: 1_560n,
			minFinalityThreshold: 1000,
		});
		if (!isRawSoroban(tx)) {
			throw new Error();
		}
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(i128Arg(invocation.args[1])).toBe(10_000_000n);
		expect(i128Arg(invocation.args[6])).toBe(1_560n);
	});
});

describe("StellarChainConnector — receive", () => {
	let connector: StellarChainConnector;

	beforeEach(() => {
		connector = new StellarChainConnector(new FakeStellarRpc(makeFakeServer()));
	});

	it("builds mint_and_forward on the CctpForwarder", async () => {
		const tx = await connector.buildReceiveTx({
			destination: stellar,
			token: stellar.token(AssetSymbol.USDC),
			to: SENDER_G,
			message: "0xdead",
			attestation: "0xbeef",
		});
		if (!isRawSoroban(tx)) throw new Error();
		const invocation = readInvocation(decodeInvoke(tx.xdr));
		expect(invocation.functionName).toBe("mint_and_forward");
		expect(invocation.contractAddress).toBe(stellar.cctpForwarder);
		expect(invocation.args).toHaveLength(2); // just message + attestation
	});
});

describe("StellarChainConnector — reads", () => {
	it("getAllowance returns 0 when simulation returns 0", async () => {
		const connector = new StellarChainConnector(
			new FakeStellarRpc(makeFakeServer({ allowance: 0n })),
		);
		const result = await connector.getAllowance({
			network: stellar,
			token: stellar.token(AssetSymbol.USDC),
			owner: SENDER_G,
		});
		expect(result.raw).toBe(0n);
		expect(result.decimals).toBe(7);
	});

	it("getTokenBalance decodes the simulation retval", async () => {
		const connector = new StellarChainConnector(
			new FakeStellarRpc(makeFakeServer({ balance: 42_000_000n })),
		);
		const result = await connector.getTokenBalance({
			network: stellar,
			token: stellar.token(AssetSymbol.USDC),
			owner: SENDER_G,
		});
		expect(result.raw).toBe(42_000_000n);
		expect(result.decimals).toBe(7);
		expect(result.toHuman()).toBe("4.2");
	});
});

describe("StellarChainConnector — guard rails", () => {
	it("throws UNSUPPORTED_ROUTE on non-Stellar networks", async () => {
		const connector = new StellarChainConnector(
			new FakeStellarRpc(makeFakeServer()),
		);
		await expect(
			connector.buildApproveTx({
				network: base,
				token: base.token(AssetSymbol.USDC),
				owner: SENDER_G,
				amount: undefined,
			}),
		).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
	});

	it("throws MISSING_FORWARDER when destination has no forwarder", async () => {
		const connector = new StellarChainConnector(
			new FakeStellarRpc(makeFakeServer()),
		);
		const patched = {
			...stellar,
			cctpForwarder: undefined,
		} as unknown as typeof stellar;
		await expect(
			connector.buildReceiveTx({
				destination: patched,
				token: stellar.token(AssetSymbol.USDC),
				to: SENDER_G,
				message: "0xdead",
				attestation: "0xbeef",
			}),
		).rejects.toMatchObject({ code: "MISSING_FORWARDER" });
	});
});

// silence vi unused warning
void vi;
