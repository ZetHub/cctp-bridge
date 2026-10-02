/** CCTP settles burn/mint amounts in 6-decimal subunits regardless of chain. */
export const CCTP_AMOUNT_DECIMALS = 6;

/** USDC decimals per chain family (identical across every CCTP V2 deployment). */
export const USDC_DECIMALS = {
	EVM: 6,
	STELLAR: 7,
} as const;
