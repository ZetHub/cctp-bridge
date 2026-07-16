import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Environment } from "../../../index";
import { IrisAttestationService } from "../IrisAttestationService";

describe("IrisAttestationService", () => {
	let originalFetch: typeof globalThis.fetch;
	let originalSetTimeout: typeof globalThis.setTimeout;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalSetTimeout = globalThis.setTimeout;
		// zero-delay setTimeout so the poll loop advances immediately
		globalThis.setTimeout = ((cb: () => void) => {
			cb();
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as unknown as typeof setTimeout;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.setTimeout = originalSetTimeout;
		vi.restoreAllMocks();
	});

	function stubFetchResponses(bodies: unknown[]): ReturnType<typeof vi.fn> {
		const fetchStub = vi.fn(async () => {
			const body = bodies.shift();
			return {
				ok: true,
				json: async () => body,
			} as unknown as Response;
		});
		globalThis.fetch = fetchStub;
		return fetchStub;
	}

	it("resolves immediately when Iris returns a complete attestation", async () => {
		stubFetchResponses([
			{
				messages: [
					{
						status: "complete",
						attestation: "0xabcd",
						message: "0x1234",
						eventNonce: "42",
					},
				],
			},
		]);
		const service = new IrisAttestationService();
		const result = await service.waitForAttestation({
			environment: Environment.MAINNET,
			sourceDomain: 0,
			transactionHash: "0xburn",
		});
		expect(result.status).toBe("complete");
		expect(result.message).toBe("0x1234");
		expect(result.attestation).toBe("0xabcd");
		expect(result.eventNonce).toBe("42");
	});

	it("polls until Iris marks the message complete", async () => {
		stubFetchResponses([
			{ messages: [{ status: "pending_confirmations", attestation: "PENDING" }] },
			{ messages: [{ status: "pending_confirmations", attestation: "PENDING" }] },
			{
				messages: [
					{
						status: "complete",
						attestation: "0xabcd",
						message: "0x1234",
						eventNonce: "99",
					},
				],
			},
		]);
		const onPoll = vi.fn();
		const service = new IrisAttestationService();
		const result = await service.waitForAttestation({
			environment: Environment.MAINNET,
			sourceDomain: 0,
			transactionHash: "0xburn",
			onPoll,
		});
		expect(result.status).toBe("complete");
		// Three attempts, three onPoll calls (2 pending + 1 complete)
		expect(onPoll).toHaveBeenCalledTimes(3);
		expect(onPoll.mock.calls[0][0]).toMatchObject({
			attempt: 1,
			status: "pending_confirmations",
		});
		expect(onPoll.mock.calls[2][0]).toMatchObject({
			attempt: 3,
			status: "complete",
		});
	});

	it("surfaces delayReason via onPoll", async () => {
		stubFetchResponses([
			{
				messages: [
					{
						status: "pending_confirmations",
						attestation: "PENDING",
						delayReason: "insufficient_fee",
					},
				],
			},
			{
				messages: [
					{
						status: "complete",
						attestation: "0xabcd",
						message: "0x1234",
					},
				],
			},
		]);
		const onPoll = vi.fn();
		const service = new IrisAttestationService();
		await service.waitForAttestation({
			environment: Environment.MAINNET,
			sourceDomain: 0,
			transactionHash: "0xburn",
			onPoll,
		});
		expect(onPoll.mock.calls[0][0].delayReason).toBe("insufficient_fee");
	});

	it("throws when the deadline elapses without a complete attestation", async () => {
		globalThis.fetch = vi.fn(
			async () =>
				({
					ok: true,
					json: async () => ({
						messages: [{ status: "pending_confirmations", attestation: "PENDING" }],
					}),
				}) as unknown as Response,
		);
		const service = new IrisAttestationService({ defaultTimeoutMs: 0 });
		await expect(
			service.waitForAttestation({
				environment: Environment.MAINNET,
				sourceDomain: 0,
				transactionHash: "0xburn",
			}),
		).rejects.toThrow(/Timed out waiting for Circle attestation/);
	});

	it("uses environment-specific hosts", () => {
		const service = new IrisAttestationService();
		expect(service.host(Environment.MAINNET)).toBe("https://iris-api.circle.com");
		expect(service.host(Environment.TESTNET)).toBe(
			"https://iris-api-sandbox.circle.com",
		);
	});

	it("swallows a single fetch failure and retries", async () => {
		const throwOnce = vi.fn(async () => {
			throw new Error("boom");
		});
		const succeed = vi.fn(
			async () =>
				({
					ok: true,
					json: async () => ({
						messages: [
							{
								status: "complete",
								attestation: "0xabcd",
								message: "0x1234",
							},
						],
					}),
				}) as unknown as Response,
		);
		globalThis.fetch = vi
			.fn()
			.mockImplementationOnce(throwOnce)
			.mockImplementationOnce(succeed);
		const service = new IrisAttestationService();
		const result = await service.waitForAttestation({
			environment: Environment.MAINNET,
			sourceDomain: 0,
			transactionHash: "0xburn",
		});
		expect(result.status).toBe("complete");
	});
});
