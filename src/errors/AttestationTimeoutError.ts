import type { AttestationStatus } from "../domain/enums";
import { BridgeError } from "./BridgeError";

export interface AttestationTimeoutDetails {
	readonly lastStatus?: AttestationStatus;
	readonly delayReason?: string;
	readonly lastHttpStatus?: number;
}

export class AttestationTimeoutError extends BridgeError {
	readonly lastStatus?: AttestationStatus;
	readonly delayReason?: string;
	readonly lastHttpStatus?: number;

	constructor(details: AttestationTimeoutDetails) {
		super("ATTESTATION_TIMEOUT");
		this.name = "AttestationTimeoutError";
		this.lastStatus = details.lastStatus;
		this.delayReason = details.delayReason;
		this.lastHttpStatus = details.lastHttpStatus;
	}
}
