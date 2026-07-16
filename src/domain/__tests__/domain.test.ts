import { describe, expect, it } from "vitest";
import {
	Address,
	Amount,
	AssetSymbol,
	ChainFamily,
	Environment,
	Network,
	TokenAsset,
} from "../../index";

describe("Amount", () => {
	it("parses human input against chain family (EVM = 6 dp)", () => {
		expect(Amount.fromHuman("1.5", ChainFamily.EVM).raw).toBe(1_500_000n);
		expect(Amount.fromHuman("0", ChainFamily.EVM).raw).toBe(0n);
		expect(Amount.fromHuman(".", ChainFamily.EVM).raw).toBe(0n);
	});

	it("parses human input against chain family (Stellar = 7 dp)", () => {
		expect(Amount.fromHuman("1.5", ChainFamily.STELLAR).raw).toBe(15_000_000n);
	});

	it("formats subunits back to human, trimming zeros", () => {
		expect(Amount.fromRaw(1_500_000n, ChainFamily.EVM).toHuman()).toBe("1.5");
		expect(Amount.fromRaw(1_000_000n, ChainFamily.EVM).toHuman()).toBe("1");
		expect(Amount.fromRaw(1_234_500n, ChainFamily.EVM).toHuman(2)).toBe("1.23");
	});

	it("rescales between decimals", () => {
		expect(Amount.fromRaw(15_000_000n, ChainFamily.STELLAR).scaleTo(6).raw).toBe(
			1_500_000n,
		);
		expect(Amount.fromRaw(1_500_000n, ChainFamily.EVM).scaleTo(7).raw).toBe(
			15_000_000n,
		);
	});

	it("compares across decimals", () => {
		expect(
			Amount.fromRaw(2_000_000n, ChainFamily.EVM).gte(
				Amount.fromRaw(10_000_000n, ChainFamily.STELLAR),
			),
		).toBe(true);
		expect(Amount.fromRaw(1n, ChainFamily.EVM).isZero()).toBe(false);
		expect(Amount.fromRaw(0n, ChainFamily.EVM).isZero()).toBe(true);
	});

	it("rejects malformed input", () => {
		expect(() => Amount.fromHuman("1.2.3", ChainFamily.EVM)).toThrow();
		expect(() => Amount.fromHuman("abc", ChainFamily.EVM)).toThrow();
	});

	it("fromHumanWithDecimals is the escape hatch for arbitrary decimals", () => {
		expect(Amount.fromHumanWithDecimals("1.5", 18).raw).toBe(
			1_500_000_000_000_000_000n,
		);
	});

	it("fromRawWithDecimals is the escape hatch for non-USDC raw amounts", () => {
		expect(Amount.fromRawWithDecimals(1_500_000_000_000_000_000n, 18).toHuman())
			.toBe("1.5");
	});
});

describe("Address", () => {
	const evm = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
	const stellar = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

	it("detects families", () => {
		expect(Address.isEvm(evm)).toBe(true);
		expect(Address.isEvm(stellar)).toBe(false);
		expect(Address.isStellar(stellar)).toBe(true);
		expect(Address.isStellar(evm)).toBe(false);
	});

	it("validates with reasons", () => {
		expect(Address.validate(evm, ChainFamily.EVM).valid).toBe(true);
		expect(Address.validate("", ChainFamily.EVM)).toMatchObject({
			valid: false,
		});
		expect(Address.validate("bad", ChainFamily.STELLAR).valid).toBe(false);
	});

	it("constructs and compares", () => {
		const a = Address.for(evm, ChainFamily.EVM);
		expect(a.isEvm).toBe(true);
		expect(a.toEvm()).toBe(evm);
		expect(a.equals(Address.evm(evm))).toBe(true);
		expect(() => Address.stellar("nope")).toThrow();
	});

	it("serialises and stringifies by family", () => {
		const e = Address.evm(evm);
		const s = Address.stellar(stellar);
		expect(e.toString()).toBe(evm);
		expect(e.toJSON()).toEqual({ family: ChainFamily.EVM, value: evm });
		expect(s.toJSON()).toEqual({ family: ChainFamily.STELLAR, value: stellar });
		expect(s.isStellar).toBe(true);
		expect(e.equals(s)).toBe(false);
		expect(() => s.toEvm()).toThrow();
	});
});

describe("Amount edge cases", () => {
	it("formats negatives and honours display decimals", () => {
		expect(Amount.fromRaw(-1_500_000n, ChainFamily.EVM).toHuman()).toBe("-1.5");
		expect(Amount.fromRaw(-1_000_000n, ChainFamily.EVM).toHuman(0)).toBe("-1");
	});

	it("returns itself when rescaling to the same decimals", () => {
		const a = Amount.fromRaw(5n, ChainFamily.EVM);
		expect(a.scaleTo(6)).toBe(a);
	});
});

describe("Network + TokenAsset", () => {
	const network = new Network({
		id: "demo",
		name: "Demo",
		shortName: "D",
		family: ChainFamily.EVM,
		environment: Environment.TESTNET,
		cctpDomain: 0,
		evmChainId: 1,
		tokens: [
			new TokenAsset({
				symbol: AssetSymbol.USDC,
				name: "USD Coin",
				decimals: 6,
				address: "0xusdc",
			}),
		],
		tokenMessenger: "0xtm",
		messageTransmitter: "0xmt",
		rpcUrls: ["https://a"],
		explorerUrl: "https://x",
		accentColor: "#000",
	});

	it("resolves tokens and defaults", () => {
		expect(network.defaultAsset).toBe(AssetSymbol.USDC);
		expect(network.token().decimals).toBe(6);
		expect(network.hasToken(AssetSymbol.USDC)).toBe(true);
		expect(network.hasToken("UNKNOWN" as never)).toBe(false);
		expect(() => network.token("UNKNOWN" as never)).toThrow();
	});

	it("clones with new rpc urls", () => {
		const next = network.withRpcUrls(["https://b", "https://a"]);
		expect(next.rpcUrl).toBe("https://b");
		expect(network.rpcUrl).toBe("https://a");
	});

	it("requires at least one token", () => {
		expect(() => new Network({ ...network, tokens: [] })).toThrow();
	});

	it("requires at least one RPC URL", () => {
		expect(() => new Network({ ...network, rpcUrls: [] })).toThrow();
	});

	it("isEvm / isStellar helpers", () => {
		expect(network.isEvm()).toBe(true);
		expect(network.isStellar()).toBe(false);
	});
});

describe("Address error paths", () => {
	it("Address.evm throws on invalid input", () => {
		expect(() => Address.evm("nothex")).toThrow();
	});

	it("Address.stellar throws on invalid input", () => {
		expect(() => Address.stellar("badG")).toThrow();
	});

	it("Address.validate returns ADDRESS_REQUIRED for empty input", () => {
		expect(Address.validate("", ChainFamily.EVM)).toMatchObject({
			valid: false,
		});
	});

	it("Address.for dispatches by family", () => {
		const evm = Address.for(
			"0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
			ChainFamily.EVM,
		);
		expect(evm.isEvm).toBe(true);
		const stellar = Address.for(
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			ChainFamily.STELLAR,
		);
		expect(stellar.isStellar).toBe(true);
	});

	it("Address.checksumEvm throws on invalid input", () => {
		expect(() => Address.checksumEvm("notahex")).toThrow();
	});
});

describe("TokenAsset", () => {
	it("carries every prop through and is comparable", () => {
		const t = new TokenAsset({
			symbol: AssetSymbol.USDC,
			name: "USDC",
			decimals: 6,
			address: "0xa",
		});
		expect(t.symbol).toBe(AssetSymbol.USDC);
		expect(t.decimals).toBe(6);
		expect(t.address).toBe("0xa");
	});

	it("withAddress returns a new instance with the address swapped", () => {
		const t = new TokenAsset({
			symbol: AssetSymbol.USDC,
			name: "USDC",
			decimals: 6,
			address: "0xa",
		});
		const next = t.withAddress("0xb");
		expect(next.address).toBe("0xb");
		expect(next.symbol).toBe(t.symbol);
		expect(next).not.toBe(t);
	});
});

describe("Address getters", () => {
	it("value / family / isEvm / isStellar reflect construction", () => {
		const e = Address.evm("0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d");
		expect(e.value).toBe("0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d");
		expect(e.family).toBe(ChainFamily.EVM);
		expect(e.isEvm).toBe(true);
		expect(e.isStellar).toBe(false);
		const s = Address.stellar(
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		);
		expect(s.isStellar).toBe(true);
	});
});
