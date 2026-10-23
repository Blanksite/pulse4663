import { describe, it, expect } from "vitest";
import {
  decodeHookAddressBitmask,
  synthesizeHookAddressForMask,
} from "../src/lib/v4-bitmask";
import { analyzeEvmBytecode } from "../src/lib/robinhood-rpc";
import { generatePulse4663Audit } from "../src/lib/venice-audit";

describe("Pulse4663 — Uniswap v4 14-Bit Permission Decoder & Robinhood Chain (4663) Security Engine", () => {
  it("correctly decodes a safe dynamic-fee hook (0x00C0: beforeSwap + afterSwap)", () => {
    const safeHook = "0x46630000a5a5a5a58366a39cc670b4001a1100C0";
    const report = decodeHookAddressBitmask(safeHook);

    expect(report.bottom14BitsHex).toBe("0x00C0");
    expect(report.activePermissionsCount).toBe(2);
    expect(report.hasDeltaMutationPrivilege).toBe(false);
    expect(report.canLockLiquidity).toBe(false);
    expect(report.deterministicClassification).toBe("SAFE");
  });

  it("flags a malicious delta-confiscation & LP-lock hook (0x028D) as CRITICAL", () => {
    const maliciousHook = "0xdead0000bad000008366a39cc670b4001a11028D";
    const report = decodeHookAddressBitmask(maliciousHook);

    expect(report.bottom14BitsHex).toBe("0x028D");
    expect(report.hasDeltaMutationPrivilege).toBe(true);
    expect(report.canLockLiquidity).toBe(true);
    expect(report.deterministicClassification).toBe("CRITICAL");
    expect(report.deterministicRiskScore).toBeGreaterThanOrEqual(80);
    expect(
      report.threatFlags.some((f) => f.code === "BEFORE_SWAP_DELTA_DRAIN_RISK")
    ).toBe(true);
  });

  it("synthesizes a deterministic CREATE2 hook address matching the requested 14-bit mask", () => {
    const targetMask = 0x00c0;
    const mined = synthesizeHookAddressForMask(
      "0x9423Be20379148fEC92499191282fFfe6B8D9356",
      targetMask
    );

    expect(mined.targetMaskHex).toBe("0x00C0");
    const verify = decodeHookAddressBitmask(mined.synthesizedHookAddress);
    expect(verify.bottom14BitsDecimal).toBe(targetMask);
  });

  it("disassembles EVM bytecode without confusing PUSH immediate data for SELFDESTRUCT", () => {
    // 0x60ff600052 pushes 0xff onto the stack (NOT a SELFDESTRUCT instruction)
    const safePushBytecode = "0x60ff60005263a9059cbb";
    const safeAnalysis = analyzeEvmBytecode(safePushBytecode);
    expect(safeAnalysis.hasSelfDestructOpcode).toBe(false);
    expect(safeAnalysis.detectedSelectors).toContain(
      "transfer(address,uint256)"
    );

    // Real 0xff opcode outside PUSH data
    const dangerousBytecode = "0x600052ff";
    const dangerAnalysis = analyzeEvmBytecode(dangerousBytecode);
    expect(dangerAnalysis.hasSelfDestructOpcode).toBe(true);
  });

  it("enforces Pulse4663Guard.sol policy and blocks delta-mutation hooks", async () => {
    const maliciousHook = "0xdead0000bad000008366a39cc670b4001a11028D";
    const bitmask = decodeHookAddressBitmask(maliciousHook);
    const mockOnChain = {
      chainId: 4663,
      blockNumber: 95863200,
      gasPriceGwei: "0.0100",
      targetAddress: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
      ethBalanceFormatted: "0.0000 ETH",
      bytecodeAnalysis: analyzeEvmBytecode("0x6080604052"),
      tokenTelemetry: { isErc20: false },
      rpcLatencyMs: 42,
      liveRpcConnected: true,
    };

    const verdict = await generatePulse4663Audit(bitmask, mockOnChain, {
      maxAllowedRiskScore: 35,
      blockDeltaMutationHooks: true,
      blockLpLockHooks: true,
    });

    expect(verdict.classification).toBe("CRITICAL");
    expect(verdict.recommendedAction).toBe("BLOCK_POOL_INTERACTION");
    expect(verdict.guardContractVerdict.passesOnChainGuard).toBe(false);
  });
});
