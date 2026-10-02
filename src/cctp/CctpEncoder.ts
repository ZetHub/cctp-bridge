import { StrKey } from "@stellar/stellar-sdk";
import type { Hex } from "viem";
import { BridgeError } from "../errors";
import { ValidationMessage } from "../validation/messages";
import { evmAddressSchema, stellarStrkeySchema } from "../validation/schemas";

/**
 * Encoders for the byte-level values CCTP contracts expect: bytes32 mint
 * recipients and the CctpForwarder hook payload on Stellar.
 */
export class CctpEncoder {
	/**
	 * CctpForwarder hook payload layout (developers.circle.com/cctp, Stellar):
	 *   [0..23]  24-byte magic (reserved, zeros)
	 *   [24..27] uint32 BE version (0)
	 *   [28..31] uint32 BE length of forwardRecipient
	 *   [32..]   forwardRecipient as UTF-8 strkey
	 */
	static forwarderHook(forwardRecipientStrkey: string): Hex {
		if (!stellarStrkeySchema.safeParse(forwardRecipientStrkey).success) {
			throw new Error(ValidationMessage.INVALID_STRKEY);
		}
		const recipientBytes = new TextEncoder().encode(forwardRecipientStrkey);
		const out = new Uint8Array(32 + recipientBytes.length);
		const length = recipientBytes.length;
		out[28] = (length >>> 24) & 0xff;
		out[29] = (length >>> 16) & 0xff;
		out[30] = (length >>> 8) & 0xff;
		out[31] = length & 0xff;
		out.set(recipientBytes, 32);
		return `0x${CctpEncoder.bytesToHex(out)}`;
	}

	static stellarAddressToBytes32(strkey: string): Hex {
		let raw: Uint8Array;
		if (strkey.startsWith("C")) {
			raw = StrKey.decodeContract(strkey);
		} else if (strkey.startsWith("G")) {
			raw = StrKey.decodeEd25519PublicKey(strkey);
		} else {
			throw new Error(`Cannot convert ${strkey} to bytes32`);
		}
		if (raw.length !== 32) {
			throw new Error("Decoded Stellar key is not 32 bytes");
		}
		return `0x${CctpEncoder.bytesToHex(raw)}`;
	}

	static evmAddressToBytes32(address: string): Hex {
		if (!evmAddressSchema.safeParse(address).success) {
			throw new BridgeError("RECIPIENT_INVALID_EVM");
		}
		const stripped = address.toLowerCase().replace(/^0x/, "");
		return `0x${stripped.padStart(64, "0")}`;
	}

	static bytesToHex(bytes: Uint8Array): string {
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
}
