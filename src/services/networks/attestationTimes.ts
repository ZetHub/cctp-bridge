import { AttestationTime } from "../../domain/AttestationTime";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const ETHEREUM_SETTLED_SECONDS = 19 * MINUTE;

export const ATTESTATION_TIMES = {
	ETHEREUM: new AttestationTime({
		fastSeconds: 20,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	ARBITRUM: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	BASE: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	CODEX: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	OPTIMISM: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	UNICHAIN: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	WORLDCHAIN: new AttestationTime({
		fastSeconds: 8,
		standardSeconds: ETHEREUM_SETTLED_SECONDS,
	}),
	LINEA: new AttestationTime({ fastSeconds: 8, standardSeconds: 32 * HOUR }),
	AVALANCHE: new AttestationTime({ standardSeconds: 8 }),
	POLYGON: new AttestationTime({ standardSeconds: 8 }),
	SONIC: new AttestationTime({ standardSeconds: 8 }),
	SEI: new AttestationTime({ standardSeconds: 5 }),
	HYPEREVM: new AttestationTime({ standardSeconds: 5 }),
	STELLAR: new AttestationTime({ standardSeconds: 5 }),
} as const;
