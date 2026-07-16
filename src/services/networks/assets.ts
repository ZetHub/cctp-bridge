import { AssetSymbol } from "../../domain/enums";
import { USDC_DECIMALS } from "../../domain/Token";
import { TokenAsset } from "../../domain/TokenAsset";

export function usdc(
	address: string,
	extra: { decimals?: number; issuer?: string; assetCode?: string } = {},
): TokenAsset {
	return new TokenAsset({
		symbol: AssetSymbol.USDC,
		name: "USD Coin",
		decimals: extra.decimals ?? USDC_DECIMALS.EVM,
		address,
		issuer: extra.issuer,
		assetCode: extra.assetCode,
	});
}
