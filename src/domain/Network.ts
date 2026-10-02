import { AttestationTime } from "./AttestationTime";
import type { AssetSymbol, Environment } from "./enums";
import { ChainFamily } from "./enums";
import type { TokenAsset } from "./TokenAsset";

export interface NetworkProps {
	readonly id: string;
	readonly name: string;
	readonly shortName: string;
	readonly family: ChainFamily;
	readonly environment: Environment;
	readonly cctpDomain: number;
	readonly evmChainId?: number;
	readonly stellarPassphrase?: string;
	readonly tokens: readonly TokenAsset[];
	readonly defaultAsset?: AssetSymbol;
	readonly tokenMessenger: string;
	readonly messageTransmitter: string;
	readonly cctpForwarder?: string;
	readonly rpcUrls: readonly string[];
	readonly explorerUrl: string;
	readonly accentColor: string;
	readonly attestationTime?: AttestationTime;
}

export class Network implements NetworkProps {
	readonly id: string;
	readonly name: string;
	readonly shortName: string;
	readonly family: ChainFamily;
	readonly environment: Environment;
	readonly cctpDomain: number;
	readonly evmChainId?: number;
	readonly stellarPassphrase?: string;
	readonly tokens: readonly TokenAsset[];
	readonly defaultAsset: AssetSymbol;
	readonly tokenMessenger: string;
	readonly messageTransmitter: string;
	readonly cctpForwarder?: string;
	readonly rpcUrls: readonly string[];
	readonly explorerUrl: string;
	readonly accentColor: string;
	readonly attestationTime: AttestationTime;

	constructor(props: NetworkProps) {
		if (!props.rpcUrls.length) {
			throw new Error(`Network ${props.id} must have at least one RPC URL`);
		}
		if (!props.tokens.length) {
			throw new Error(`Network ${props.id} must configure at least one token`);
		}
		this.id = props.id;
		this.name = props.name;
		this.shortName = props.shortName;
		this.family = props.family;
		this.environment = props.environment;
		this.cctpDomain = props.cctpDomain;
		this.evmChainId = props.evmChainId;
		this.stellarPassphrase = props.stellarPassphrase;
		this.tokens = props.tokens;
		this.defaultAsset = props.defaultAsset ?? props.tokens[0].symbol;
		this.tokenMessenger = props.tokenMessenger;
		this.messageTransmitter = props.messageTransmitter;
		this.cctpForwarder = props.cctpForwarder;
		this.rpcUrls = props.rpcUrls;
		this.explorerUrl = props.explorerUrl;
		this.accentColor = props.accentColor;
		this.attestationTime = props.attestationTime ?? AttestationTime.GENERIC;
	}

	get rpcUrl(): string {
		return this.rpcUrls[0];
	}

	hasToken(symbol: AssetSymbol): boolean {
		return this.tokens.some((t) => t.symbol === symbol);
	}

	token(symbol: AssetSymbol = this.defaultAsset): TokenAsset {
		const match = this.tokens.find((t) => t.symbol === symbol);
		if (!match) {
			throw new Error(`Network ${this.id} does not support ${symbol}`);
		}
		return match;
	}

	isEvm(): boolean {
		return this.family === ChainFamily.EVM;
	}

	isStellar(): boolean {
		return this.family === ChainFamily.STELLAR;
	}

	withRpcUrls(rpcUrls: readonly string[]): Network {
		return new Network({ ...this, rpcUrls });
	}
}
