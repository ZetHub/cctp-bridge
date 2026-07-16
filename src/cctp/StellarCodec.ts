import { Memo, xdr } from "@stellar/stellar-sdk";
import type { BridgeMemo } from "../domain/BridgeMemo";
import { MemoType } from "../domain/enums";
import { ValidationMessage } from "../validation/messages";

/** Soroban's i128 is split into a signed high u64 and an unsigned low u64. */
const I128_HALF_WIDTH_BITS = 64n;
/** Mask that isolates the low u64 half of an i128. */
const U64_MASK = (1n << I128_HALF_WIDTH_BITS) - 1n;

/** Maximum text-memo length permitted by Stellar (ASCII bytes). */
const MEMO_TEXT_MAX_LENGTH = 28;

export class StellarCodec {
	static hexToBytes(hex: string): Uint8Array {
		const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
		if (stripped.length % 2 !== 0) {
			throw new Error(ValidationMessage.ODD_HEX_LENGTH);
		}
		const out = new Uint8Array(stripped.length / 2);
		for (let i = 0; i < out.length; i++) {
			out[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
		}
		return out;
	}

	static hexToBuffer(hex: string): Buffer {
		return Buffer.from(StellarCodec.hexToBytes(hex));
	}

	static i128(value: bigint): xdr.Int128Parts {
		const lo = value & U64_MASK;
		const hi = value >> I128_HALF_WIDTH_BITS;
		return new xdr.Int128Parts({
			hi: xdr.Int64.fromString(hi.toString()),
			lo: xdr.Uint64.fromString(lo.toString()),
		});
	}

	static memo(memo: BridgeMemo): Memo {
		switch (memo.type) {
			case MemoType.TEXT:
				return Memo.text(memo.value.slice(0, MEMO_TEXT_MAX_LENGTH));
			case MemoType.ID:
				return Memo.id(memo.value);
			case MemoType.HASH:
				return Memo.hash(memo.value.replace(/^0x/, ""));
			case MemoType.RETURN:
				return Memo.return(memo.value.replace(/^0x/, ""));
		}
	}
}
