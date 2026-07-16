import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Environment, FinalityThreshold } from "../../../index";
import { IrisFeeService } from "../IrisFeeService";

describe("IrisFeeService", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function stubFetch(body: unknown, ok = true): void {
		globalThis.fetch = vi.fn(
			async () =>
				({
					ok,
					status: ok ? 200 : 500,
					json: async () => body,
				}) as unknown as Response,
		);
	}

	it("returns the fee bps for the matching finality threshold", async () => {
		stubFetch([
			{ finalityThreshold: 2000, minimumFee: 0 },
			{ finalityThreshold: 1000, minimumFee: 1.3 },
		]);
		const result = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(result.feeBps).toBe(1.3);
		expect(result.minFinalityThreshold).toBe(1000);
		expect(result.estimatedSeconds).toBeGreaterThan(0);
	});

	it("falls back to the first entry when no match", async () => {
		stubFetch([{ finalityThreshold: 2000, minimumFee: 0.5 }]);
		const result = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(result.feeBps).toBe(0.5);
	});

	it("returns a zero-fee quote when Iris rejects the request", async () => {
		stubFetch({}, false);
		const result = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(result.feeBps).toBe(0);
		expect(result.minFinalityThreshold).toBe(FinalityThreshold.FAST);
	});

	it("estimated seconds is faster for FAST than STANDARD", async () => {
		stubFetch([{ finalityThreshold: 1000, minimumFee: 1 }]);
		const fast = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		stubFetch([{ finalityThreshold: 2000, minimumFee: 0 }]);
		const standard = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.STANDARD,
		});
		expect(fast.estimatedSeconds).toBeLessThan(standard.estimatedSeconds);
	});

	it("returns zero-fee quote when fetch itself throws", async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new Error("network down");
		});
		const result = await new IrisFeeService().getQuote({
			environment: Environment.MAINNET,
			sourceDomain: 3,
			destinationDomain: 0,
			minFinalityThreshold: FinalityThreshold.FAST,
		});
		expect(result.feeBps).toBe(0);
	});
});
