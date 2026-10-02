import { AttestationTime } from "../../domain/AttestationTime";
import type { BridgeQuote } from "../../domain/BridgeTransaction";
import { BridgeError, IrisRequestError } from "../../errors";
import type { FeeQuoteParams, IFeeService } from "../../ports/IFeeService";
import { irisFeeQuotesSchema } from "../../validation/schemas";
import { IrisClient, type IrisClientOptions } from "../iris/IrisClient";

export interface IrisFeeOptions extends IrisClientOptions {}

export class IrisFeeService extends IrisClient implements IFeeService {
	constructor(options: IrisFeeOptions = {}) {
		super(options);
	}

	async getQuote(params: FeeQuoteParams): Promise<BridgeQuote> {
		const url = `${this.host(params.environment)}/v2/burn/USDC/fees/${params.sourceDomain}/${params.destinationDomain}`;
		let res: Response;
		try {
			res = await this.request(url);
		} catch (err) {
			throw new BridgeError("FEE_QUOTE_FAILED", undefined, this.toError(err));
		}
		if (!res.ok) {
			throw new IrisRequestError(
				"FEE_QUOTE_FAILED",
				res.status,
				await this.readBody(res),
			);
		}

		let body: unknown;
		try {
			body = await res.json();
		} catch (err) {
			throw new BridgeError("FEE_QUOTE_FAILED", undefined, this.toError(err));
		}
		const quotes = irisFeeQuotesSchema.safeParse(body);
		if (!quotes.success) {
			throw new BridgeError("FEE_QUOTE_FAILED", undefined, quotes.error);
		}
		const matched = quotes.data.find(
			(quote) => quote.finalityThreshold === params.minFinalityThreshold,
		);
		if (!matched) {
			throw new BridgeError("FEE_TIER_UNAVAILABLE");
		}
		return {
			feeBps: matched.minimumFee,
			minFinalityThreshold: matched.finalityThreshold,
			estimatedSeconds: (
				params.attestationTime ?? AttestationTime.GENERIC
			).secondsFor(params.minFinalityThreshold),
		};
	}
}
