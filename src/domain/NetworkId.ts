export const NetworkId = {
	// Mainnet
	ETHEREUM: "ethereum",
	AVALANCHE: "avalanche",
	OPTIMISM: "optimism",
	ARBITRUM: "arbitrum",
	BASE: "base",
	POLYGON: "polygon",
	UNICHAIN: "unichain",
	LINEA: "linea",
	CODEX: "codex",
	SONIC: "sonic",
	WORLDCHAIN: "worldchain",
	SEI: "sei",
	HYPEREVM: "hyperevm",
	STELLAR: "stellar",
	// Testnet
	ETHEREUM_SEPOLIA: "ethereum-sepolia",
	AVALANCHE_FUJI: "avalanche-fuji",
	OPTIMISM_SEPOLIA: "optimism-sepolia",
	ARBITRUM_SEPOLIA: "arbitrum-sepolia",
	BASE_SEPOLIA: "base-sepolia",
	POLYGON_AMOY: "polygon-amoy",
	STELLAR_TESTNET: "stellar-testnet",
} as const;

export type NetworkId = (typeof NetworkId)[keyof typeof NetworkId];

/** Accepts a known NetworkId while still allowing custom ids for custom registries. */
export type NetworkIdInput = NetworkId | (string & {});
