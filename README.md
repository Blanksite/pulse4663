# Pulse4663 — Robinhood Chain (4663) On-Chain Intelligence & Uniswap v4 Security Engine

**Pulse4663** is a real-time contract bytecode X-ray, 14-bit Uniswap v4 permission bitmask decoder, `CREATE2` salt synthesizer, and zero-data-retention **Venice AI** security engine built natively for **Robinhood Chain Mainnet (`Chain ID: 4663`)**.

---

## Why Pulse4663?

On **Uniswap v4** deployed over **Robinhood Chain (`4663`)**, pool behavior is dictated by external smart contracts whose privileges are encoded directly inside the **bottom 14 bits (`0x3FFF`)** of the contract's 20-byte EVM address:

- **Bit 3 (`0x0008` — `beforeSwapReturnDelta`)**: Allows a pool contract to bypass standard constant-product math and confiscate **100% of swap input tokens** (NoOp rug-pull).
- **Bit 0 (`0x0001` — `afterRemoveLiquidityReturnDelta`)**: Allows confiscating underlying tokens when LPs attempt to withdraw liquidity.
- **Bit 9 (`0x0200` — `beforeRemoveLiquidity`)**: Allows selectively reverting LP withdrawals to trap liquidity.

Most traders and LPs on Robinhood Chain cannot read raw 14-bit hexadecimal bitmasks or disassemble EVM bytecode before signing a swap. **Pulse4663** solves this in a single pre-execution dashboard and on-chain Solidity guard (`contracts/Pulse4663Guard.sol`).

---

## Key Features

1. **14-Bit Uniswap v4 Address Bitmask Decoder (`src/lib/v4-bitmask.ts`)**
   - Decodes all 14 lifecycle flags (`0x2000` down to `0x0001`) from any EVM address and isolates critical balance-delta mutation privileges (`0x000F`).
2. **Live Robinhood Chain (`4663`) RPC Telemetry & EVM Disassembler (`src/lib/robinhood-rpc.ts`)**
   - Connects directly to `https://rpc.mainnet.chain.robinhood.com` (`Chain ID: 4663`) to inspect live block height, gas price, contract bytecode size, dangerous EVM opcodes (`SELFDESTRUCT 0xff`, `DELEGATECALL 0xf4`), ERC-20 total supply, and `0x0000...dEaD` burned supply.
3. **Interactive `CREATE2` Salt Synthesizer**
   - Helps Robinhood Chain builders toggle desired Uniswap v4 callbacks and synthesize matching 14-bit `CREATE2` deployment salts while flagging dangerous bits.
4. **On-Chain Solidity Firewall (`contracts/Pulse4663Guard.sol`)**
   - Solidity `0.8.26` guard contract that enforces user-defined risk ceilings and reverts interactions with unverified delta-mutation pools on Robinhood Chain (`4663`).
5. **Private Venice AI Zero-Retention Security Auditor (`src/lib/venice-audit.ts`)**
   - Uses Venice AI (`llama-3.3-70b` with `include_venice_system_prompt: false`) for private semantic auditing with a 100% deterministic bitwise & opcode fallback engine.

---

## Quick Start

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3001` in your browser.
