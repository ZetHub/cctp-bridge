import { StrKey } from "@stellar/stellar-sdk";
import { isAddress } from "viem";
import { z } from "zod";
import { ValidationMessage } from "./messages";

/** G account, C contract or M muxed account, with a valid checksum. */
const isStellarAddress = (value: string): boolean =>
	StrKey.isValidEd25519PublicKey(value) ||
	StrKey.isValidContract(value) ||
	StrKey.isValidMed25519PublicKey(value);

/** 40 hex characters. A mixed-case address must pass its EIP-55 checksum. */
export const evmAddressSchema = z
	.string()
	.regex(/^0x[a-fA-F0-9]{40}$/, ValidationMessage.INVALID_EVM_ADDRESS)
	.refine((value) => isAddress(value), {
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

export const ledgerCountSchema = z.number().int().positive();

export const txHashSchema = z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/);
