/** Decimals of the `amount` inside a CCTP message, on every chain. Contract
 *  arguments use the source token's own decimals (7 on Stellar), so scale to
 *  this only to read a message amount or to drop precision a message cannot
 *  carry. */
export const CCTP_AMOUNT_DECIMALS = 6;

/** USDC decimals per chain family (identical across every CCTP V2 deployment). */
export const USDC_DECIMALS = {
	EVM: 6,
	STELLAR: 7,
} as const;
