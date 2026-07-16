import { Environment } from "../../domain/enums";
import type { Network } from "../../domain/Network";
import type { INetworkService } from "../../ports/INetworkService";
import { mainnet } from "./mainnet.config";
import { testnet } from "./testnet.config";

export type NetworkRegistry = Record<Environment, readonly Network[]>;

export const DEFAULT_NETWORKS: NetworkRegistry = {
	[Environment.MAINNET]: mainnet,
	[Environment.TESTNET]: testnet,
};

export class NetworkService implements INetworkService {
	constructor(private readonly registry: NetworkRegistry = DEFAULT_NETWORKS) {}

	list(environment: Environment): readonly Network[] {
		return this.registry[environment];
	}

	byId(environment: Environment, id: string): Network | undefined {
		return this.list(environment).find((n) => n.id === id);
	}

	byDomain(environment: Environment, domain: number): Network | undefined {
		return this.list(environment).find((n) => n.cctpDomain === domain);
	}

	byEvmChainId(environment: Environment, chainId: number): Network | undefined {
		return this.list(environment).find((n) => n.evmChainId === chainId);
	}
}
