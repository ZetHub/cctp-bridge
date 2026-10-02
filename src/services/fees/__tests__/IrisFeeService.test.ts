import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AttestationTime,
	Environment,
	FinalityThreshold,
	IrisRequestError,
} from "../../../index";
import { IrisFeeService } from "../IrisFeeService";

const QUOTE_PARAMS = {
	environment: Environment.MAINNET,
	sourceDomain: 3,
	destinationDomain: 0,
	minFinalityThreshold: FinalityThreshold.FAST,
};

describe("IrisFeeService", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function stubFetch(body: string, status = 200): void {
		globalThis.fetch = vi.fn(
			async () =>
				({
					ok: status >= 200 && status < 300,
					status,
					json: async () => JSON.parse(body),
					text: async () => body,
				}) as unknown as Response,
		);
	}

	function stubQuotes(quotes: unknown): void {
		stubFetch(JSON.stringify(quotes));
	}

	it("returns the fee bps for the matching finality threshold", async () => {
		stubQuotes([
			{ finalityThreshold: 2000, minimumFee: 0 },
			{ finalityThreshold: 1000, minimumFee: 1.3 },
		]);
		const result = await new IrisFeeService().getQuote(QUOTE_PARAMS);
		expect(result.feeBps).toBe(1.3);
		expect(result.minFinalityThreshold).toBe(1000);
		expect(result.estimatedSeconds).toBeGreaterThan(0);
	});

	it("throws FEE_TIER_UNAVAILABLE instead of using another tier's fee", async () => {
		stubQuotes([{ finalityThreshold: 2000, minimumFee: 0.5 }]);
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_TIER_UNAVAILABLE" });
	});

	it("throws IrisRequestError with the status and body on HTTP 500", async () => {
		stubFetch("upstream unavailable", 500);
		const error = await new IrisFeeService()
			.getQuote(QUOTE_PARAMS)
			.catch((err: unknown) => err);
		expect(error).toBeInstanceOf(IrisRequestError);
		expect(error).toMatchObject({
			code: "FEE_QUOTE_FAILED",
			status: 500,
			body: "upstream unavailable",
		});
	});

	it("throws IrisRequestError on HTTP 400", async () => {
		stubFetch('{"error":"Invalid source/destination domain id"}', 400);
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_QUOTE_FAILED", status: 400 });
	});

	it("throws FEE_QUOTE_FAILED with the cause when fetch itself throws", async () => {
		const networkError = new TypeError("fetch failed");
		globalThis.fetch = vi.fn(async () => {
			throw networkError;
		});
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_QUOTE_FAILED", cause: networkError });
	});

	it("throws FEE_QUOTE_FAILED on invalid JSON", async () => {
		stubFetch("<html>maintenance</html>");
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_QUOTE_FAILED" });
	});

	it("throws FEE_QUOTE_FAILED when the body is not a list of quotes", async () => {
		stubQuotes({ error: "unexpected" });
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_QUOTE_FAILED" });
	});

	it("throws FEE_QUOTE_FAILED on a negative fee", async () => {
		stubQuotes([{ finalityThreshold: 1000, minimumFee: -1 }]);
		await expect(
			new IrisFeeService().getQuote(QUOTE_PARAMS),
		).rejects.toMatchObject({ code: "FEE_QUOTE_FAILED" });
	});

	it("estimates from the source chain's attestation time", async () => {
		stubQuotes([
			{ finalityThreshold: 1000, minimumFee: 1 },
			{ finalityThreshold: 2000, minimumFee: 0 },
		]);
		const attestationTime = new AttestationTime({
			fastSeconds: 8,
			standardSeconds: 1140,
		});
		const fast = await new IrisFeeService().getQuote({
			...QUOTE_PARAMS,
			attestationTime,
		});
		const standard = await new IrisFeeService().getQuote({
			...QUOTE_PARAMS,
			minFinalityThreshold: FinalityThreshold.STANDARD,
			attestationTime,
		});
		expect(fast.estimatedSeconds).toBe(8);
		expect(standard.estimatedSeconds).toBe(1140);
	});

	it("estimated seconds is faster for FAST than STANDARD", async () => {
		stubQuotes([
			{ finalityThreshold: 1000, minimumFee: 1 },
			{ finalityThreshold: 2000, minimumFee: 0 },
		]);
		const fast = await new IrisFeeService().getQuote(QUOTE_PARAMS);
		const standard = await new IrisFeeService().getQuote({
			...QUOTE_PARAMS,
			minFinalityThreshold: FinalityThreshold.STANDARD,
		});
		expect(fast.estimatedSeconds).toBeLessThan(standard.estimatedSeconds);
	});
});
