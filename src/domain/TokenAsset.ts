import type { AssetSymbol } from "./enums";

export interface TokenAssetProps {
	readonly symbol: AssetSymbol;
	readonly name: string;
	readonly decimals: number;
	/** ERC-20 contract on EVM, or Stellar Asset Contract (SAC) id on Stellar. */
	readonly address: string;
	/** Stellar G-account issuer of the underlying trustline, when applicable. */
	readonly issuer?: string;
	/** Stellar asset code, e.g. "USDC". */
	readonly assetCode?: string;
	readonly logoUrl?: string;
}

export class TokenAsset implements TokenAssetProps {
	readonly symbol: AssetSymbol;
	readonly name: string;
	readonly decimals: number;
	readonly address: string;
	readonly issuer?: string;
	readonly assetCode?: string;
	readonly logoUrl?: string;

	constructor(props: TokenAssetProps) {
		this.symbol = props.symbol;
		this.name = props.name;
		this.decimals = props.decimals;
		this.address = props.address;
		this.issuer = props.issuer;
		this.assetCode = props.assetCode;
		this.logoUrl = props.logoUrl;
	}

	withAddress(address: string): TokenAsset {
		return new TokenAsset({ ...this, address });
	}
}
