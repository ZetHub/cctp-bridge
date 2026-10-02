import { FinalityThreshold } from "./enums";

export interface AttestationTimeProps {
	readonly fastSeconds?: number;
	readonly standardSeconds: number;
}

export class AttestationTime implements AttestationTimeProps {
	static readonly GENERIC = new AttestationTime({
		fastSeconds: 30,
		standardSeconds: 15 * 60,
	});

	readonly fastSeconds?: number;
	readonly standardSeconds: number;

	constructor(props: AttestationTimeProps) {
		this.fastSeconds = props.fastSeconds;
		this.standardSeconds = props.standardSeconds;
	}

	get supportsFast(): boolean {
		return this.fastSeconds !== undefined;
	}

	defaultThreshold(): FinalityThreshold {
		return this.supportsFast
			? FinalityThreshold.FAST
			: FinalityThreshold.STANDARD;
	}

	secondsFor(minFinalityThreshold: number): number {
		if (
			this.fastSeconds !== undefined &&
			minFinalityThreshold <= FinalityThreshold.FAST
		) {
			return this.fastSeconds;
		}
		return this.standardSeconds;
	}
}
