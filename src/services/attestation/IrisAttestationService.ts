import { AttestationStatus, Environment } from "../../domain/enums";
import {
	AttestationTimeoutError,
	BridgeError,
	IrisRequestError,
} from "../../errors";
import type {
	AttestationResult,
	IAttestationService,
	WaitForAttestationParams,
} from "../../ports/IAttestationService";
import { txHashSchema } from "../../validation/schemas";

const DEFAULT_HOSTS: Record<Environment, string> = {
	[Environment.MAINNET]: "https://iris-api.circle.com",
	[Environment.TESTNET]: "https://iris-api-sandbox.circle.com",
};

const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

const RATE_LIMIT_BLOCK_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60_000;
const MS_PER_SECOND = 1000;

interface IrisMessage {
	attestation: `0x${string}` | "PENDING";
	message: `0x${string}` | null;
	eventNonce: string;
	status: AttestationStatus;
	delayReason?: string;
}

interface IrisMessagesResponse {
	messages?: IrisMessage[];
}

const PollOutcome = {
	READY: "ready",
	PENDING: "pending",
	RATE_LIMITED: "rate_limited",
	FAILED: "failed",
} as const;

type PollOutcome = (typeof PollOutcome)[keyof typeof PollOutcome];

interface IrisPoll {
	readonly outcome: PollOutcome;
	readonly httpStatus?: number;
	readonly message?: IrisMessage;
	readonly retryAfterMs?: number;
	readonly error?: Error;
}

export interface IrisAttestationOptions {
	hosts?: Partial<Record<Environment, string>>;
	defaultIntervalMs?: number;
	defaultTimeoutMs?: number;
}

export class IrisAttestationService implements IAttestationService {
	private readonly hosts: Record<Environment, string>;
	private readonly defaultIntervalMs: number;
	private readonly defaultTimeoutMs: number;

	constructor(options: IrisAttestationOptions = {}) {
		this.hosts = { ...DEFAULT_HOSTS, ...options.hosts };
		this.defaultIntervalMs = options.defaultIntervalMs ?? 4000;
		this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30 * 60 * 1000;
	}

	host(environment: Environment): string {
		return this.hosts[environment];
	}

	async waitForAttestation(
		params: WaitForAttestationParams,
	): Promise<AttestationResult> {
		if (!txHashSchema.safeParse(params.transactionHash).success) {
			throw new BridgeError("TX_HASH_INVALID");
		}
		const intervalMs = params.intervalMs ?? this.defaultIntervalMs;
		const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;
		const deadline = Date.now() + timeoutMs;
		const url = `${this.host(params.environment)}/v2/messages/${params.sourceDomain}?transactionHash=${params.transactionHash}`;

		let attempt = 0;
		let failures = 0;
		let lastMessage: IrisMessage | undefined;
		while (true) {
			attempt += 1;
			const poll = await this.poll(url);
			if (poll.outcome === PollOutcome.READY && poll.message) {
				params.onPoll?.({
					attempt,
					status: poll.message.status,
					httpStatus: poll.httpStatus,
				});
				return this.toResult(poll.message);
			}

			failures = poll.outcome === PollOutcome.FAILED ? failures + 1 : 0;
			lastMessage = poll.message ?? lastMessage;
			const remainingMs = deadline - Date.now();
			const waitMs = Math.min(
				this.delayAfter(poll, intervalMs, failures),
				Math.max(remainingMs, 0),
			);
			params.onPoll?.({
				attempt,
				status: lastMessage?.status,
				delayReason: lastMessage?.delayReason,
				httpStatus: poll.httpStatus,
				error: poll.error,
				nextPollInMs: remainingMs > 0 ? waitMs : undefined,
			});
			if (remainingMs <= 0) {
				throw new AttestationTimeoutError({
					lastStatus: lastMessage?.status,
					delayReason: lastMessage?.delayReason,
					lastHttpStatus: poll.httpStatus,
				});
			}
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}

	private async poll(url: string): Promise<IrisPoll> {
		let res: Response;
		try {
			res = await fetch(url, {
				headers: { Accept: "application/json" },
				cache: "no-store",
			});
		} catch (err) {
			return { outcome: PollOutcome.FAILED, error: this.toError(err) };
		}

		const httpStatus = res.status;
		if (httpStatus === HTTP_NOT_FOUND) {
			return { outcome: PollOutcome.PENDING, httpStatus };
		}
		if (httpStatus === HTTP_TOO_MANY_REQUESTS) {
			return {
				outcome: PollOutcome.RATE_LIMITED,
				httpStatus,
				retryAfterMs: this.retryAfterMs(res.headers.get("retry-after")),
			};
		}
		if (
			httpStatus >= HTTP_SERVER_ERROR ||
			httpStatus === HTTP_REQUEST_TIMEOUT
		) {
			return {
				outcome: PollOutcome.FAILED,
				httpStatus,
				error: new IrisRequestError(
					"ATTESTATION_REQUEST_FAILED",
					httpStatus,
					await this.readBody(res),
				),
			};
		}
		if (!res.ok) {
			throw new IrisRequestError(
				"ATTESTATION_REQUEST_FAILED",
				httpStatus,
				await this.readBody(res),
			);
		}

		let body: IrisMessagesResponse;
		try {
			body = (await res.json()) as IrisMessagesResponse;
		} catch (err) {
			return {
				outcome: PollOutcome.FAILED,
				httpStatus,
				error: this.toError(err),
			};
		}
		const ready = body.messages?.find((m) => this.isReady(m));
		if (ready) {
			return { outcome: PollOutcome.READY, httpStatus, message: ready };
		}
		return {
			outcome: PollOutcome.PENDING,
			httpStatus,
			message: body.messages?.[0],
		};
	}

	private delayAfter(
		poll: IrisPoll,
		intervalMs: number,
		failures: number,
	): number {
		if (poll.outcome === PollOutcome.RATE_LIMITED) {
			return poll.retryAfterMs ?? RATE_LIMIT_BLOCK_MS;
		}
		if (poll.outcome === PollOutcome.FAILED) {
			const backoffMs = intervalMs * 2 ** (failures - 1);
			return Math.min(backoffMs, Math.max(intervalMs, MAX_BACKOFF_MS));
		}
		return intervalMs;
	}

	private retryAfterMs(header: string | null): number {
		if (!header) {
			return RATE_LIMIT_BLOCK_MS;
		}
		const seconds = Number(header);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return seconds * MS_PER_SECOND;
		}
		const at = Date.parse(header);
		if (Number.isNaN(at)) {
			return RATE_LIMIT_BLOCK_MS;
		}
		return Math.max(at - Date.now(), 0);
	}

	private isReady(message: IrisMessage): boolean {
		return (
			message.status === AttestationStatus.COMPLETE &&
			message.attestation !== "PENDING" &&
			Boolean(message.attestation?.startsWith("0x")) &&
			Boolean(message.message)
		);
	}

	private toResult(message: IrisMessage): AttestationResult {
		return {
			message: message.message as `0x${string}`,
			attestation: message.attestation as `0x${string}`,
			status: AttestationStatus.COMPLETE,
			eventNonce: message.eventNonce,
		};
	}

	private async readBody(res: Response): Promise<string> {
		try {
			return await res.text();
		} catch {
			return "";
		}
	}

	private toError(err: unknown): Error {
		return err instanceof Error ? err : new Error(String(err));
	}
}
