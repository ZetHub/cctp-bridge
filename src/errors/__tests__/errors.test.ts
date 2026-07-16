import { describe, expect, it } from "vitest";
import { BridgeError, ErrorMessage } from "../../index";

describe("BridgeError", () => {
	it("uses the constant message for a code", () => {
		const err = new BridgeError("MISSING_TRUSTLINE");
		expect(err.message).toBe(ErrorMessage.MISSING_TRUSTLINE);
		expect(err.code).toBe("MISSING_TRUSTLINE");
		expect(err).toBeInstanceOf(Error);
	});

	it("classifies known provider errors", () => {
		expect(BridgeError.from(new Error("User rejected the request")).code).toBe(
			"WALLET_SIGN_REJECTED",
		);
		expect(BridgeError.from(new Error("insufficient funds for gas")).code).toBe(
			"AMOUNT_EXCEEDS_BALANCE",
		);
		expect(BridgeError.from(new Error("wrong network selected")).code).toBe(
			"WRONG_NETWORK",
		);
		expect(BridgeError.from("weird").code).toBe("UNKNOWN");
	});

	it("passes through existing BridgeErrors", () => {
		const original = new BridgeError("BURN_FAILED");
		expect(BridgeError.from(original)).toBe(original);
	});
});
