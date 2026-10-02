import { describe, expect, it } from "vitest";
import {
	AttestationTime,
	Environment,
	mainnet,
	NetworkId,
	NetworkService,
	testnet,
} from "../../../index";

describe("NetworkService", () => {
	const service = new NetworkService();

	it("list() returns every network for the given environment", () => {
		expect(service.list(Environment.MAINNET).length).toBeGreaterThan(0);
		expect(service.list(Environment.TESTNET).length).toBeGreaterThan(0);
	});

	it("byId resolves to the network for a known id", () => {
		const base = service.byId(Environment.MAINNET, NetworkId.BASE);
		expect(base?.id).toBe(NetworkId.BASE);
		expect(base?.evmChainId).toBe(8453);
	});

	it("byId returns undefined for an unknown id", () => {
		expect(
			service.byId(Environment.MAINNET, "not-a-real-chain"),
		).toBeUndefined();
	});

	it("byDomain resolves by CCTP domain", () => {
		expect(service.byDomain(Environment.MAINNET, 0)?.id).toBe(NetworkId.ETHEREUM);
		expect(service.byDomain(Environment.MAINNET, 27)?.id).toBe(NetworkId.STELLAR);
	});

	it("byDomain returns undefined for an unknown domain", () => {
		expect(service.byDomain(Environment.MAINNET, 9999)).toBeUndefined();
	});

	it("byEvmChainId resolves EVM chains by chain id", () => {
		expect(service.byEvmChainId(Environment.MAINNET, 1)?.id).toBe(
			NetworkId.ETHEREUM,
		);
		expect(service.byEvmChainId(Environment.MAINNET, 8453)?.id).toBe(
			NetworkId.BASE,
		);
	});

	it("byEvmChainId returns undefined for non-EVM lookups", () => {
		expect(
			service.byEvmChainId(Environment.MAINNET, 9_999_999),
		).toBeUndefined();
	});
});

describe("network attestation times", () => {
	const all = [...mainnet, ...testnet];

	it("gives every built-in network Circle's numbers, not the generic fallback", () => {
		for (const network of all) {
			expect(network.attestationTime).not.toBe(AttestationTime.GENERIC);
		}
	});

	it("marks the chains Circle lists without Fast Transfer", () => {
		const standardOnly = all
			.filter((n) => !n.attestationTime.supportsFast)
			.map((n) => n.id)
			.sort();
		expect(standardOnly).toEqual(
			[
				NetworkId.AVALANCHE,
				NetworkId.AVALANCHE_FUJI,
				NetworkId.HYPEREVM,
				NetworkId.POLYGON,
				NetworkId.POLYGON_AMOY,
				NetworkId.SEI,
				NetworkId.SONIC,
				NetworkId.STELLAR,
				NetworkId.STELLAR_TESTNET,
			].sort(),
		);
	});

	it("keeps the attestation time when RPC URLs are overridden", () => {
		const stellar = mainnet.find((n) => n.id === NetworkId.STELLAR);
		if (!stellar) {
			throw new Error();
		}
		expect(stellar.withRpcUrls(["https://x.example"]).attestationTime).toBe(
			stellar.attestationTime,
		);
	});
});
