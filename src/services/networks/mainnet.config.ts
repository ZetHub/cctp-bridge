import { Networks } from "@stellar/stellar-sdk";
import { ChainFamily, Environment } from "../../domain/enums";
import { Network } from "../../domain/Network";
import { NetworkId } from "../../domain/NetworkId";
import { usdc } from "./assets";
import { ATTESTATION_TIMES } from "./attestationTimes";

const EVM = {
	tokenMessenger: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
	messageTransmitter: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
} as const;

const STELLAR = {
	tokenMessenger: "CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL",
	messageTransmitter:
		"CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV",
	cctpForwarder: "CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T",
} as const;

const eth = new Network({
	id: NetworkId.ETHEREUM,
	name: "Ethereum",
	shortName: "ETH",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 0,
	evmChainId: 1,
	tokens: [usdc("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://eth.llamarpc.com",
		"https://ethereum-rpc.publicnode.com",
		"https://rpc.ankr.com/eth",
		"https://cloudflare-eth.com",
	],
	explorerUrl: "https://etherscan.io",
	accentColor: "#627EEA",
	attestationTime: ATTESTATION_TIMES.ETHEREUM,
});

const avalanche = new Network({
	id: NetworkId.AVALANCHE,
	name: "Avalanche",
	shortName: "AVAX",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 1,
	evmChainId: 43114,
	tokens: [usdc("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://api.avax.network/ext/bc/C/rpc",
		"https://avalanche-c-chain-rpc.publicnode.com",
		"https://rpc.ankr.com/avalanche",
	],
	explorerUrl: "https://snowtrace.io",
	accentColor: "#E84142",
	attestationTime: ATTESTATION_TIMES.AVALANCHE,
});

const op = new Network({
	id: NetworkId.OPTIMISM,
	name: "OP Mainnet",
	shortName: "OP",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 2,
	evmChainId: 10,
	tokens: [usdc("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://mainnet.optimism.io",
		"https://optimism-rpc.publicnode.com",
		"https://rpc.ankr.com/optimism",
	],
	explorerUrl: "https://optimistic.etherscan.io",
	accentColor: "#FF0420",
	attestationTime: ATTESTATION_TIMES.OPTIMISM,
});

const arbitrum = new Network({
	id: NetworkId.ARBITRUM,
	name: "Arbitrum",
	shortName: "ARB",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 3,
	evmChainId: 42161,
	tokens: [usdc("0xaf88d065e77c8cC2239327C5EDb3A432268e5831")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://arb1.arbitrum.io/rpc",
		"https://arbitrum-one-rpc.publicnode.com",
		"https://rpc.ankr.com/arbitrum",
	],
	explorerUrl: "https://arbiscan.io",
	accentColor: "#28A0F0",
	attestationTime: ATTESTATION_TIMES.ARBITRUM,
});

const base = new Network({
	id: NetworkId.BASE,
	name: "Base",
	shortName: "BASE",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 6,
	evmChainId: 8453,
	tokens: [usdc("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://mainnet.base.org",
		"https://base-rpc.publicnode.com",
		"https://rpc.ankr.com/base",
	],
	explorerUrl: "https://basescan.org",
	accentColor: "#0052FF",
	attestationTime: ATTESTATION_TIMES.BASE,
});

const polygon = new Network({
	id: NetworkId.POLYGON,
	name: "Polygon",
	shortName: "POL",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 7,
	evmChainId: 137,
	tokens: [usdc("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://polygon-rpc.com",
		"https://polygon-bor-rpc.publicnode.com",
		"https://rpc.ankr.com/polygon",
	],
	explorerUrl: "https://polygonscan.com",
	accentColor: "#8247E5",
	attestationTime: ATTESTATION_TIMES.POLYGON,
});

const unichain = new Network({
	id: NetworkId.UNICHAIN,
	name: "Unichain",
	shortName: "UNI",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 10,
	evmChainId: 130,
	tokens: [usdc("0x078D782b760474a361dDA0AF3839290b0EF57AD6")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: ["https://mainnet.unichain.org", "https://unichain.drpc.org"],
	explorerUrl: "https://uniscan.xyz",
	accentColor: "#FF007A",
	attestationTime: ATTESTATION_TIMES.UNICHAIN,
});

const linea = new Network({
	id: NetworkId.LINEA,
	name: "Linea",
	shortName: "LINEA",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 11,
	evmChainId: 59144,
	tokens: [usdc("0x176211869cA2b568f2A7D4EE941E073a821EE1ff")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"],
	explorerUrl: "https://lineascan.build",
	accentColor: "#121212",
	attestationTime: ATTESTATION_TIMES.LINEA,
});

const codex = new Network({
	id: NetworkId.CODEX,
	name: "Codex",
	shortName: "CDX",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 12,
	evmChainId: 81224,
	tokens: [usdc("0xd996633a415985DBd7D6D12f4A4343E31f5037cf")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: ["https://rpc.codex.xyz"],
	explorerUrl: "https://explorer.codex.xyz",
	accentColor: "#7B61FF",
	attestationTime: ATTESTATION_TIMES.CODEX,
});

const sonic = new Network({
	id: NetworkId.SONIC,
	name: "Sonic",
	shortName: "S",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 13,
	evmChainId: 146,
	tokens: [usdc("0x29219dd400f2Bf60E5a23d13be72b486d4038894")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: ["https://rpc.soniclabs.com", "https://sonic.drpc.org"],
	explorerUrl: "https://sonicscan.org",
	accentColor: "#FE9A4D",
	attestationTime: ATTESTATION_TIMES.SONIC,
});

const world = new Network({
	id: NetworkId.WORLDCHAIN,
	name: "World Chain",
	shortName: "WORLD",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 14,
	evmChainId: 480,
	tokens: [usdc("0x79A02482A880bCe3F13E09da970dC34dB4cD24D1")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://worldchain-mainnet.g.alchemy.com/public",
		"https://480.rpc.thirdweb.com",
	],
	explorerUrl: "https://worldscan.org",
	accentColor: "#000000",
	attestationTime: ATTESTATION_TIMES.WORLDCHAIN,
});

const sei = new Network({
	id: NetworkId.SEI,
	name: "Sei",
	shortName: "SEI",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 16,
	evmChainId: 1329,
	tokens: [usdc("0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://evm-rpc.sei-apis.com",
		"https://sei-evm-rpc.publicnode.com",
	],
	explorerUrl: "https://seitrace.com",
	accentColor: "#9E1F19",
	attestationTime: ATTESTATION_TIMES.SEI,
});

const hyper = new Network({
	id: NetworkId.HYPEREVM,
	name: "HyperEVM",
	shortName: "HYPE",
	family: ChainFamily.EVM,
	environment: Environment.MAINNET,
	cctpDomain: 19,
	evmChainId: 999,
	tokens: [usdc("0xb88339CB7199b77E23DB6E890353E22632Ba630f")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: ["https://rpc.hyperliquid.xyz/evm"],
	explorerUrl: "https://hyperevmscan.io",
	accentColor: "#97FCE4",
	attestationTime: ATTESTATION_TIMES.HYPEREVM,
});

const stellar = new Network({
	id: NetworkId.STELLAR,
	name: "Stellar",
	shortName: "XLM",
	family: ChainFamily.STELLAR,
	environment: Environment.MAINNET,
	cctpDomain: 27,
	stellarPassphrase: Networks.PUBLIC,
	tokens: [
		usdc("CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75", {
			decimals: 7,
			issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
			assetCode: "USDC",
		}),
	],
	tokenMessenger: STELLAR.tokenMessenger,
	messageTransmitter: STELLAR.messageTransmitter,
	cctpForwarder: STELLAR.cctpForwarder,
	rpcUrls: ["https://mainnet.sorobanrpc.com"],
	explorerUrl: "https://stellar.expert/explorer/public",
	accentColor: "#FDDA24",
	attestationTime: ATTESTATION_TIMES.STELLAR,
});

export const mainnet: Network[] = [
	eth,
	avalanche,
	op,
	arbitrum,
	base,
	polygon,
	unichain,
	linea,
	codex,
	sonic,
	world,
	sei,
	hyper,
	stellar,
];
