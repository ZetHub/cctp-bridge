import type { BridgeQuote } from "../../domain/BridgeTransaction";
import { Environment, FinalityThreshold } from "../../domain/enums";
import type { FeeQuoteParams, IFeeService } from "../../ports/IFeeService";

const DEFAULT_HOSTS: Record<Environment, string> = {
	[Environment.MAINNET]: "https://iris-api.circle.com",
	[Environment.TESTNET]: "https://iris-api-sandbox.circle.com",
};

interface IrisFeesResponseEntry {
	minimumFee?: number;
	finalityThreshold?: number;
}

export interface IrisFeeOptions {
	hosts?: Partial<Record<Environment, string>>;
}

export class IrisFeeService implements IFeeService {
	private readonly hosts: Record<Environment, string>;

	constructor(options: IrisFeeOptions = {}) {
		this.hosts = { ...DEFAULT_HOSTS, ...options.hosts };
	}

	async getQuote(params: FeeQuoteParams): Promise<BridgeQuote> {
		const url = `${this.hosts[params.environment]}/v2/burn/USDC/fees/${params.sourceDomain}/${params.destinationDomain}`;
		try {
			const res = await fetch(url, {
				headers: { Accept: "application/json" },
				cache: "no-store",
			});
			if (!res.ok) {
				throw new Error(`Iris fees ${res.status}`);
			}
			const body = (await res.json()) as IrisFeesResponseEntry[];
			const matched =
				body.find((d) => d.finalityThreshold === params.minFinalityThreshold) ??
				body[0];
			const feeBps = Number(matched?.minimumFee ?? 0);
			return {
				feeBps: Number.isFinite(feeBps) ? feeBps : 0,
				minFinalityThreshold:
					matched?.finalityThreshold ?? params.minFinalityThreshold,
				estimatedSeconds: this.estimateSeconds(params.minFinalityThreshold),
			};
		} catch {
			return {
				feeBps: 0,
				minFinalityThreshold: params.minFinalityThreshold,
				estimatedSeconds: this.estimateSeconds(params.minFinalityThreshold),
			};
		}
	}

	private estimateSeconds(minFinalityThreshold: number): number {
		return minFinalityThreshold <= FinalityThreshold.FAST ? 30 : 15 * 60;
	}
}
