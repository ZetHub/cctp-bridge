import { describe, expect, it } from "vitest";
import {
	AssetSymbol,
	ChainFamily,
	Environment,
	NetworkId,
	ZetHubBridge,
} from "../../index";

describe("ZetHubBridge — construction", () => {
	it("defaults to mainnet", () => {
		const sdk = new ZetHubBridge();
		expect(sdk.environment).toBe(Environment.MAINNET);
	});

	it("switches environment via options", () => {
		const sdk = new ZetHubBridge({ environment: Environment.TESTNET });
		expect(sdk.environment).toBe(Environment.TESTNET);
	});

	it("exposes bridge and attestation APIs", () => {
		const sdk = new ZetHubBridge();
		expect(sdk.bridge).toBeDefined();
		expect(sdk.bridge.rawTxBuilder).toBeDefined();
		expect(sdk.attestation).toBeDefined();
	});
});

describe("ZetHubBridge — discovery", () => {
	it("chainDetailsMap covers every supported network", async () => {
		const sdk = new ZetHubBridge();
		const map = await sdk.chainDetailsMap();
		expect(map[NetworkId.ETHEREUM]).toBeDefined();
		expect(map[NetworkId.STELLAR]).toBeDefined();
		expect(map[NetworkId.ETHEREUM].network.family).toBe(ChainFamily.EVM);
		expect(map[NetworkId.STELLAR].network.family).toBe(ChainFamily.STELLAR);
	});

	it("tokens() flattens every token across chains", async () => {
		const sdk = new ZetHubBridge();
		const tokens = await sdk.tokens();
		const symbols = new Set(tokens.map((t) => t.symbol));
		expect(symbols.has(AssetSymbol.USDC)).toBe(true);
		for (const token of tokens) {
			expect(token.network).toBeDefined();
			expect(typeof token.chainSymbol).toBe("string");
		}
	});

	it("tokensByChain filters to a single network", async () => {
		const sdk = new ZetHubBridge();
		const tokens = await sdk.tokensByChain(NetworkId.BASE);
		for (const token of tokens) {
			expect(token.chainSymbol).toBe(NetworkId.BASE);
		}
	});

	it("supportedAssets is USDC-only for CCTP V2", () => {
		expect(new ZetHubBridge().supportedAssets()).toEqual([AssetSymbol.USDC]);
	});
});
