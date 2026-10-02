import { Networks } from "@stellar/stellar-sdk";
import { ChainFamily, Environment } from "../../domain/enums";
import { Network } from "../../domain/Network";
import { NetworkId } from "../../domain/NetworkId";
import { usdc } from "./assets";
import { ATTESTATION_TIMES } from "./attestationTimes";

const EVM = {
	tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
	messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
} as const;

const STELLAR = {
	tokenMessenger: "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP",
	messageTransmitter:
		"CBJ6MTCKKZG73PMDZCJMSFRD7DQEMI4FKDH7CGDSV4W6FHCRBCQAVVJY",
	cctpForwarder: "CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ",
} as const;

const eth = new Network({
	id: NetworkId.ETHEREUM_SEPOLIA,
	name: "Ethereum Sepolia",
	shortName: "ETH",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 0,
	evmChainId: 11155111,
	tokens: [usdc("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://ethereum-sepolia-rpc.publicnode.com",
		"https://rpc.sepolia.org",
		"https://rpc.ankr.com/eth_sepolia",
	],
	explorerUrl: "https://sepolia.etherscan.io",
	accentColor: "#627EEA",
	attestationTime: ATTESTATION_TIMES.ETHEREUM,
});

const avalanche = new Network({
	id: NetworkId.AVALANCHE_FUJI,
	name: "Avalanche Fuji",
	shortName: "AVAX",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 1,
	evmChainId: 43113,
	tokens: [usdc("0x5425890298aed601595a70AB815c96711a31Bc65")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://api.avax-test.network/ext/bc/C/rpc",
		"https://avalanche-fuji-c-chain-rpc.publicnode.com",
	],
	explorerUrl: "https://testnet.snowtrace.io",
	accentColor: "#E84142",
	attestationTime: ATTESTATION_TIMES.AVALANCHE,
});

const op = new Network({
	id: NetworkId.OPTIMISM_SEPOLIA,
	name: "OP Sepolia",
	shortName: "OP",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 2,
	evmChainId: 11155420,
	tokens: [usdc("0x5fd84259d66Cd46123540766Be93DFE6D43130D7")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://sepolia.optimism.io",
		"https://optimism-sepolia-rpc.publicnode.com",
	],
	explorerUrl: "https://sepolia-optimism.etherscan.io",
	accentColor: "#FF0420",
	attestationTime: ATTESTATION_TIMES.OPTIMISM,
});

const arbitrum = new Network({
	id: NetworkId.ARBITRUM_SEPOLIA,
	name: "Arbitrum Sepolia",
	shortName: "ARB",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 3,
	evmChainId: 421614,
	tokens: [usdc("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://sepolia-rollup.arbitrum.io/rpc",
		"https://arbitrum-sepolia-rpc.publicnode.com",
	],
	explorerUrl: "https://sepolia.arbiscan.io",
	accentColor: "#28A0F0",
	attestationTime: ATTESTATION_TIMES.ARBITRUM,
});

const base = new Network({
	id: NetworkId.BASE_SEPOLIA,
	name: "Base Sepolia",
	shortName: "BASE",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 6,
	evmChainId: 84532,
	tokens: [usdc("0x036CbD53842c5426634e7929541eC2318f3dCF7e")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://sepolia.base.org",
		"https://base-sepolia-rpc.publicnode.com",
	],
	explorerUrl: "https://sepolia.basescan.org",
	accentColor: "#0052FF",
	attestationTime: ATTESTATION_TIMES.BASE,
});

const polygon = new Network({
	id: NetworkId.POLYGON_AMOY,
	name: "Polygon Amoy",
	shortName: "POL",
	family: ChainFamily.EVM,
	environment: Environment.TESTNET,
	cctpDomain: 7,
	evmChainId: 80002,
	tokens: [usdc("0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582")],
	tokenMessenger: EVM.tokenMessenger,
	messageTransmitter: EVM.messageTransmitter,
	rpcUrls: [
		"https://rpc-amoy.polygon.technology",
		"https://polygon-amoy-bor-rpc.publicnode.com",
	],
	explorerUrl: "https://amoy.polygonscan.com",
	accentColor: "#8247E5",
	attestationTime: ATTESTATION_TIMES.POLYGON,
});

const stellar = new Network({
	id: NetworkId.STELLAR_TESTNET,
	name: "Stellar Testnet",
	shortName: "XLM",
	family: ChainFamily.STELLAR,
	environment: Environment.TESTNET,
	cctpDomain: 27,
	stellarPassphrase: Networks.TESTNET,
	tokens: [
		usdc("CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", {
			decimals: 7,
			issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
			assetCode: "USDC",
		}),
	],
	tokenMessenger: STELLAR.tokenMessenger,
	messageTransmitter: STELLAR.messageTransmitter,
	cctpForwarder: STELLAR.cctpForwarder,
	rpcUrls: ["https://soroban-testnet.stellar.org"],
	explorerUrl: "https://stellar.expert/explorer/testnet",
	accentColor: "#FDDA24",
	attestationTime: ATTESTATION_TIMES.STELLAR,
});

export const testnet: Network[] = [
	eth,
	avalanche,
	op,
	arbitrum,
	base,
	polygon,
	stellar,
];
