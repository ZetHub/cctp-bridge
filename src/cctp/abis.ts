export const USDC_ABI = [
	{
		type: "function",
		name: "balanceOf",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ type: "uint256" }],
	},
	{
		type: "function",
		name: "allowance",
		stateMutability: "view",
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "spender", type: "address" },
		],
		outputs: [{ type: "uint256" }],
	},
	{
		type: "function",
		name: "approve",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "spender", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ type: "bool" }],
	},
	{
		type: "function",
		name: "decimals",
		stateMutability: "view",
		inputs: [],
		outputs: [{ type: "uint8" }],
	},
] as const;

export const TOKEN_MESSENGER_V2_ABI = [
	{
		type: "function",
		name: "depositForBurn",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "amount", type: "uint256" },
			{ name: "destinationDomain", type: "uint32" },
			{ name: "mintRecipient", type: "bytes32" },
			{ name: "burnToken", type: "address" },
			{ name: "destinationCaller", type: "bytes32" },
			{ name: "maxFee", type: "uint256" },
			{ name: "minFinalityThreshold", type: "uint32" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "depositForBurnWithHook",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "amount", type: "uint256" },
			{ name: "destinationDomain", type: "uint32" },
			{ name: "mintRecipient", type: "bytes32" },
			{ name: "burnToken", type: "address" },
			{ name: "destinationCaller", type: "bytes32" },
			{ name: "maxFee", type: "uint256" },
			{ name: "minFinalityThreshold", type: "uint32" },
			{ name: "hookData", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "event",
		name: "DepositForBurn",
		inputs: [
			{ name: "burnToken", type: "address", indexed: true },
			{ name: "amount", type: "uint256", indexed: false },
			{ name: "depositor", type: "address", indexed: true },
			{ name: "mintRecipient", type: "bytes32", indexed: false },
			{ name: "destinationDomain", type: "uint32", indexed: false },
			{ name: "destinationTokenMessenger", type: "bytes32", indexed: false },
			{ name: "destinationCaller", type: "bytes32", indexed: false },
			{ name: "maxFee", type: "uint256", indexed: false },
			{ name: "minFinalityThreshold", type: "uint32", indexed: false },
			{ name: "hookData", type: "bytes", indexed: false },
		],
		anonymous: false,
	},
] as const;

export const MESSAGE_TRANSMITTER_V2_ABI = [
	{
		type: "function",
		name: "receiveMessage",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "message", type: "bytes" },
			{ name: "attestation", type: "bytes" },
		],
		outputs: [{ type: "bool" }],
	},
	{
		type: "function",
		name: "usedNonces",
		stateMutability: "view",
		inputs: [{ name: "nonce", type: "bytes32" }],
		outputs: [{ type: "uint256" }],
	},
	{
		type: "event",
		name: "MessageSent",
		inputs: [{ name: "message", type: "bytes", indexed: false }],
		anonymous: false,
	},
	{
		type: "event",
		name: "MessageReceived",
		inputs: [
			{ name: "caller", type: "address", indexed: true },
			{ name: "sourceDomain", type: "uint32", indexed: false },
			{ name: "nonce", type: "uint64", indexed: false },
			{ name: "sender", type: "bytes32", indexed: false },
			{ name: "messageBody", type: "bytes", indexed: false },
		],
		anonymous: false,
	},
] as const;

export const TOKEN_MINTER_V2_ABI = [
	{
		type: "event",
		name: "MintAndWithdraw",
		inputs: [
			{ name: "mintRecipient", type: "address", indexed: true },
			{ name: "amount", type: "uint256", indexed: false },
			{ name: "mintToken", type: "address", indexed: true },
		],
		anonymous: false,
	},
] as const;
