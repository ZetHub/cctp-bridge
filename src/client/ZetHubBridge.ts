import { StellarRpc } from "../cctp/StellarRpc";
import { StellarTrustline } from "../cctp/StellarTrustline";
import { Amount } from "../domain/Amount";
import type { BridgeQuote } from "../domain/BridgeTransaction";
import {
	AssetSymbol,
	ChainFamily,
	Environment,
	type FinalityThreshold,
	RpcMode,
} from "../domain/enums";
import type { Network } from "../domain/Network";
import type { NetworkIdInput } from "../domain/NetworkId";
import { BridgeError } from "../errors";
import type {
	AttestationPollUpdate,
	AttestationResult,
	IAttestationService,
} from "../ports/IAttestationService";
import type { IChainConnector } from "../ports/IChainConnector";
import type { IFeeService } from "../ports/IFeeService";
import type { INetworkService } from "../ports/INetworkService";
import { IrisAttestationService } from "../services/attestation/IrisAttestationService";
import {
	DefaultRawTxBuilder,
	type RawTxBuilder,
	type TokenWithChainDetails,
} from "../services/bridge/RawTxBuilder";
import { EvmChainConnector } from "../services/chains/EvmChainConnector";
import { StellarChainConnector } from "../services/chains/StellarChainConnector";
import { IrisFeeService } from "../services/fees/IrisFeeService";
import {
	DEFAULT_NETWORKS,
	type NetworkRegistry,
	NetworkService,
} from "../services/networks/NetworkService";
import { bytes32Schema } from "../validation/schemas";

/* ─────────────────────────────  Options  ───────────────────────────── */

export type NodeRpcUrls = Partial<Record<NetworkIdInput, readonly string[]>>;

export interface ZetHubBridgeOptions {
	/** Per-network RPC URL overrides, keyed by network id. Prepended to defaults. */
	rpc?: NodeRpcUrls;
	rpcMode?: RpcMode;
	/** Which network set to expose. Defaults to `Environment.MAINNET`. */
	environment?: Environment;
	/** Override the Iris attestation endpoints (mainnet + testnet). */
	attestation?: IAttestationService;
	/** Override the Iris fee service. */
	fees?: IFeeService;
	/** Register additional chain connectors, or replace the built-in
	 *  `evm` / `stellar` ones. Extension point for adding a new chain family
	 *  without patching the SDK. */
	connectors?: Partial<Record<ChainFamily, IChainConnector>>;
}

/* ─────────────────────────────  Discovery  ───────────────────────────── */

export interface ChainDetails {
	readonly network: Network;
	readonly tokens: readonly TokenWithChainDetails[];
}

export type ChainDetailsMap = Record<string, ChainDetails>;

export type { TokenWithChainDetails } from "../services/bridge/RawTxBuilder";

/* ─────────────────────────────  Bridge API types  ───────────────────────────── */

export interface CheckAllowanceParams {
	token: TokenWithChainDetails;
	owner: string;
	amount: Amount | string | number;
}

export interface GetAllowanceParams {
	token: TokenWithChainDetails;
	owner: string;
}

export interface IsMessageReceivedParams {
	destinationToken: TokenWithChainDetails;
	eventNonce: string;
}

export interface BridgeQuoteParams {
	sourceToken: TokenWithChainDetails;
	destinationToken: TokenWithChainDetails;
	minFinalityThreshold?: FinalityThreshold;
}

/* ─────────────────────────────  Attestation types  ───────────────────────────── */

export interface AttestationEnvelope {
	readonly message: `0x${string}`;
	readonly attestation: `0x${string}`;
	readonly eventNonce?: string;
	readonly status: AttestationResult["status"];
}

export interface AttestationWaitOptions {
	readonly intervalMs?: number;
	readonly timeoutMs?: number;
	readonly onPoll?: (update: AttestationPollUpdate) => void;
}

/* ─────────────────────────────  Balance types  ───────────────────────────── */

export interface GetTokenBalanceParams {
	token: TokenWithChainDetails;
	address: string;
}

export interface GetNativeTokenBalanceParams {
	chainSymbol: NetworkIdInput;
	address: string;
}

/* ─────────────────────────────  API interfaces  ───────────────────────────── */

export interface BridgeAPI {
	readonly rawTxBuilder: RawTxBuilder;
	getAllowance(params: GetAllowanceParams): Promise<string>;
	checkAllowance(params: CheckAllowanceParams): Promise<boolean>;
	quote(params: BridgeQuoteParams): Promise<BridgeQuote>;
	isMessageReceived(params: IsMessageReceivedParams): Promise<boolean>;
	hasTrustline(params: {
		token: TokenWithChainDetails;
		address: string;
	}): Promise<boolean>;
}

export interface AttestationAPI {
	fetch(
		source: NetworkIdInput,
		burnTxHash: string,
	): Promise<AttestationEnvelope>;
	waitFor(
		source: NetworkIdInput,
		burnTxHash: string,
		opts?: AttestationWaitOptions,
	): Promise<AttestationEnvelope>;
}

/* ─────────────────────────────  Client class  ───────────────────────────── */

/**
 * Client-side SDK for native cross-chain USDC transfers over CCTP V2. The
 * SDK never touches keys — every write returns an unsigned `RawTransaction`
 * for the caller to sign and broadcast with their own wallet library.
 */
export class ZetHubBridge {
	readonly environment: Environment;
	readonly bridge: BridgeAPI;
	readonly attestation: AttestationAPI;

	private readonly networkService: INetworkService;
	private readonly connectors: Record<ChainFamily, IChainConnector>;
	private readonly stellarRpc: StellarRpc;
	private readonly trustline: StellarTrustline;
	private readonly attestationService: IAttestationService;
	private readonly feeService: IFeeService;
	private readonly rawTxBuilder: RawTxBuilder;

	constructor(options: ZetHubBridgeOptions = {}) {
		this.environment = options.environment ?? Environment.MAINNET;
		this.stellarRpc = new StellarRpc();
		this.trustline = new StellarTrustline(this.stellarRpc);
		this.attestationService =
			options.attestation ?? new IrisAttestationService();
		this.feeService = options.fees ?? new IrisFeeService();

		const registry = this.applyRpcOverrides(
			DEFAULT_NETWORKS,
			options.rpc,
			options.rpcMode ?? RpcMode.PREPEND,
		);
		this.networkService = new NetworkService(registry);

		this.connectors = {
			[ChainFamily.EVM]: new EvmChainConnector(),
			[ChainFamily.STELLAR]: new StellarChainConnector(this.stellarRpc),
			...(options.connectors ?? {}),
		} as Record<ChainFamily, IChainConnector>;
		this.rawTxBuilder = new DefaultRawTxBuilder({
			connectors: this.connectors,
			networks: this.networkService,
			feeService: this.feeService,
		});

		this.bridge = this.buildBridgeApi();
		this.attestation = this.buildAttestationApi();
	}

	/* ───── Discovery ───── */

	async chainDetailsMap(): Promise<ChainDetailsMap> {
		const list = this.networkService.list(this.environment);
		const out: ChainDetailsMap = {};
		for (const network of list) {
			out[network.id] = {
				network,
				tokens: this.tokensFor(network),
			};
		}
		return out;
	}

	async tokens(): Promise<readonly TokenWithChainDetails[]> {
		const list = this.networkService.list(this.environment);
		return list.flatMap((network) => this.tokensFor(network));
	}

	async tokensByChain(
		networkId: NetworkIdInput,
	): Promise<readonly TokenWithChainDetails[]> {
		return this.tokensFor(this.network(networkId));
	}

	supportedAssets(): readonly AssetSymbol[] {
		return [AssetSymbol.USDC];
	}

	/* ───── Balances ───── */

	async getTokenBalance(params: GetTokenBalanceParams): Promise<string> {
		const { token, address } = params;
		const connector = this.connectorFor(token.network);
		const balance = await connector.getTokenBalance({
			network: token.network,
			token: token.network.token(token.symbol),
			owner: address,
		});
		return balance.toHuman();
	}

	async getNativeTokenBalance(
		params: GetNativeTokenBalanceParams,
	): Promise<string> {
		const network = this.network(params.chainSymbol);
		const connector = this.connectorFor(network);
		const balance = await connector.getNativeBalance({
			network,
			owner: params.address,
		});
		return balance.toHuman();
	}

	getGasBalance(params: GetNativeTokenBalanceParams): Promise<string> {
		return this.getNativeTokenBalance(params);
	}

	/* ─────────────────────  BridgeAPI construction  ───────────────────── */

	private buildBridgeApi(): BridgeAPI {
		const rawTxBuilder = this.rawTxBuilder;
		return {
			rawTxBuilder,
			getAllowance: async (params: GetAllowanceParams): Promise<string> => {
				const { token, owner } = params;
				const connector = this.connectorFor(token.network);
				const allowance = await connector.getAllowance({
					network: token.network,
					token: token.network.token(token.symbol),
					owner,
				});
				return allowance.toHuman();
			},
			checkAllowance: async (
				params: CheckAllowanceParams,
			): Promise<boolean> => {
				const { token, owner, amount } = params;
				const connector = this.connectorFor(token.network);
				const allowance = await connector.getAllowance({
					network: token.network,
					token: token.network.token(token.symbol),
					owner,
				});
				const requested =
					amount instanceof Amount
						? amount
						: Amount.fromHuman(String(amount), token.network.family);
				return allowance.gte(requested);
			},
			quote: (params: BridgeQuoteParams): Promise<BridgeQuote> => {
				const source = params.sourceToken.network;
				const destination = params.destinationToken.network;
				return this.feeService.getQuote({
					environment: this.environment,
					sourceDomain: source.cctpDomain,
					destinationDomain: destination.cctpDomain,
					minFinalityThreshold:
						params.minFinalityThreshold ??
						source.attestationTime.defaultThreshold(),
					attestationTime: source.attestationTime,
				});
			},
			isMessageReceived: async (
				params: IsMessageReceivedParams,
			): Promise<boolean> => {
				const { destinationToken, eventNonce } = params;
				if (!bytes32Schema.safeParse(eventNonce).success) {
					throw new BridgeError("NONCE_INVALID");
				}
				const network = destinationToken.network;
				return this.connectorFor(network).isMessageReceived({
					network,
					nonce: eventNonce as `0x${string}`,
				});
			},
			hasTrustline: async (params: {
				token: TokenWithChainDetails;
				address: string;
			}): Promise<boolean> => {
				const { token, address } = params;
				if (token.network.family !== ChainFamily.STELLAR) {
					return true;
				}
				return this.trustline.has(
					token.network,
					address,
					token.network.token(token.symbol),
				);
			},
		};
	}

	/* ───────────────────  AttestationAPI construction  ─────────────────── */

	private buildAttestationApi(): AttestationAPI {
		return {
			fetch: async (
				sourceId: NetworkIdInput,
				burnTxHash: string,
			): Promise<AttestationEnvelope> => {
				return this.pollOnce(sourceId, burnTxHash);
			},
			waitFor: async (
				sourceId: NetworkIdInput,
				burnTxHash: string,
				opts?: AttestationWaitOptions,
			): Promise<AttestationEnvelope> => {
				const source = this.network(sourceId);
				const result = await this.attestationService.waitForAttestation({
					environment: this.environment,
					sourceDomain: source.cctpDomain,
					transactionHash: burnTxHash,
					intervalMs: opts?.intervalMs,
					timeoutMs: opts?.timeoutMs,
					onPoll: opts?.onPoll,
				});
				return {
					message: result.message,
					attestation: result.attestation,
					eventNonce: result.eventNonce,
					status: result.status,
				};
			},
		};
	}

	private async pollOnce(
		sourceId: NetworkIdInput,
		burnTxHash: string,
	): Promise<AttestationEnvelope> {
		const source = this.network(sourceId);
		const result = await this.attestationService.waitForAttestation({
			environment: this.environment,
			sourceDomain: source.cctpDomain,
			transactionHash: burnTxHash,
			timeoutMs: 1,
		});
		return {
			message: result.message,
			attestation: result.attestation,
			eventNonce: result.eventNonce,
			status: result.status,
		};
	}

	/* ───── Helpers ───── */

	private network(id: NetworkIdInput): Network {
		const match = this.networkService.byId(this.environment, id);
		if (!match) {
			throw new BridgeError("MISSING_SOURCE", `Unknown network: ${id}`);
		}
		return match;
	}

	private connectorFor(network: Network): IChainConnector {
		const connector = this.connectors[network.family];
		if (!connector) {
			throw new BridgeError(
				"UNSUPPORTED_ROUTE",
				`No chain connector registered for family ${network.family}`,
			);
		}
		return connector;
	}

	private tokensFor(network: Network): TokenWithChainDetails[] {
		return network.tokens.map((token) => this.attachChain(network, token));
	}

	private attachChain(
		network: Network,
		token: import("../domain/TokenAsset").TokenAsset,
	): TokenWithChainDetails {
		return {
			symbol: token.symbol,
			name: token.name,
			decimals: token.decimals,
			address: token.address,
			issuer: token.issuer,
			assetCode: token.assetCode,
			logoUrl: token.logoUrl,
			chainSymbol: network.id,
			network,
		};
	}

	private applyRpcOverrides(
		registry: NetworkRegistry,
		overrides: NodeRpcUrls | undefined,
		mode: RpcMode,
	): NetworkRegistry {
		if (!overrides) {
			return registry;
		}
		const patch = (nets: readonly Network[]): readonly Network[] =>
			nets.map((n) => {
				const override = overrides[n.id as NetworkIdInput];
				if (!override?.length) {
					return n;
				}
				const urls =
					mode === RpcMode.REPLACE
						? [...new Set(override)]
						: [...new Set([...override, ...n.rpcUrls])];
				return n.withRpcUrls(urls);
			});
		return {
			[Environment.MAINNET]: patch(registry[Environment.MAINNET]),
			[Environment.TESTNET]: patch(registry[Environment.TESTNET]),
		};
	}
}
