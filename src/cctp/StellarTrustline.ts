import { Asset, Keypair, xdr } from "@stellar/stellar-sdk";
import type { Network } from "../domain/Network";
import type { TokenAsset } from "../domain/TokenAsset";
import type { StellarRpc } from "./StellarRpc";

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
		if (address.startsWith("C")) {
			return true;
		}
		if (!token.assetCode || !token.issuer) {
			return true;
		}
		const asset = new Asset(token.assetCode, token.issuer);
		const key = xdr.LedgerKey.trustline(
			new xdr.LedgerKeyTrustLine({
				accountId: Keypair.fromPublicKey(address).xdrAccountId(),
				asset: asset.toTrustLineXDRObject(),
			}),
		);
		return this.rpc.run(network, async (server) => {
			const res = await server.getLedgerEntries(key);
			return res.entries.length > 0;
		});
	}
}
