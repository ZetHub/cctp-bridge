# @zethub/bridge

Client-side TypeScript SDK for **native USDC cross-chain transfers** over Circle CCTP V2, across every EVM chain and Stellar.

The SDK **never touches keys**. Every on-chain write returns an unsigned `RawTransaction` for you to sign and broadcast with the wallet library you already use — viem, ethers, wagmi, Freighter, Lobstr, Stellar Wallets Kit, anything.

📖 **Full documentation:** [bridge-docs.zethub.cloud](https://bridge-docs.zethub.cloud)

## Install

```
pnpm add @zethub/bridge
```

No wallet-library peers required. `viem` and `@stellar/stellar-sdk` are internal dependencies and will be deduped if you already use them.

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
    token: sourceToken, owner: myEvmAddress,
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
  attestation: undefined,             // override the Iris client
  fees: undefined,                    // override the Iris fee client
  connectors: undefined,              // add / replace chain family connectors
});
```

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
