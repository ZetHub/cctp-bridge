import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AttestationTimeoutError,
	Environment,
	IrisRequestError,
} from "../../../index";
import { IrisAttestationService } from "../IrisAttestationService";

const BURN_HASH = `0x${"ab".repeat(32)}`;
const STELLAR_BURN_HASH = "cd".repeat(32);

interface StubResponse {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
	throws?: Error;
}

const PENDING = {
	messages: [{ status: "pending_confirmations", attestation: "PENDING" }],
};
const COMPLETE = {
	messages: [
		{
			status: "complete",
			attestation: "0xabcd",
			message: "0x1234",
			eventNonce: "42",
		},
	],
};

describe("IrisAttestationService", () => {
	let originalFetch: typeof globalThis.fetch;
	let originalSetTimeout: typeof globalThis.setTimeout;
	let sleeps: number[];

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalSetTimeout = globalThis.setTimeout;
		sleeps = [];
		// zero-delay setTimeout so the poll loop advances immediately
		globalThis.setTimeout = ((cb: () => void, ms?: number) => {
			sleeps.push(ms ?? 0);
			cb();
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as unknown as typeof setTimeout;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.setTimeout = originalSetTimeout;
		vi.restoreAllMocks();
	});

	function stubFetch(responses: StubResponse[]): ReturnType<typeof vi.fn> {
		const fetchStub = vi.fn(async () => {
			const next = responses.shift();
			if (!next) {
				throw new Error("unexpected fetch");
			}
			if (next.throws) {
				throw next.throws;
			}
			const status = next.status ?? 200;
			const text =
				typeof next.body === "string" ? next.body : JSON.stringify(next.body);
			return {
				status,
				ok: status >= 200 && status < 300,
				headers: new Headers(next.headers ?? {}),
				json: async () => JSON.parse(text),
				text: async () => text,
			} as unknown as Response;
		});
		globalThis.fetch = fetchStub;
		return fetchStub;
	}

	function wait(
		service: IrisAttestationService,
		overrides: { transactionHash?: string; timeoutMs?: number } = {},
		onPoll = vi.fn(),
	) {
		return service.waitForAttestation({
			environment: Environment.MAINNET,
			sourceDomain: 0,
			transactionHash: overrides.transactionHash ?? BURN_HASH,
			timeoutMs: overrides.timeoutMs,
			onPoll,
		});
	}

	it("resolves immediately when Iris returns a complete attestation", async () => {
		stubFetch([{ body: COMPLETE }]);
		const result = await wait(new IrisAttestationService());
		expect(result.status).toBe("complete");
		expect(result.message).toBe("0x1234");
		expect(result.attestation).toBe("0xabcd");
		expect(result.eventNonce).toBe("42");
	});

	it("polls until Iris marks the message complete", async () => {
		stubFetch([{ body: PENDING }, { body: PENDING }, { body: COMPLETE }]);
		const onPoll = vi.fn();
		const result = await wait(new IrisAttestationService(), {}, onPoll);
		expect(result.status).toBe("complete");
		// Three attempts, three onPoll calls (2 pending + 1 complete)
		expect(onPoll).toHaveBeenCalledTimes(3);
		expect(onPoll.mock.calls[0][0]).toMatchObject({
			attempt: 1,
			status: "pending_confirmations",
			httpStatus: 200,
			nextPollInMs: 4000,
		});
		expect(onPoll.mock.calls[2][0]).toMatchObject({
			attempt: 3,
			status: "complete",
		});
		expect(sleeps).toEqual([4000, 4000]);
	});

	it("surfaces delayReason via onPoll", async () => {
		stubFetch([
			{
				body: {
					messages: [
						{
							status: "pending_confirmations",
							attestation: "PENDING",
							delayReason: "insufficient_fee",
						},
					],
				},
			},
			{ body: COMPLETE },
		]);
		const onPoll = vi.fn();
		await wait(new IrisAttestationService(), {}, onPoll);
		expect(onPoll.mock.calls[0][0].delayReason).toBe("insufficient_fee");
	});

	it("accepts a bare-hex Stellar transaction hash", async () => {
		const fetchStub = stubFetch([{ body: COMPLETE }]);
		await wait(new IrisAttestationService(), {
			transactionHash: STELLAR_BURN_HASH,
		});
		expect(String(fetchStub.mock.calls[0][0])).toContain(STELLAR_BURN_HASH);
	});

	it("rejects a malformed transaction hash without calling Iris", async () => {
		const fetchStub = stubFetch([]);
		await expect(
			wait(new IrisAttestationService(), { transactionHash: "0xburn" }),
		).rejects.toMatchObject({ code: "TX_HASH_INVALID" });
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it("treats 404 as not indexed yet and keeps polling", async () => {
		stubFetch([
			{ status: 404, body: { error: "Message not found" } },
			{ body: COMPLETE },
		]);
		const onPoll = vi.fn();
		const result = await wait(new IrisAttestationService(), {}, onPoll);
		expect(result.status).toBe("complete");
		expect(onPoll.mock.calls[0][0]).toMatchObject({
			attempt: 1,
			httpStatus: 404,
			nextPollInMs: 4000,
		});
	});

	it("throws IrisRequestError on a 4xx that retrying cannot fix", async () => {
		const fetchStub = stubFetch([
			{ status: 400, body: { error: "Invalid source domain id" } },
		]);
		const error = await wait(new IrisAttestationService()).catch(
			(err: unknown) => err,
		);
		expect(error).toBeInstanceOf(IrisRequestError);
		expect(error).toMatchObject({
			code: "ATTESTATION_REQUEST_FAILED",
			status: 400,
			body: '{"error":"Invalid source domain id"}',
		});
		expect(fetchStub).toHaveBeenCalledTimes(1);
	});

	it("waits for Retry-After on 429 and reports the wait", async () => {
		stubFetch([
			{ status: 429, headers: { "retry-after": "7" } },
			{ body: COMPLETE },
		]);
		const onPoll = vi.fn();
		await wait(new IrisAttestationService(), {}, onPoll);
		expect(sleeps).toEqual([7000]);
		expect(onPoll.mock.calls[0][0]).toMatchObject({
			httpStatus: 429,
			nextPollInMs: 7000,
		});
	});

	it("waits out the 5-minute block on 429 without Retry-After", async () => {
		stubFetch([{ status: 429 }, { body: COMPLETE }]);
		await wait(new IrisAttestationService());
		expect(sleeps).toEqual([5 * 60 * 1000]);
	});

	it("backs off on 5xx and network errors, and reports each failure", async () => {
		const networkError = new TypeError("fetch failed");
		stubFetch([
			{ status: 503, body: "upstream unavailable" },
			{ throws: networkError },
			{ status: 500, body: "boom" },
			{ body: COMPLETE },
		]);
		const onPoll = vi.fn();
		const result = await wait(new IrisAttestationService(), {}, onPoll);
		expect(result.status).toBe("complete");
		expect(sleeps).toEqual([4000, 8000, 16000]);
		expect(onPoll.mock.calls[0][0]).toMatchObject({ httpStatus: 503 });
		expect(onPoll.mock.calls[0][0].error).toBeInstanceOf(IrisRequestError);
		expect(onPoll.mock.calls[1][0].error).toBe(networkError);
		expect(onPoll.mock.calls[2][0]).toMatchObject({ httpStatus: 500 });
	});

	it("resets the backoff after a successful poll", async () => {
		stubFetch([
			{ status: 503 },
			{ status: 503 },
			{ body: PENDING },
			{ status: 503 },
			{ body: COMPLETE },
		]);
		await wait(new IrisAttestationService());
		expect(sleeps).toEqual([4000, 8000, 4000, 4000]);
	});

	it("throws AttestationTimeoutError with the last status Iris reported", async () => {
		stubFetch([
			{
				body: {
					messages: [
						{
							status: "pending_confirmations",
							attestation: "PENDING",
							delayReason: "insufficient_fee",
						},
					],
				},
			},
		]);
		const error = await wait(new IrisAttestationService(), {
			timeoutMs: 0,
		}).catch((err: unknown) => err);
		expect(error).toBeInstanceOf(AttestationTimeoutError);
		expect(error).toMatchObject({
			code: "ATTESTATION_TIMEOUT",
			lastStatus: "pending_confirmations",
			delayReason: "insufficient_fee",
			lastHttpStatus: 200,
		});
	});

	it("does not sleep a full interval past a short deadline", async () => {
		stubFetch([{ body: PENDING }, { body: PENDING }, { body: PENDING }]);
		await expect(
			wait(new IrisAttestationService(), { timeoutMs: 1 }),
		).rejects.toBeInstanceOf(AttestationTimeoutError);
		expect(sleeps.every((ms) => ms <= 1)).toBe(true);
	});

	it("uses environment-specific hosts", () => {
		const service = new IrisAttestationService();
		expect(service.host(Environment.MAINNET)).toBe(
			"https://iris-api.circle.com",
		);
		expect(service.host(Environment.TESTNET)).toBe(
			"https://iris-api-sandbox.circle.com",
		);
	});
});
