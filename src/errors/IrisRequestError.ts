import { BridgeError } from "./BridgeError";
import type { ErrorCode } from "./codes";

export class IrisRequestError extends BridgeError {
	readonly status: number;
	readonly body: string;

	constructor(code: ErrorCode, status: number, body: string) {
		super(code);
		this.name = "IrisRequestError";
		this.status = status;
		this.body = body;
	}
}
