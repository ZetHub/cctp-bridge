import { beforeEach, describe, expect, it } from "vitest";
import {
	AssetSymbol,
	Environment,
	NetworkService,
	StellarRpc,
	StellarTrustline,
	type Network,
	type StellarRpcOp,
} from "../../index";

const networks = new NetworkService();
const stellar = networks.byId(Environment.MAINNET, "stellar")!;

class FakeStellarRpc extends StellarRpc {
	entries: unknown[] = [];
	runs = 0;
	keys: unknown[] = [];
	async run<T>(_network: Network, op: StellarRpcOp<T>): Promise<T> {
		this.runs++;
		return op(
			{
				getLedgerEntries: async (key: unknown) => {
					this.keys.push(key);
					return { entries: this.entries };
				},
			} as never,
			"https://fake",
		);
	}
}

const BASE_G = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const MUXED_M =
	"MBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLEAAAAAAAAAAAFJN3W";

describe("StellarTrustline", () => {
	let rpc: FakeStellarRpc;
	let trustline: StellarTrustline;

	beforeEach(() => {
		rpc = new FakeStellarRpc();
		trustline = new StellarTrustline(rpc);
	});

	it("returns true for a contract address (C-prefix) without hitting RPC", async () => {
		const result = await trustline.has(
			stellar,
			"CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL",
			stellar.token(AssetSymbol.USDC),
		);
		expect(result).toBe(true);
		expect(rpc.runs).toBe(0);
	});

	it("returns true when the token has no assetCode/issuer metadata", async () => {
		const token = { ...stellar.token(AssetSymbol.USDC), assetCode: undefined };
		const result = await trustline.has(
			stellar,
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			token as never,
		);
		expect(result).toBe(true);
		expect(rpc.runs).toBe(0);
	});

	it("checks the base account's trustline for a muxed address", async () => {
		rpc.entries = [{}];
		const token = stellar.token(AssetSymbol.USDC);
		expect(await trustline.has(stellar, MUXED_M, token)).toBe(true);
		await trustline.has(stellar, BASE_G, token);
		expect(rpc.keys).toHaveLength(2);
		expect(rpc.keys[0]).toEqual(rpc.keys[1]);
	});

	it("throws RECIPIENT_INVALID_STELLAR for an invalid address without RPC", async () => {
		await expect(
			trustline.has(stellar, "GBAD", stellar.token(AssetSymbol.USDC)),
		).rejects.toMatchObject({ code: "RECIPIENT_INVALID_STELLAR" });
		expect(rpc.runs).toBe(0);
	});

	it("returns true when the ledger has a matching trustline entry", async () => {
		rpc.entries = [{}]; // any non-empty array
		const result = await trustline.has(
			stellar,
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			stellar.token(AssetSymbol.USDC),
		);
		expect(result).toBe(true);
		expect(rpc.runs).toBe(1);
	});

	it("returns false when the ledger has no matching entry", async () => {
		rpc.entries = [];
		const result = await trustline.has(
			stellar,
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			stellar.token(AssetSymbol.USDC),
		);
		expect(result).toBe(false);
	});
});
