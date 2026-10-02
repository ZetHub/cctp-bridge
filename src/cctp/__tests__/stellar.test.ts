import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { xdrField } from "../../__tests__/xdr";
import {
	AssetSymbol,
	ChainFamily,
	Environment,
	MemoType,
	Network,
	StellarCodec,
	StellarPassphrase,
	TokenAsset,
} from "../../index";

function stellarNetwork(
	environment: Environment,
	passphrase?: string,
): Network {
	return new Network({
		id: `stellar-${environment}`,
		name: "Stellar",
		shortName: "XLM",
		family: ChainFamily.STELLAR,
		environment,
		cctpDomain: 27,
		stellarPassphrase: passphrase,
		tokens: [
			new TokenAsset({
				symbol: AssetSymbol.USDC,
				name: "USD Coin",
				decimals: 7,
				address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
			}),
		],
		tokenMessenger: "C_TM",
		messageTransmitter: "C_MT",
		rpcUrls: ["https://soroban"],
		explorerUrl: "https://x",
		accentColor: "#000",
	});
}

describe("StellarPassphrase", () => {
	it("prefers an explicit passphrase", () => {
		expect(
			StellarPassphrase.for(
				stellarNetwork(Environment.TESTNET, "Custom Passphrase"),
			),
		).toBe("Custom Passphrase");
	});

	it("falls back by environment", () => {
		expect(StellarPassphrase.for(stellarNetwork(Environment.TESTNET))).toBe(
			Networks.TESTNET,
		);
		expect(StellarPassphrase.for(stellarNetwork(Environment.MAINNET))).toBe(
			Networks.PUBLIC,
		);
	});
});

describe("StellarCodec memos", () => {
	it("builds hash and return memos", () => {
		const hash = "ab".repeat(32);
		expect(StellarCodec.memo({ type: MemoType.HASH, value: hash })).toBeDefined();
		expect(
			StellarCodec.memo({ type: MemoType.RETURN, value: `0x${hash}` }),
		).toBeDefined();
	});

	it("splits u128 into hi/lo parts", () => {
		const big = (1n << 64n) + 5n;
		const parts = StellarCodec.i128(big);
		expect(String(xdrField(parts, "hi"))).toBe("1");
		expect(String(xdrField(parts, "lo"))).toBe("5");
	});
});
