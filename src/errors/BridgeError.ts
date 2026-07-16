import type { ErrorCode } from "./codes";
import { ErrorMessage } from "./messages";

export class BridgeError extends Error {
	readonly code: ErrorCode;
	readonly cause?: unknown;

	constructor(code: ErrorCode, message?: string, cause?: unknown) {
		super(message ?? ErrorMessage[code]);
		this.name = "BridgeError";
		this.code = code;
		this.cause = cause;
	}

	static from(err: unknown, fallback: ErrorCode = "UNKNOWN"): BridgeError {
		if (err instanceof BridgeError) {
			return err;
		}
		const message = err instanceof Error ? err.message : String(err);
		if (/user rejected|user denied|action_rejected/i.test(message)) {
			return new BridgeError("WALLET_SIGN_REJECTED", undefined, err);
		}
		if (/insufficient funds/i.test(message)) {
			return new BridgeError("AMOUNT_EXCEEDS_BALANCE", undefined, err);
		}
		if (/wrong network|chain mismatch/i.test(message)) {
			return new BridgeError("WRONG_NETWORK", undefined, err);
		}
		return new BridgeError(fallback, message, err);
	}
}
