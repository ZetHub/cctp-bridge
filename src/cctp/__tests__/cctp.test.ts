import { describe, expect, it } from "vitest";
import { xdrField } from "../../__tests__/xdr";
import {
	CctpEncoder,
	CctpEventReader,
	FeeMath,
	MemoType,
	StellarCodec,
} from "../../index";

describe("CctpEncoder", () => {
	it("left-pads EVM addresses to bytes32", () => {
		const out = CctpEncoder.evmAddressToBytes32(
			"0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
		);
		expect(out).toBe(
			"0x00000000000000000000000028b5a0e9c621a5badaa536219b3a228c8168cf5d",
		);
	});

	it("refuses to pad an invalid EVM address", () => {
		for (const bad of [
			"0x28b5a0e9C621a5BadaA536219b3a228C8168cf5",
			"0x28b5a0e9c621a5badaa536219b3a228c8168cf5dd",
			"0x28b5a0e9C621a5BadaA536219b3a228C8168CF5d",
			"28b5a0e9c621a5badaa536219b3a228c8168cf5d",
		]) {
			expect(() => CctpEncoder.evmAddressToBytes32(bad)).toThrowError(
				expect.objectContaining({ code: "RECIPIENT_INVALID_EVM" }),
			);
		}
	});

	it("decodes Stellar G/C addresses to 32 bytes", () => {
		const g = CctpEncoder.stellarAddressToBytes32(
			"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		);
		expect(g).toHaveLength(66);
		const c = CctpEncoder.stellarAddressToBytes32(
			"CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ",
		);
		expect(c).toHaveLength(66);
	});

	it("builds a forwarder hook with a length prefix", () => {
		const recipient = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
		const hook = CctpEncoder.forwarderHook(recipient);
		expect(hook.startsWith("0x")).toBe(true);
		const bytes = StellarCodec.hexToBytes(hook);
		// bytes [28..31] encode the recipient length (56)
		expect(bytes[31]).toBe(recipient.length);
		expect(bytes.length).toBe(32 + recipient.length);
	});

	it("rejects invalid strkeys", () => {
		expect(() => CctpEncoder.forwarderHook("not-a-strkey")).toThrow();
	});

	it("stellarAddressToBytes32 throws for addresses that are neither G nor C", () => {
		expect(() => CctpEncoder.stellarAddressToBytes32("XABC")).toThrow(
			/Cannot convert/,
		);
	});
});

describe("FeeMath", () => {
	it("computes fee subunits from basis points", () => {
		// 1 bps of 1 USDC (1e6) = 100 subunits
		expect(FeeMath.feeSubunits(1_000_000n, 1)).toBe(100n);
		expect(FeeMath.feeSubunits(0n, 5)).toBe(0n);
		expect(FeeMath.feeSubunits(1_000_000n, 0)).toBe(0n);
	});

	it("adds a 20% buffer to the max fee", () => {
		expect(FeeMath.maxFeeWithBuffer(1_000_000n, 1)).toBe(120n);
		expect(FeeMath.maxFeeWithBuffer(1_000_000n, 0)).toBe(0n);
	});
});

describe("StellarCodec", () => {
	it("round-trips hex to bytes", () => {
		expect([...StellarCodec.hexToBytes("0x0a0b")]).toEqual([10, 11]);
		expect(() => StellarCodec.hexToBytes("0x123")).toThrow();
	});

	it("builds i128 parts", () => {
		const parts = StellarCodec.i128(123n);
		expect(String(xdrField(parts, "lo"))).toBe("123");
	});

	it("encodes memos of every type", () => {
		expect(
			StellarCodec.memo({ type: MemoType.HASH, value: "0x" + "ab".repeat(32) }),
		).toBeDefined();
		expect(
			StellarCodec.memo({
				type: MemoType.RETURN,
				value: "0x" + "ab".repeat(32),
			}),
		).toBeDefined();
	});

	it("builds memos by type", () => {
		expect(StellarCodec.memo({ type: MemoType.TEXT, value: "hello" })).toBeDefined();
		expect(StellarCodec.memo({ type: MemoType.ID, value: "42" })).toBeDefined();
	});
});

describe("CctpEventReader", () => {
	it("returns no events for empty logs", () => {
		expect(CctpEventReader.readSource([], "0xabc")).toEqual([]);
		expect(CctpEventReader.readDestination([], "0xabc")).toEqual([]);
	});
});
