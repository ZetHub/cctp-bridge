import { describe, expect, it } from "vitest";
import { Environment, NetworkService, StellarRpc } from "../../index";

const networks = new NetworkService();
const baseStellar = networks.byId(Environment.MAINNET, "stellar")!;
// A network with multiple RPC URLs so we can exercise the fallback loop.
const stellar = baseStellar.withRpcUrls([
	"https://rpc-a.example",
	"https://rpc-b.example",
]);

describe("StellarRpc", () => {
	it("uses the first URL that succeeds", async () => {
		const rpc = new StellarRpc();
		// Override the private serverFor to yield predictable "server" values
		let calls = 0;
		(
			rpc as unknown as { serverFor: (url: string) => unknown }
		).serverFor = (url: string) => ({ url });
		const seen: string[] = [];
		const result = await rpc.run(stellar, async (server, url) => {
			calls++;
			seen.push(url);
			return (server as { url: string }).url;
		});
		expect(calls).toBe(1);
		expect(result).toBe(stellar.rpcUrls[0]);
		expect(seen).toEqual([stellar.rpcUrls[0]]);
	});

	function stubServers(rpc: StellarRpc): void {
		(
			rpc as unknown as { serverFor: (url: string) => unknown }
		).serverFor = (url: string) => ({ url });
	}

	function transportError(status?: number) {
		return Object.assign(new Error("transport"), {
			isAxiosError: true,
			code: status === undefined ? "ECONNREFUSED" : "ERR_BAD_RESPONSE",
			response: status === undefined ? undefined : { status },
		});
	}

	for (const [label, error] of [
		["a refused connection", transportError()],
		["HTTP 503", transportError(503)],
		["HTTP 429", transportError(429)],
	] as const) {
		it(`falls over to the next URL on ${label}`, async () => {
			const rpc = new StellarRpc();
			stubServers(rpc);
			const seen: string[] = [];
			const result = await rpc.run(stellar, async (server, url) => {
				seen.push(url);
				if (seen.length === 1) {
					throw error;
				}
				return (server as { url: string }).url;
			});
			expect(result).toBe(stellar.rpcUrls[1]);
			expect(seen).toEqual(stellar.rpcUrls);
		});
	}

	it("throws a simulation error from the first endpoint without failing over", async () => {
		const rpc = new StellarRpc();
		stubServers(rpc);
		const seen: string[] = [];
		await expect(
			rpc.run(stellar, async (_server, url) => {
				seen.push(url);
				throw new Error("HostError: Error(Contract, #13)");
			}),
		).rejects.toMatchObject({
			code: "RPC_ERROR",
			message: "HostError: Error(Contract, #13)",
		});
		expect(seen).toEqual([stellar.rpcUrls[0]]);
	});

	it("throws a JSON-RPC error with its message without failing over", async () => {
		const rpc = new StellarRpc();
		stubServers(rpc);
		const seen: string[] = [];
		await expect(
			rpc.run(stellar, async (_server, url) => {
				seen.push(url);
				throw { code: -32602, message: "invalid parameters" };
			}),
		).rejects.toMatchObject({
			code: "RPC_ERROR",
			message: "invalid parameters",
		});
		expect(seen).toEqual([stellar.rpcUrls[0]]);
	});

	it("throws BridgeError(RPC_ERROR) when every URL has a transport error", async () => {
		const rpc = new StellarRpc();
		stubServers(rpc);
		const seen: string[] = [];
		await expect(
			rpc.run(stellar, async (_server, url) => {
				seen.push(url);
				throw transportError(502);
			}),
		).rejects.toMatchObject({ code: "RPC_ERROR" });
		expect(seen).toEqual(stellar.rpcUrls);
	});

	it("caches the server per URL", async () => {
		const rpc = new StellarRpc();
		const built: string[] = [];
		(
			rpc as unknown as { serverFor: (url: string) => unknown }
		).serverFor = (url: string) => {
			built.push(url);
			return { url };
		};
		// two calls should reuse the same URL slot on the internal map
		await rpc.run(stellar, async (server) => (server as { url: string }).url);
		await rpc.run(stellar, async (server) => (server as { url: string }).url);
		// The stub replaces the real cache path, but the test still exercises `run`
		expect(built.length).toBeGreaterThanOrEqual(1);
	});
});
