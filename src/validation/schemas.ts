import { StrKey } from "@stellar/stellar-sdk";
import { isAddress } from "viem";
import { z } from "zod";
import { ValidationMessage } from "./messages";

const isStellarAddress = (value: string): boolean =>
	StrKey.isValidEd25519PublicKey(value) ||
	StrKey.isValidContract(value) ||
	StrKey.isValidMed25519PublicKey(value);

const isChecksumValid = (value: string): boolean => {
	const hex = value.slice(2);
	return hex === hex.toUpperCase() || isAddress(value);
};

export const evmAddressSchema = z
	.string()
	.regex(/^0x[a-fA-F0-9]{40}$/, ValidationMessage.INVALID_EVM_ADDRESS)
	.refine(isChecksumValid, {
		message: ValidationMessage.INVALID_EVM_CHECKSUM,
	});

export const stellarAddressSchema = z.string().refine(isStellarAddress, {
	message: ValidationMessage.INVALID_STELLAR_ADDRESS,
});

export const stellarStrkeySchema = z
	.string()
	.refine(isStellarAddress, { message: ValidationMessage.INVALID_STRKEY });

export const hexSchema = z
	.string()
	.regex(/^(0x)?[0-9a-fA-F]*$/, ValidationMessage.INVALID_HEX)
	.refine((v) => (v.startsWith("0x") ? v.length : v.length + 2) % 2 === 0, {
		message: ValidationMessage.ODD_HEX_LENGTH,
	});

export const humanAmountSchema = z
	.string()
	.regex(/^\d*(\.\d*)?$/, ValidationMessage.INVALID_AMOUNT);

export const STELLAR_MAX_ENTRY_TTL_LEDGERS = 3_110_400;
export const MAX_APPROVAL_EXPIRATION_LEDGERS =
	STELLAR_MAX_ENTRY_TTL_LEDGERS - 1;

export const approvalExpirationSchema = z
	.number()
	.int()
	.positive()
	.max(MAX_APPROVAL_EXPIRATION_LEDGERS);

export const txHashSchema = z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/);

export const irisFeeQuotesSchema = z.array(
	z.object({
		finalityThreshold: z.number().int(),
		minimumFee: z.number().nonnegative(),
	}),
);

export const httpTransportErrorSchema = z.object({
	isAxiosError: z.literal(true),
});

export const jsonRpcErrorSchema = z.object({
	code: z.number(),
	message: z.string(),
});

export const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const stroopsSchema = z.number().int().positive();
