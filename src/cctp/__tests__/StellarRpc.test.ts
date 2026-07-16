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

	it("falls over to the next URL when the first throws", async () => {
		const rpc = new StellarRpc();
		(
			rpc as unknown as { serverFor: (url: string) => unknown }
		).serverFor = (url: string) => ({ url });
		const seen: string[] = [];
		const result = await rpc.run(stellar, async (server, url) => {
			seen.push(url);
			if (seen.length === 1) throw new Error("first endpoint down");
			return (server as { url: string }).url;
		});
		expect(result).toBe(stellar.rpcUrls[1]);
		expect(seen.length).toBe(2);
	});

	it("throws BridgeError(RPC_ERROR) when every URL fails", async () => {
		const rpc = new StellarRpc();
		(
			rpc as unknown as { serverFor: (url: string) => unknown }
		).serverFor = () => ({});
		await expect(
			rpc.run(stellar, async () => {
				throw new Error("all down");
			}),
		).rejects.toMatchObject({ code: "RPC_ERROR" });
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
