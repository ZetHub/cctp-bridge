import { decodeFunctionData, type Hex, toFunctionSelector } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Amount,
	AssetSymbol,
	CctpEncoder,
	ChainFamily,
	Environment,
	MESSAGE_TRANSMITTER_V2_ABI,
	NetworkId,
	NetworkService,
	TOKEN_MESSENGER_V2_ABI,
	USDC_ABI,
	isRawEvm,
} from "../../../index";
import { EvmChainConnector } from "../EvmChainConnector";

const CctpEncoderForTest = CctpEncoder;

const networks = new NetworkService();
const OWNER = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d" as Hex;
const RECIPIENT_EVM = "0x9F70008A83912b19B3E64B58D5f4A08bBd7b3F0e" as Hex;
const RECIPIENT_STELLAR =
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const base = networks.byId(Environment.MAINNET, NetworkId.BASE)!;
const arb = networks.byId(Environment.MAINNET, NetworkId.ARBITRUM)!;
const stellar = networks.byId(Environment.MAINNET, NetworkId.STELLAR)!;

describe("EvmChainConnector — pure tx builders", () => {
	const connector = new EvmChainConnector();

	describe("buildApproveTx", () => {
		it("returns a RawEvmTransaction targeting the USDC token", async () => {
			const tx = await connector.buildApproveTx({
				network: base,
				token: base.token(AssetSymbol.USDC),
				owner: OWNER,
				amount: Amount.fromRaw(1_000_000n, ChainFamily.EVM),
			});
			expect(isRawEvm(tx)).toBe(true);
			if (!isRawEvm(tx)) throw new Error("not evm");
			expect(tx.chainId).toBe(base.evmChainId);
			expect(tx.from).toBe(OWNER);
			expect(tx.to).toBe(base.token(AssetSymbol.USDC).address);
		});

		it("encodes USDC.approve(spender=tokenMessenger, amount)", async () => {
			const tx = await connector.buildApproveTx({
				network: base,
				token: base.token(AssetSymbol.USDC),
				owner: OWNER,
				amount: Amount.fromRaw(2_500_000n, ChainFamily.EVM),
			});
			if (!isRawEvm(tx)) throw new Error();
			const decoded = decodeFunctionData({ abi: USDC_ABI, data: tx.data });
			expect(decoded.functionName).toBe("approve");
			expect(decoded.args[0]).toBe(base.tokenMessenger);
			expect(decoded.args[1]).toBe(2_500_000n);
		});

		it("uses maxUint256 when amount is undefined (unlimited approve)", async () => {
			const tx = await connector.buildApproveTx({
				network: base,
				token: base.token(AssetSymbol.USDC),
				owner: OWNER,
				amount: undefined,
			});
			if (!isRawEvm(tx)) throw new Error();
			const decoded = decodeFunctionData({ abi: USDC_ABI, data: tx.data });
			expect(decoded.args[1]).toBe(2n ** 256n - 1n);
		});
	});

	describe("buildBurnTx", () => {
		it("encodes depositForBurn for EVM→EVM (no hook)", async () => {
			const tx = await connector.buildBurnTx({
				source: base,
				destination: arb,
				token: base.token(AssetSymbol.USDC),
				amount: Amount.fromRaw(5_000_000n, ChainFamily.EVM),
				from: OWNER,
				recipient: RECIPIENT_EVM,
				maxFee: 6_000n,
				minFinalityThreshold: 1000,
			});
			if (!isRawEvm(tx)) throw new Error();
			expect(tx.chainId).toBe(base.evmChainId);
			expect(tx.to).toBe(base.tokenMessenger);
			const decoded = decodeFunctionData({
				abi: TOKEN_MESSENGER_V2_ABI,
				data: tx.data,
			});
			expect(decoded.functionName).toBe("depositForBurn");
			expect(decoded.args[0]).toBe(5_000_000n); // amount
			expect(decoded.args[1]).toBe(arb.cctpDomain); // destinationDomain
			// mintRecipient is bytes32(recipient) — padded 0x + 24 zeros + 40 hex
			expect(decoded.args[2]).toBe(
				`0x000000000000000000000000${RECIPIENT_EVM.slice(2).toLowerCase()}`,
			);
			expect(decoded.args[3]).toBe(base.token(AssetSymbol.USDC).address); // burnToken
			expect(decoded.args[5]).toBe(6_000n); // maxFee
			expect(decoded.args[6]).toBe(1000); // finality
		});

		it("encodes depositForBurnWithHook for EVM→Stellar", async () => {
			const forwarder = stellar.cctpForwarder!;
			const hookData: Hex = "0x1234";
			const tx = await connector.buildBurnTx({
				source: base,
				destination: stellar,
				token: base.token(AssetSymbol.USDC),
				amount: Amount.fromRaw(5_000_000n, ChainFamily.EVM),
				from: OWNER,
				recipient: forwarder,
				maxFee: 6_000n,
				minFinalityThreshold: 1000,
				hookData,
			});
			if (!isRawEvm(tx)) throw new Error();
			const decoded = decodeFunctionData({
				abi: TOKEN_MESSENGER_V2_ABI,
				data: tx.data,
			});
			expect(decoded.functionName).toBe("depositForBurnWithHook");
			// mintRecipient must be the Stellar forwarder as bytes32, not padded EVM
			expect(decoded.args[2]).toBe(
				CctpEncoderForTest.stellarAddressToBytes32(forwarder),
			);
			expect(decoded.args[7]).toBe(hookData);
		});
	});

	describe("buildReceiveTx", () => {
		it("encodes receiveMessage(message, attestation)", async () => {
			const tx = await connector.buildReceiveTx({
				destination: arb,
				token: arb.token(AssetSymbol.USDC),
				to: RECIPIENT_EVM,
				message: "0xdeadbeef",
				attestation: "0xcafe",
			});
			if (!isRawEvm(tx)) throw new Error();
			expect(tx.chainId).toBe(arb.evmChainId);
			expect(tx.to).toBe(arb.messageTransmitter);
			const decoded = decodeFunctionData({
				abi: MESSAGE_TRANSMITTER_V2_ABI,
				data: tx.data,
			});
			expect(decoded.functionName).toBe("receiveMessage");
			expect(decoded.args[0]).toBe("0xdeadbeef");
			expect(decoded.args[1]).toBe("0xcafe");
		});
	});

	describe("guard rails", () => {
		it("throws UNSUPPORTED_ROUTE for non-EVM networks", async () => {
			await expect(
				connector.buildApproveTx({
					network: stellar,
					token: stellar.token(AssetSymbol.USDC),
					owner: OWNER,
					amount: undefined,
				}),
			).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
		});
	});
});

describe("EvmChainConnector — reads (mocked viem client)", () => {
	let connector: EvmChainConnector;
	let readContract: ReturnType<typeof vi.fn>;
	let getBalance: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		readContract = vi.fn();
		getBalance = vi.fn();
		connector = new EvmChainConnector();
		// swap the internal client factory for a stub — property is private
		// (used internally by getAllowance / getTokenBalance / getNativeBalance)
		(connector as unknown as { clientFor: () => unknown }).clientFor = () => ({
			readContract,
			getBalance,
		});
	});

	it("getAllowance reads USDC.allowance and wraps as USDC Amount", async () => {
		readContract.mockResolvedValueOnce(1_234_567n);
		const result = await connector.getAllowance({
			network: base,
			token: base.token(AssetSymbol.USDC),
			owner: OWNER,
		});
		expect(result.raw).toBe(1_234_567n);
		expect(result.decimals).toBe(6);
		const call = readContract.mock.calls[0][0];
		expect(call.functionName).toBe("allowance");
		expect(call.args).toEqual([OWNER, base.tokenMessenger]);
	});

	it("getTokenBalance reads USDC.balanceOf", async () => {
		readContract.mockResolvedValueOnce(9_876_543n);
		const result = await connector.getTokenBalance({
			network: base,
			token: base.token(AssetSymbol.USDC),
			owner: OWNER,
		});
		expect(result.raw).toBe(9_876_543n);
		expect(result.decimals).toBe(6);
		const call = readContract.mock.calls[0][0];
		expect(call.functionName).toBe("balanceOf");
	});

	it("getNativeBalance uses 18 decimals (ETH-like)", async () => {
		getBalance.mockResolvedValueOnce(500_000_000_000_000_000n);
		const result = await connector.getNativeBalance({
			network: base,
			owner: OWNER,
		});
		expect(result.raw).toBe(500_000_000_000_000_000n);
		expect(result.decimals).toBe(18);
		expect(result.toHuman()).toBe("0.5");
	});
});

describe("EvmChainConnector — clientFor cache", () => {
	it("creates and caches a viem PublicClient per network", async () => {
		const connector = new EvmChainConnector();
		// Trigger the private clientFor path via any read method. The actual
		// getBalance call fires against a bogus URL and will reject, but the
		// client cache is populated before that. Swallow the network error.
		try {
			await connector.getNativeBalance({ network: base, owner: OWNER });
		} catch {
			// expected — no live RPC in the test environment
		}
		const clients = (
			connector as unknown as { clients: Map<string, unknown> }
		).clients;
		expect(clients.get(base.id)).toBeDefined();
		// A second call for the same network should reuse the same instance.
		const cached = clients.get(base.id);
		try {
			await connector.getNativeBalance({ network: base, owner: OWNER });
		} catch {
			// same
		}
		expect(clients.get(base.id)).toBe(cached);
	});
});

// keep the linter honest about unused import (used only to double-check selectors)
void toFunctionSelector;
