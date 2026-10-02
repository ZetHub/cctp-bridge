import { rpc } from "@stellar/stellar-sdk";
import type { Network } from "../domain/Network";
import { BridgeError } from "../errors";
import {
	httpTransportErrorSchema,
	jsonRpcErrorSchema,
} from "../validation/schemas";

export type StellarRpcOp<T> = (server: rpc.Server, url: string) => Promise<T>;

export interface StellarRpcOptions {
	timeoutMs?: number;
}

const DEFAULT_RPC_TIMEOUT_MS = 30_000;

/**
 * Runs Soroban RPC calls against a network's configured endpoints, caching one
 * server per URL and failing over to the next endpoint on error.
 */
export class StellarRpc {
	private readonly servers = new Map<string, rpc.Server>();
	private readonly timeoutMs: number;

	constructor(options: StellarRpcOptions = {}) {
		this.timeoutMs = options.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
	}

	private serverFor(url: string): rpc.Server {
		let server = this.servers.get(url);
		if (!server) {
			server = new rpc.Server(url, { allowHttp: url.startsWith("http://") });
			this.servers.set(url, server);
		}
		return server;
	}

	async run<T>(network: Network, op: StellarRpcOp<T>): Promise<T> {
		let lastErr: unknown;
		for (const url of network.rpcUrls) {
			try {
				return await this.withTimeout(op(this.serverFor(url), url));
			} catch (err) {
				if (!this.isTransportError(err)) {
					throw this.toBridgeError(err);
				}
				lastErr = err;
			}
		}
		throw this.toBridgeError(lastErr);
	}

	private async withTimeout<T>(pending: Promise<T>): Promise<T> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new BridgeError("RPC_TIMEOUT")),
				this.timeoutMs,
			);
		});
		try {
			return await Promise.race([pending, timeout]);
		} finally {
			clearTimeout(timer);
		}
	}

	private isTransportError(err: unknown): boolean {
		if (err instanceof BridgeError) {
			return err.code === "RPC_TIMEOUT";
		}
		return httpTransportErrorSchema.safeParse(err).success;
	}

	private toBridgeError(err: unknown): BridgeError {
		const rpcError = jsonRpcErrorSchema.safeParse(err);
		if (rpcError.success) {
			return new BridgeError("RPC_ERROR", rpcError.data.message, err);
		}
		return BridgeError.from(err, "RPC_ERROR");
	}
}
