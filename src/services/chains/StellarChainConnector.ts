import {
	Account,
	Address,
	Contract,
	rpc,
	scValToNative,
	TransactionBuilder,
	xdr,
} from "@stellar/stellar-sdk";
import { CctpEncoder } from "../../cctp/CctpEncoder";
import { StellarCodec } from "../../cctp/StellarCodec";
import { StellarPassphrase } from "../../cctp/StellarPassphrase";
import type { StellarRpc } from "../../cctp/StellarRpc";
import { Amount } from "../../domain/Amount";
import { ChainFamily } from "../../domain/enums";
import type { Network } from "../../domain/Network";
import {
	RawSorobanTransaction,
	type RawTransaction,
} from "../../domain/RawTransaction";
import { BridgeError } from "../../errors";
import type {
	BuildApproveTxParams,
	BuildBurnTxParams,
	BuildReceiveTxParams,
	GetAllowanceOnChainParams,
	GetNativeBalanceOnChainParams,
	GetTokenBalanceOnChainParams,
	IChainConnector,
} from "../../ports/IChainConnector";

/** About 6 days at 5 to 6 seconds per ledger. */
const DEFAULT_APPROVAL_EXPIRATION_LEDGERS = 100_000;
const SOROBAN_FEE = "1000000";
const TX_TIMEOUT_SECONDS = 180;
/** i128::MAX. Passed to Soroban `approve` when the caller opts into an
 *  unlimited allowance. */
const I128_MAX = (1n << 127n) - 1n;

/** Chain connector for the Stellar family. Builds prepared Soroban XDRs
 *  ready for the caller's wallet to sign. */
export class StellarChainConnector implements IChainConnector {
	readonly family = ChainFamily.STELLAR;

	constructor(private readonly stellarRpc: StellarRpc) {}

	async buildApproveTx(params: BuildApproveTxParams): Promise<RawTransaction> {
		const { network, token, owner, amount } = params;
		this.assertStellar(network);
		const passphrase = StellarPassphrase.for(network);
		const expiresInLedgers =
			params.expiresInLedgers ?? DEFAULT_APPROVAL_EXPIRATION_LEDGERS;

		return this.stellarRpc.run(network, async (server) => {
			const fetched = await server.getAccount(owner);
			const acct = new Account(fetched.accountId(), fetched.sequenceNumber());
			const latest = await server.getLatestLedger();
			const expirationLedger = latest.sequence + expiresInLedgers;

			const usdc = new Contract(token.address);
			const approveAmount = amount
				? amount.scaleTo(token.decimals).raw
				: I128_MAX;
			const op = usdc.call(
				"approve",
				new Address(owner).toScVal(),
				new Address(network.tokenMessenger).toScVal(),
				xdr.ScVal.scvI128(StellarCodec.i128(approveAmount)),
				xdr.ScVal.scvU32(expirationLedger),
			);

			const tx = new TransactionBuilder(acct, {
				fee: SOROBAN_FEE,
				networkPassphrase: passphrase,
			})
				.addOperation(op)
				.setTimeout(TX_TIMEOUT_SECONDS)
				.build();

			const prepared = await server.prepareTransaction(tx);
			return new RawSorobanTransaction({
				networkPassphrase: passphrase,
				from: owner,
				xdr: prepared.toXDR(),
			});
		});
	}

	async buildBurnTx(params: BuildBurnTxParams): Promise<RawTransaction> {
		const { source, destination, token, amount, from, recipient, maxFee } =
			params;
		this.assertStellar(source);
		const passphrase = StellarPassphrase.for(source);

		return this.stellarRpc.run(source, async (server) => {
			const fetched = await server.getAccount(from);
			const acct = new Account(fetched.accountId(), fetched.sequenceNumber());
			const burnAmount = amount.scaleTo(token.decimals).raw;
			const mintRecipient = StellarCodec.hexToBuffer(
				CctpEncoder.evmAddressToBytes32(recipient),
			);

			const tokenMessenger = new Contract(source.tokenMessenger);
			const op = tokenMessenger.call(
				"deposit_for_burn",
				new Address(from).toScVal(),
				xdr.ScVal.scvI128(StellarCodec.i128(burnAmount)),
				xdr.ScVal.scvU32(destination.cctpDomain),
				xdr.ScVal.scvBytes(mintRecipient),
				new Contract(token.address).address().toScVal(),
				xdr.ScVal.scvBytes(StellarCodec.hexToBuffer(this.zeroBytes32)),
				xdr.ScVal.scvI128(StellarCodec.i128(maxFee)),
				xdr.ScVal.scvU32(params.minFinalityThreshold),
			);

			const builder = new TransactionBuilder(acct, {
				fee: SOROBAN_FEE,
				networkPassphrase: passphrase,
			}).addOperation(op);
			if (params.memo) {
				builder.addMemo(StellarCodec.memo(params.memo));
			}
			const tx = builder.setTimeout(TX_TIMEOUT_SECONDS).build();

			const prepared = await server.prepareTransaction(tx);
			return new RawSorobanTransaction({
				networkPassphrase: passphrase,
				from,
				xdr: prepared.toXDR(),
			});
		});
	}

	async buildReceiveTx(params: BuildReceiveTxParams): Promise<RawTransaction> {
		const { destination, to, message, attestation } = params;
		this.assertStellar(destination);
		if (!destination.cctpForwarder) {
			throw new BridgeError(
				"MISSING_FORWARDER",
				`Stellar network ${destination.id} is missing a CctpForwarder`,
			);
		}
		const passphrase = StellarPassphrase.for(destination);
		const forwarderAddress = destination.cctpForwarder;

		return this.stellarRpc.run(destination, async (server) => {
			const fetched = await server.getAccount(to);
			const acct = new Account(fetched.accountId(), fetched.sequenceNumber());

			const contract = new Contract(forwarderAddress);
			const op = contract.call(
				"mint_and_forward",
				xdr.ScVal.scvBytes(StellarCodec.hexToBuffer(message)),
				xdr.ScVal.scvBytes(StellarCodec.hexToBuffer(attestation)),
			);

			const tx = new TransactionBuilder(acct, {
				fee: SOROBAN_FEE,
				networkPassphrase: passphrase,
			})
				.addOperation(op)
				.setTimeout(TX_TIMEOUT_SECONDS)
				.build();

			const prepared = await server.prepareTransaction(tx);
			return new RawSorobanTransaction({
				networkPassphrase: passphrase,
				from: to,
				xdr: prepared.toXDR(),
			});
		});
	}

	async getAllowance(params: GetAllowanceOnChainParams): Promise<Amount> {
		const { network, token, owner } = params;
		this.assertStellar(network);
		const passphrase = StellarPassphrase.for(network);
		const contract = new Contract(token.address);
		const account = new Account(owner, "0");

		return this.stellarRpc.run(network, async (server) => {
			const tx = new TransactionBuilder(account, {
				fee: "100",
				networkPassphrase: passphrase,
			})
				.addOperation(
					contract.call(
						"allowance",
						new Address(owner).toScVal(),
						new Address(network.tokenMessenger).toScVal(),
					),
				)
				.setTimeout(30)
				.build();

			const sim = await server.simulateTransaction(tx);
			if (rpc.Api.isSimulationError(sim) || !sim.result) {
				return Amount.fromRaw(0n, network.family);
			}
			const native: unknown = scValToNative(sim.result.retval);
			return Amount.fromRaw(this.toBigInt(native), network.family);
		});
	}

	async getTokenBalance(params: GetTokenBalanceOnChainParams): Promise<Amount> {
		const { network, token, owner } = params;
		this.assertStellar(network);
		const passphrase = StellarPassphrase.for(network);
		const contract = new Contract(token.address);
		const account = new Account(owner, "0");

		return this.stellarRpc.run(network, async (server) => {
			const tx = new TransactionBuilder(account, {
				fee: "100",
				networkPassphrase: passphrase,
			})
				.addOperation(contract.call("balance", new Address(owner).toScVal()))
				.setTimeout(30)
				.build();

			const sim = await server.simulateTransaction(tx);
			if (rpc.Api.isSimulationError(sim) || !sim.result) {
				return Amount.fromRaw(0n, network.family);
			}
			const native: unknown = scValToNative(sim.result.retval);
			return Amount.fromRaw(this.toBigInt(native), network.family);
		});
	}

	async getNativeBalance(
		params: GetNativeBalanceOnChainParams,
	): Promise<Amount> {
		const { network, owner } = params;
		this.assertStellar(network);
		return this.stellarRpc.run(network, async (server) => {
			const account = await server.getAccount(owner);
			const balances = (
				account as unknown as {
					balances?: { asset_type: string; balance: string }[];
				}
			).balances;
			const native = balances?.find((b) => b.asset_type === "native");
			const stroops = native ? Math.round(Number(native.balance) * 1e7) : 0;
			return Amount.fromRawWithDecimals(BigInt(stroops), 7);
		});
	}

	private readonly zeroBytes32 =
		"0x0000000000000000000000000000000000000000000000000000000000000000";

	private assertStellar(network: Network): void {
		if (network.family !== ChainFamily.STELLAR) {
			throw new BridgeError(
				"UNSUPPORTED_ROUTE",
				`StellarChainConnector received non-Stellar network ${network.id}`,
			);
		}
	}

	private toBigInt(value: unknown): bigint {
		if (typeof value === "bigint") {
			return value;
		}
		if (typeof value === "number" || typeof value === "string") {
			return BigInt(value);
		}
		return 0n;
	}
}
