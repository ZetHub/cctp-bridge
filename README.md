# @zethub/bridge

Client-side TypeScript SDK for **native USDC cross-chain transfers** over Circle CCTP V2, across every EVM chain and Stellar.

The SDK **never touches keys**. Every on-chain write returns an unsigned `RawTransaction` for you to sign and broadcast with the wallet library you already use — viem, ethers, wagmi, Freighter, Lobstr, Stellar Wallets Kit, anything.

📖 **Full documentation:** [bridge-docs.zethub.cloud](https://bridge-docs.zethub.cloud)

## Install

```
pnpm add @zethub/bridge viem @stellar/stellar-sdk
```

`viem` (2.37 or later 2.x) and `@stellar/stellar-sdk` (14.x to 17.x) are peer dependencies. The SDK uses the copies your app already has, so their types match across the API boundary and your app keeps the versions it tested.

## Quick start

Three signed transactions per bridge: approve, burn, receive. The SDK builds all three; you sign them.

```ts
import {
  ZetHubBridge,
  NetworkId,
  AssetSymbol,
  Environment,
} from "@zethub/bridge";

const sdk = new ZetHubBridge({ environment: Environment.TESTNET });

// 1. Discover tokens
const chains = await sdk.chainDetailsMap();
const sourceToken = chains[NetworkId.BASE_SEPOLIA].tokens.find(
  (t) => t.symbol === AssetSymbol.USDC,
)!;
const destinationToken = chains[NetworkId.STELLAR_TESTNET].tokens.find(
  (t) => t.symbol === AssetSymbol.USDC,
)!;

// 2. Approve if allowance is short
if (!(await sdk.bridge.checkAllowance({
  token: sourceToken, owner: myEvmAddress, amount: "1.0",
}))) {
  const approveTx = await sdk.bridge.rawTxBuilder.approve({
    token: sourceToken, owner: myEvmAddress, amount: "1.0",
  });
  await mySignAndBroadcast(approveTx);
}

// 3. Burn on the source
const burnTx = await sdk.bridge.rawTxBuilder.send({
  sourceToken,
  destinationToken,
  amount: "1.0",
  fromAccountAddress: myEvmAddress,
  toAccountAddress: myStellarAddress,
});
const burnHash = await mySignAndBroadcast(burnTx);

// 4. Wait for Circle to attest
const att = await sdk.attestation.waitFor(NetworkId.BASE_SEPOLIA, burnHash);

// 5. Mint on the destination
const mintTx = await sdk.bridge.rawTxBuilder.receive({
  destinationToken,
  toAccountAddress: myStellarAddress,
  message: att.message,
  attestation: att.attestation,
});
await mySignAndBroadcast(mintTx);
```

See the [Signing transactions guide](https://bridge-docs.zethub.cloud/docs/getting-started/signing) for the `mySignAndBroadcast` glue with viem, wagmi, ethers, Freighter, or the Stellar Wallets Kit.

## Approvals

`approve()` lets the source TokenMessenger move USDC from the owner. Pass the `amount` you plan to burn. To grant an unlimited allowance instead, pass `unlimited: true`. If you pass neither, `approve()` throws `APPROVAL_AMOUNT_REQUIRED`. An `amount` of `0` revokes the allowance.

```ts
await sdk.bridge.rawTxBuilder.approve({ token, owner, amount: "25" });

await sdk.bridge.rawTxBuilder.approve({
  token,
  owner,
  unlimited: true,
  expiresInLedgers: 17_280,
});
```

On Stellar, an allowance expires. By default it lasts 100,000 ledgers after the approval (about 6 days at 5 to 6 seconds per ledger). Set `expiresInLedgers` to change it, up to 3,110,399 ledgers (about 180 days), one less than Stellar's maximum entry lifetime of 3,110,400 ledgers. EVM allowances do not expire.

## Stellar amounts

USDC has 7 decimals on Stellar, but a CCTP message carries 6. A burn from Stellar sends only the first 6 decimals, and the 7th stays in the sender's account. For example, `send()` with `amount: "1.2345678"` burns 1.234567 USDC, and 0.0000008 USDC stays on Stellar. An amount below 0.000001 USDC throws `AMOUNT_TOO_SMALL`.

## Design

- **No signer injection.** Every write returns a typed `RawEvmTransaction` or `RawSorobanTransaction`. You sign it however you already sign transactions.
- **Discovery over configuration.** `sdk.chainDetailsMap()` returns every supported network with its supported tokens. You pick a `TokenWithChainDetails` and pass it back.
- **Small config surface.** RPC overrides, environment, optional custom Iris clients. That's it.
- **Extensible.** Add a new chain family by implementing `IChainConnector` and passing it to `new ZetHubBridge({ connectors: { ... } })`.
- **Stateless.** The SDK persists nothing. If your app needs to survive a page reload between the burn and the mint, [store the burn hash yourself](https://bridge-docs.zethub.cloud/docs/recovery/resuming) and call `attestation.waitFor` + `rawTxBuilder.receive` when you're ready.

## Supported chains

**EVM mainnet:** Ethereum, Arbitrum, Optimism, Base, Avalanche, Polygon, Unichain, Linea, Codex, Sonic, World Chain, Sei, HyperEVM.
**Stellar:** Mainnet + Testnet.
**EVM testnet:** Sepolia, Arbitrum Sepolia, OP Sepolia, Base Sepolia, Avalanche Fuji, Polygon Amoy.

See the [Networks reference](https://bridge-docs.zethub.cloud/docs/reference/networks) for exact chain IDs and CCTP domains.

## Configuration

```ts
new ZetHubBridge({
  environment: Environment.MAINNET,   // default
  rpc: {
    [NetworkId.BASE]: ["https://your-base-node.example"],
  },
  rpcMode: RpcMode.PREPEND,
  rpcTimeoutMs: 30_000,
  attestation: undefined,             // override the Iris client
  fees: undefined,                    // override the Iris fee client
  connectors: undefined,              // add / replace chain family connectors
});
```

With `RpcMode.PREPEND` (the default), your `rpc` URLs are tried before the built-in endpoints. With `RpcMode.REPLACE`, only your URLs are used, so no request reaches a public endpoint. The built-in endpoints are public RPCs run by third parties, with rate limits; `sdk.chainDetailsMap()` lists them per network. The SDK moves to the next endpoint only when one is unreachable, answers with an HTTP error, or does not answer within `rpcTimeoutMs` (30 seconds by default). It never moves on after a contract, simulation or JSON-RPC error.

Everything is optional — `new ZetHubBridge()` works. Full details on the [Configuration page](https://bridge-docs.zethub.cloud/docs/getting-started/configuration).

## Development

```
pnpm install
pnpm check           # biome lint + format check
pnpm typecheck
pnpm test            # unit tests
pnpm test:coverage   # + v8 coverage
pnpm build           # tsup → dist/
```

Tests: 130 unit tests covering ~95% of source. Integration tests hit real networks and are gated behind `RUN_INTEGRATION=1`.

## License

MIT
