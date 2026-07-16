import { Networks } from "@stellar/stellar-sdk";
import { Environment } from "../domain/enums";
import type { Network } from "../domain/Network";

export class StellarPassphrase {
	static for(network: Network): string {
		if (network.stellarPassphrase) {
			return network.stellarPassphrase;
		}
		return network.environment === Environment.TESTNET
			? Networks.TESTNET
			: Networks.PUBLIC;
	}
}
