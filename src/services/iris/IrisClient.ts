import { Environment } from "../../domain/enums";

export const IRIS_HOSTS: Record<Environment, string> = {
	[Environment.MAINNET]: "https://iris-api.circle.com",
	[Environment.TESTNET]: "https://iris-api-sandbox.circle.com",
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export interface IrisClientOptions {
	hosts?: Partial<Record<Environment, string>>;
	requestTimeoutMs?: number;
}

export abstract class IrisClient {
	private readonly hosts: Record<Environment, string>;
	private readonly requestTimeoutMs: number;

	constructor(options: IrisClientOptions = {}) {
		this.hosts = { ...IRIS_HOSTS, ...options.hosts };
		this.requestTimeoutMs =
			options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
	}

	host(environment: Environment): string {
		return this.hosts[environment];
	}

	protected request(url: string): Promise<Response> {
		return fetch(url, {
			headers: { Accept: "application/json" },
			cache: "no-store",
			signal: AbortSignal.timeout(this.requestTimeoutMs),
		});
	}

	protected async readBody(res: Response): Promise<string> {
		try {
			return await res.text();
		} catch {
			return "";
		}
	}

	protected toError(err: unknown): Error {
		return err instanceof Error ? err : new Error(String(err));
	}
}
