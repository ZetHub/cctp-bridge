import { z } from "zod";
import { ValidationMessage } from "./messages";

export const evmAddressSchema = z
	.string()
	.regex(/^0x[a-fA-F0-9]{40}$/, ValidationMessage.INVALID_EVM_ADDRESS);

export const stellarAddressSchema = z
	.string()
	.regex(/^[GCM][A-Z2-7]{55}$/, ValidationMessage.INVALID_STELLAR_ADDRESS);

export const stellarStrkeySchema = z
	.string()
	.regex(/^[GCM][A-Z2-7]{55}$/, ValidationMessage.INVALID_STRKEY);

export const hexSchema = z
	.string()
	.regex(/^(0x)?[0-9a-fA-F]*$/, ValidationMessage.INVALID_HEX)
	.refine((v) => (v.startsWith("0x") ? v.length : v.length + 2) % 2 === 0, {
		message: ValidationMessage.ODD_HEX_LENGTH,
	});

export const humanAmountSchema = z
	.string()
	.regex(/^\d*(\.\d*)?$/, ValidationMessage.INVALID_AMOUNT);
