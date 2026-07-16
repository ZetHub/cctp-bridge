import type { MemoType } from "./enums";

/** Optional memo attached to a Stellar-sourced burn transaction. */
export interface BridgeMemo {
	type: MemoType;
	value: string;
}
