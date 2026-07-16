import { ValidationMessage } from "../validation/messages";
import { humanAmountSchema } from "../validation/schemas";
import { ChainFamily } from "./enums";
import { USDC_DECIMALS } from "./Token";

/** Base of the decimal number system. Used to build 10^n scaling factors when
 *  moving between decimal precisions. */
const DECIMAL_BASE = 10n;

/**
 * Immutable fixed-point token amount. Keeps the raw integer subunit value and
 * the number of decimals so arithmetic stays exact (bigint) and display is easy.
 */
export class Amount {
	readonly raw: bigint;
	readonly decimals: number;

	private constructor(raw: bigint, decimals: number) {
		this.raw = raw;
		this.decimals = decimals;
	}

	/** Build a USDC amount from an on-chain subunit `bigint` (e.g. what
	 *  `balanceOf` returns). The class resolves the correct USDC decimals
	 *  internally: 6 on every EVM chain, 7 on Stellar. */
	static fromRaw(raw: bigint, family: ChainFamily): Amount {
		return new Amount(raw, Amount.usdcDecimalsFor(family));
	}

	/** Build a USDC amount from human-readable input (`"5.25"`) targeting a
	 *  chain family. Same decimals rule as `fromRaw`. */
	static fromHuman(value: string | number, family: ChainFamily): Amount {
		return Amount.parseHuman(value, Amount.usdcDecimalsFor(family));
	}

	/** Escape hatch: raw `bigint` with explicit decimals. Use for non-USDC
	 *  assets (native gas, custom tokens, etc). */
	static fromRawWithDecimals(raw: bigint, decimals: number): Amount {
		return new Amount(raw, decimals);
	}

	/** Escape hatch: parse a human amount with explicit decimals. Use for
	 *  non-USDC assets. */
	static fromHumanWithDecimals(
		value: string | number,
		decimals: number,
	): Amount {
		return Amount.parseHuman(value, decimals);
	}

	private static usdcDecimalsFor(family: ChainFamily): number {
		return family === ChainFamily.STELLAR
			? USDC_DECIMALS.STELLAR
			: USDC_DECIMALS.EVM;
	}

	private static parseHuman(value: string | number, decimals: number): Amount {
		const text = typeof value === "number" ? value.toString() : value.trim();
		if (!text || text === ".") {
			return new Amount(0n, decimals);
		}
		if (!humanAmountSchema.safeParse(text).success) {
			throw new Error(ValidationMessage.INVALID_AMOUNT);
		}
		const [intPart, fracPartRaw = ""] = text.split(".");
		const fracPart = (fracPartRaw + "0".repeat(decimals)).slice(0, decimals);
		const combined = `${intPart || "0"}${fracPart}`.replace(/^0+/, "") || "0";
		return new Amount(BigInt(combined), decimals);
	}

	scaleTo(newDecimals: number): Amount {
		if (newDecimals === this.decimals) {
			return this;
		}
		if (newDecimals > this.decimals) {
			const factor = DECIMAL_BASE ** BigInt(newDecimals - this.decimals);
			return new Amount(this.raw * factor, newDecimals);
		}
		const factor = DECIMAL_BASE ** BigInt(this.decimals - newDecimals);
		return new Amount(this.raw / factor, newDecimals);
	}

	toHuman(displayDecimals?: number): string {
		const negative = this.raw < 0n;
		const absRaw = negative ? -this.raw : this.raw;
		const base = absRaw.toString().padStart(this.decimals + 1, "0");
		const intPart = base.slice(0, base.length - this.decimals);
		const fracPart = base.slice(base.length - this.decimals);
		const trimmed =
			displayDecimals != null
				? fracPart.slice(0, displayDecimals)
				: fracPart.replace(/0+$/, "");
		const sign = negative ? "-" : "";
		return trimmed ? `${sign}${intPart}.${trimmed}` : `${sign}${intPart}`;
	}

	isZero(): boolean {
		return this.raw === 0n;
	}

	gte(other: Amount): boolean {
		if (this.decimals !== other.decimals) {
			return this.scaleTo(other.decimals).raw >= other.raw;
		}
		return this.raw >= other.raw;
	}
}
