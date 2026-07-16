import { AttestationStatus, Environment } from "../../domain/enums";
import type {
	AttestationResult,
	IAttestationService,
	WaitForAttestationParams,
} from "../../ports/IAttestationService";

const DEFAULT_HOSTS: Record<Environment, string> = {
	[Environment.MAINNET]: "https://iris-api.circle.com",
	[Environment.TESTNET]: "https://iris-api-sandbox.circle.com",
};

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
		const intervalMs = params.intervalMs ?? this.defaultIntervalMs;
		const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;
		const deadline = Date.now() + timeoutMs;
		const url = `${this.host(params.environment)}/v2/messages/${params.sourceDomain}?transactionHash=${params.transactionHash}`;

		let attempt = 0;
		while (Date.now() < deadline) {
			attempt += 1;
			let snapshot: IrisMessage | undefined;
			try {
				const res = await fetch(url, {
					headers: { Accept: "application/json" },
					cache: "no-store",
				});
				if (res.ok) {
					const body = (await res.json()) as IrisMessagesResponse;
					snapshot = body.messages?.[0];
					const ready = body.messages?.find(
						(m) =>
							m.status === AttestationStatus.COMPLETE &&
							m.attestation !== "PENDING" &&
							m.attestation?.startsWith("0x") &&
							m.message,
					);
					if (ready?.message) {
						params.onPoll?.({ attempt, status: ready.status });
						return {
							message: ready.message,
							attestation: ready.attestation as `0x${string}`,
							status: AttestationStatus.COMPLETE,
							eventNonce: ready.eventNonce,
						};
					}
				}
			} catch {
				// transient network error; retry
			}
			params.onPoll?.({
				attempt,
				status: snapshot?.status,
				delayReason: snapshot?.delayReason,
			});
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}
		throw new Error("Timed out waiting for Circle attestation");
	}
}
