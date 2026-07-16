import { ValidationMessage } from "../validation/messages";
import { evmAddressSchema, stellarAddressSchema } from "../validation/schemas";
import { ChainFamily } from "./enums";

export type EvmAddress = `0x${string}`;
export type StellarAddress = string;

export type WalletAddress =
	| { family: typeof ChainFamily.EVM; value: EvmAddress }
	| { family: typeof ChainFamily.STELLAR; value: StellarAddress };

export interface AddressValidation {
	valid: boolean;
	reason?: string;
}

export class Address {
	private readonly _value: string;
	private readonly _family: ChainFamily;

	private constructor(value: string, family: ChainFamily) {
		this._value = value;
		this._family = family;
	}

	static evm(value: string): Address {
		if (!Address.isEvm(value)) {
			throw new Error(ValidationMessage.INVALID_EVM_ADDRESS);
		}
		return new Address(value, ChainFamily.EVM);
	}

	static stellar(value: string): Address {
		if (!Address.isStellar(value)) {
			throw new Error(ValidationMessage.INVALID_STELLAR_ADDRESS);
		}
		return new Address(value, ChainFamily.STELLAR);
	}

	static for(value: string, family: ChainFamily): Address {
		return family === ChainFamily.EVM
			? Address.evm(value)
			: Address.stellar(value);
	}

	static isEvm(value: string): value is EvmAddress {
		return evmAddressSchema.safeParse(value).success;
	}

	static isStellar(value: string): boolean {
		return stellarAddressSchema.safeParse(value).success;
	}

	static validate(value: string, family: ChainFamily): AddressValidation {
		if (!value) {
			return { valid: false, reason: ValidationMessage.ADDRESS_REQUIRED };
		}
		const schema =
			family === ChainFamily.EVM ? evmAddressSchema : stellarAddressSchema;
		const result = schema.safeParse(value);
		if (result.success) {
			return { valid: true };
		}
		return { valid: false, reason: result.error.issues[0]?.message };
	}

	get value(): string {
		return this._value;
	}

	get family(): ChainFamily {
		return this._family;
	}

	get isEvm(): boolean {
		return this._family === ChainFamily.EVM;
	}

	get isStellar(): boolean {
		return this._family === ChainFamily.STELLAR;
	}

	toEvm(): EvmAddress {
		if (!this.isEvm) {
			throw new Error(ValidationMessage.INVALID_EVM_ADDRESS);
		}
		return this._value as EvmAddress;
	}

	equals(other: Address): boolean {
		return this._family === other._family && this._value === other._value;
	}

	toJSON(): WalletAddress {
		return this._family === ChainFamily.EVM
			? { family: ChainFamily.EVM, value: this._value as EvmAddress }
			: { family: ChainFamily.STELLAR, value: this._value };
	}

	toString(): string {
		return this._value;
	}
}
