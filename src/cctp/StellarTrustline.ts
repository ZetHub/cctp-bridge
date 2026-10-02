import { Asset, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import type { Network } from "../domain/Network";
import type { TokenAsset } from "../domain/TokenAsset";
import { BridgeError } from "../errors";
import { stellarAddressSchema } from "../validation/schemas";
import type { StellarRpc } from "./StellarRpc";

const ED25519_KEY_BYTES = 32;

/**
 * Checks whether a Stellar account holds the trustline required to receive a
 * classic asset (e.g. USDC). Contracts (C-addresses) hold SAC balances directly
 * and never need a classic trustline, so they always pass.
 */
export class StellarTrustline {
	constructor(private readonly rpc: StellarRpc) {}

	async has(
		network: Network,
		address: string,
		token: TokenAsset,
	): Promise<boolean> {
		if (!stellarAddressSchema.safeParse(address).success) {
			throw new BridgeError("RECIPIENT_INVALID_STELLAR");
		}
		if (address.startsWith("C")) {
			return true;
		}
		if (!token.assetCode || !token.issuer) {
			return true;
		}
		const asset = new Asset(token.assetCode, token.issuer);
		const key = xdr.LedgerKey.trustline(
			new xdr.LedgerKeyTrustLine({
				accountId: Keypair.fromPublicKey(
					this.baseAccountOf(address),
				).xdrAccountId(),
				asset: asset.toTrustLineXDRObject(),
			}),
		);
		return this.rpc.run(network, async (server) => {
			const res = await server.getLedgerEntries(key);
			return res.entries.length > 0;
		});
	}

	private baseAccountOf(address: string): string {
		if (!StrKey.isValidMed25519PublicKey(address)) {
			return address;
		}
		const payload = StrKey.decodeMed25519PublicKey(address);
		return StrKey.encodeEd25519PublicKey(
			payload.subarray(0, ED25519_KEY_BYTES),
		);
	}
}
