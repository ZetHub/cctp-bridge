import type { AttestationStatus, Environment } from "../domain/enums";

export interface AttestationResult {
	message: `0x${string}`;
	attestation: `0x${string}`;
	status: AttestationStatus;
	eventNonce?: string;
}

export interface AttestationPollUpdate {
	attempt: number;
	status?: AttestationStatus;
	delayReason?: string;
}

export interface WaitForAttestationParams {
	environment: Environment;
	sourceDomain: number;
	transactionHash: string;
	intervalMs?: number;
	timeoutMs?: number;
	onPoll?: (update: AttestationPollUpdate) => void;
}

export interface IAttestationService {
	host(environment: Environment): string;
	waitForAttestation(
		params: WaitForAttestationParams,
	): Promise<AttestationResult>;
}
