import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
	AssetSymbol,
	Environment,
	FinalityThreshold,
	IrisFeeService,
	NetworkId,
	ZetHubBridge,
	StellarRpc,
	StellarTrustline,
} from "../index";

/**
 * Network-hitting end-to-end tests. Gated behind RUN_INTEGRATION so unit runs
 * stay offline and deterministic. Enable with `pnpm test:integration`.
 */
const integration = describe.runIf(Boolean(process.env.RUN_INTEGRATION));

integration("e2e — Iris fees", () => {
	it("returns a live quote for a testnet route", async () => {
		const quote = await new IrisFeeService().getQuote({
			environment: Environment.TESTNET,
			sourceDomain: 6,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(typeof quote.feeBps).toBe("number");
		expect(quote.feeBps).toBeGreaterThanOrEqual(0);
		expect(quote.estimatedSeconds).toBeGreaterThan(0);
	});
});

integration("e2e — Stellar trustline validation", () => {
	const client = new ZetHubBridge({ environment: Environment.TESTNET });

	it("reports no trustline for a fresh account", async () => {
		const chains = await client.chainDetailsMap();
		const stellar = chains[NetworkId.STELLAR_TESTNET];
		const token = stellar.tokens.find((t) => t.symbol === AssetSymbol.USDC);
		if (!token) throw new Error("USDC not available on Stellar testnet");
		const fresh = Keypair.random().publicKey();
		const trustline = new StellarTrustline(new StellarRpc());
		const has = await trustline.has(
			stellar.network,
			fresh,
			stellar.network.token(AssetSymbol.USDC),
		);
		expect(has).toBe(false);
	});

	it("client.bridge.hasTrustline is false for a fresh account", async () => {
		const chains = await client.chainDetailsMap();
		const token = chains[NetworkId.STELLAR_TESTNET].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		);
		if (!token) throw new Error("USDC not available on Stellar testnet");
		const fresh = Keypair.random().publicKey();
		expect(
			await client.bridge.hasTrustline({ token, address: fresh }),
		).toBe(false);
	});

	it("non-Stellar networks always pass", async () => {
		const chains = await client.chainDetailsMap();
		const token = chains[NetworkId.BASE_SEPOLIA].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		);
		if (!token) throw new Error("USDC not available on Base Sepolia");
		expect(
			await client.bridge.hasTrustline({
				token,
				address: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
			}),
		).toBe(true);
	});
});

integration("e2e — live balance read", () => {
	it("reads a USDC balance via public RPC", async () => {
		const client = new ZetHubBridge({ environment: Environment.TESTNET });
		const chains = await client.chainDetailsMap();
		const token = chains[NetworkId.BASE_SEPOLIA].tokens.find(
			(t) => t.symbol === AssetSymbol.USDC,
		);
		if (!token) throw new Error("USDC not available on Base Sepolia");
		const balance = await client.getTokenBalance({
			token,
			address: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
		});
		expect(Number(balance)).toBeGreaterThanOrEqual(0);
	});
});
