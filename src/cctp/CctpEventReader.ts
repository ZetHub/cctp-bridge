import { type Abi, type Log, parseEventLogs } from "viem";
import type { BridgeEventRecord } from "../domain/BridgeTransaction";
import { BridgeSide } from "../domain/enums";
import {
	MESSAGE_TRANSMITTER_V2_ABI,
	TOKEN_MESSENGER_V2_ABI,
	TOKEN_MINTER_V2_ABI,
} from "./abis";

const SOURCE_ABI: Abi = [
	...TOKEN_MESSENGER_V2_ABI,
	...MESSAGE_TRANSMITTER_V2_ABI,
];

const DEST_ABI: Abi = [...MESSAGE_TRANSMITTER_V2_ABI, ...TOKEN_MINTER_V2_ABI];

export class CctpEventReader {
	static readSource(logs: readonly Log[], txHash: string): BridgeEventRecord[] {
		return CctpEventReader.match(logs, SOURCE_ABI, BridgeSide.SOURCE, txHash);
	}

	static readDestination(
		logs: readonly Log[],
		txHash: string,
	): BridgeEventRecord[] {
		return CctpEventReader.match(
			logs,
			DEST_ABI,
			BridgeSide.DESTINATION,
			txHash,
		);
	}

	private static match(
		logs: readonly Log[],
		abi: Abi,
		side: BridgeSide,
		txHash: string,
	): BridgeEventRecord[] {
		try {
			const parsed = parseEventLogs({ abi, logs: logs as Log[] });
			return parsed.map((entry) => ({
				name: entry.eventName,
				side,
				txHash,
				block: Number(entry.blockNumber ?? 0n) || undefined,
				observedAt: Date.now(),
			}));
		} catch {
			return [];
		}
	}
}
