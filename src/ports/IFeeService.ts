import type { BridgeQuote } from "../domain/BridgeTransaction";
import type { Environment } from "../domain/enums";

export interface FeeQuoteParams {
	environment: Environment;
	sourceDomain: number;
	destinationDomain: number;
	minFinalityThreshold: number;
}

export interface IFeeService {
	getQuote(params: FeeQuoteParams): Promise<BridgeQuote>;
}
