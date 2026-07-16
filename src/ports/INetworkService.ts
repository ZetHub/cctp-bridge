import type { Environment } from "../domain/enums";
import type { Network } from "../domain/Network";

export interface INetworkService {
	list(environment: Environment): readonly Network[];
	byId(environment: Environment, id: string): Network | undefined;
	byDomain(environment: Environment, domain: number): Network | undefined;
	byEvmChainId(environment: Environment, chainId: number): Network | undefined;
}
