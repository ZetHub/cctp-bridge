/**
 * Iris returns fees as decimal basis points (e.g. `1.3` for Arbitrum → Ethereum
 * Fast). To stay in `bigint` arithmetic we widen decimal bps to an integer by
 * multiplying by `BPS_DECIMAL_PRECISION`, then divide by the combined divisor
 * that turns bps into a fraction: `BPS_DECIMAL_PRECISION * BPS_TO_FRACTION`.
 */

/** 1 bp = 0.01% = 1/10000. */
const BPS_TO_FRACTION = 10_000n;

/** Widen decimal bps (e.g. 1.3) to integer bps (e.g. 1_300_000) before the
 *  bigint divide, so we never lose precision. Six decimals of headroom is
 *  plenty for Iris. */
const BPS_DECIMAL_PRECISION = 1_000_000n;

/** Combined divisor: multiplying by decimal-scaled bps and dividing by this
 *  gives the fraction of the amount. */
const BPS_DIVISOR = BPS_TO_FRACTION * BPS_DECIMAL_PRECISION;

/** Bump the Iris-reported fee by this many percent when setting `maxFee`, so
 *  small re-quotes between build time and confirmation do not park the burn. */
const MAX_FEE_BUFFER_PERCENT = 20n;
const PERCENT_BASE = 100n;

export class FeeMath {
	static feeSubunits(amountSubunits: bigint, feeBps: number): bigint {
		if (!feeBps || amountSubunits <= 0n) {
			return 0n;
		}
		const scaledBps = BigInt(
			Math.round(feeBps * Number(BPS_DECIMAL_PRECISION)),
		);
		return (amountSubunits * scaledBps) / BPS_DIVISOR;
	}

	static maxFeeWithBuffer(amountSubunits: bigint, feeBps: number): bigint {
		const fee = FeeMath.feeSubunits(amountSubunits, feeBps);
		if (fee === 0n) {
			return 0n;
		}
		return (fee * (PERCENT_BASE + MAX_FEE_BUFFER_PERCENT)) / PERCENT_BASE;
	}
}
