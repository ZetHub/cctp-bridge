import { describe, expect, it } from "vitest";
import { Environment, NetworkId, NetworkService } from "../../../index";

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
