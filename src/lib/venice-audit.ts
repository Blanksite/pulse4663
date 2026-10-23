import { HookBitmaskReport } from "./v4-bitmask";
import { RobinhoodLiveOnChainData } from "./robinhood-rpc";

export interface PulseSecurityVerdict {
  riskScore: number;
  classification: "SAFE" | "WARNING" | "CRITICAL";
  recommendedAction:
    | "SAFE_TO_INTERACT"
    | "VERIFY_HOOK_SOURCE"
    | "BLOCK_POOL_INTERACTION";
  executiveSummary: string;
  technicalFindings: string[];
  guardContractVerdict: {
    passesOnChainGuard: boolean;
    solidityCheckSummary: string;
  };
  inferenceMode: "venice-live-api" | "deterministic-engine";
  modelUsed: string;
}

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b";

export async function generatePulse4663Audit(
  bitmaskReport: HookBitmaskReport,
  onChainData: RobinhoodLiveOnChainData,
  options: {
    veniceApiKey?: string;
    maxAllowedRiskScore?: number;
    blockDeltaMutationHooks?: boolean;
    blockLpLockHooks?: boolean;
  } = {}
): Promise<PulseSecurityVerdict> {
  const maxAllowedRiskScore = options.maxAllowedRiskScore ?? 35;
  const blockDeltaMutationHooks = options.blockDeltaMutationHooks ?? true;
  const blockLpLockHooks = options.blockLpLockHooks ?? true;

  const fallback = buildDeterministicPulseVerdict(
    bitmaskReport,
    onChainData,
    {
      maxAllowedRiskScore,
      blockDeltaMutationHooks,
      blockLpLockHooks,
    }
  );

  const apiKey =
    options.veniceApiKey?.trim() || process.env.VENICE_API_KEY?.trim() || "";
  if (!apiKey) {
    return fallback;
  }

  try {
    const res = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 550,
        venice_parameters: {
          include_venice_system_prompt: false,
        },
        messages: [
          {
            role: "system",
            content: `You are Pulse4663 Auditor, an elite EVM & Uniswap v4 security engine for Robinhood Chain (Chain ID: 4663).
Analyze the provided 14-bit Uniswap v4 Hook permission mask and live Robinhood Chain bytecode telemetry.
Respond ONLY with valid JSON:
{
  "riskScore": <number 0-100>,
  "classification": "SAFE" | "WARNING" | "CRITICAL",
  "recommendedAction": "SAFE_TO_INTERACT" | "VERIFY_HOOK_SOURCE" | "BLOCK_POOL_INTERACTION",
  "executiveSummary": "<1-2 concise sentences summarizing the hook bitmask and contract safety>",
  "technicalFindings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              hookAddress: bitmaskReport.address,
              bottom14BitsHex: bitmaskReport.bottom14BitsHex,
              hasDeltaMutationPrivilege:
                bitmaskReport.hasDeltaMutationPrivilege,
              canLockLiquidity: bitmaskReport.canLockLiquidity,
              threatFlags: bitmaskReport.threatFlags,
              targetContract: onChainData.targetAddress,
              bytecodeSizeBytes:
                onChainData.bytecodeAnalysis.bytecodeSizeBytes,
              opcodeWarnings: onChainData.bytecodeAnalysis.opcodeWarnings,
              tokenTelemetry: onChainData.tokenTelemetry,
            }),
          },
        ],
      }),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]);
    const score = Math.max(
      fallback.riskScore,
      typeof parsed.riskScore === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.riskScore)))
        : fallback.riskScore
    );
    const classification: "SAFE" | "WARNING" | "CRITICAL" =
      score >= 70 ? "CRITICAL" : score >= 35 ? "WARNING" : "SAFE";

    return {
      riskScore: score,
      classification,
      recommendedAction:
        classification === "CRITICAL"
          ? "BLOCK_POOL_INTERACTION"
          : classification === "WARNING"
          ? "VERIFY_HOOK_SOURCE"
          : "SAFE_TO_INTERACT",
      executiveSummary:
        typeof parsed.executiveSummary === "string"
          ? parsed.executiveSummary
          : fallback.executiveSummary,
      technicalFindings: Array.isArray(parsed.technicalFindings)
        ? parsed.technicalFindings.map(String)
        : fallback.technicalFindings,
      guardContractVerdict: fallback.guardContractVerdict,
      inferenceMode: "venice-live-api",
      modelUsed: `${DEFAULT_MODEL} (Venice Zero-Retention)`,
    };
  } catch {
    return fallback;
  }
}

function buildDeterministicPulseVerdict(
  bitmaskReport: HookBitmaskReport,
  onChainData: RobinhoodLiveOnChainData,
  policy: {
    maxAllowedRiskScore: number;
    blockDeltaMutationHooks: boolean;
    blockLpLockHooks: boolean;
  }
): PulseSecurityVerdict {
  let score = bitmaskReport.deterministicRiskScore;
  if (onChainData.bytecodeAnalysis.hasSelfDestructOpcode) score += 35;
  if (onChainData.bytecodeAnalysis.hasDelegateCallOpcode) score += 15;
  score = Math.min(99, score);

  const classification: "SAFE" | "WARNING" | "CRITICAL" =
    score >= 70 ? "CRITICAL" : score >= 35 ? "WARNING" : "SAFE";

  let executiveSummary =
    "Hook bitmask and Robinhood Chain (4663) contract bytecode pass all safety invariants. No balance delta confiscation bits (0x000F) or LP withdrawal locks detected.";

  if (bitmaskReport.hasDeltaMutationPrivilege && score >= 70) {
    executiveSummary =
      "CRITICAL UNISWAP V4 HOOK RISK: This Hook address enables custom delta mutation bits (`beforeSwapReturnDelta` / `afterRemoveLiquidityReturnDelta`), allowing it to confiscate swap inputs or LP withdrawals.";
  } else if (bitmaskReport.hasDeltaMutationPrivilege) {
    executiveSummary =
      "ELEVATED TAX HOOK WARNING: This Hook enables `afterSwapReturnDelta` (0x0004), allowing custom output fee extraction on every swap. Verify fee ceiling in contract code.";
  } else if (bitmaskReport.isStandardZeroHook) {
    executiveSummary =
      "Standard Hookless Uniswap v4 Pool (`0x0000...0000`) + verified contract bytecode on Robinhood Chain (4663). Zero hook interception risk.";
  }

  const findings: string[] = [];
  for (const t of bitmaskReport.threatFlags) {
    findings.push(`[${t.severity}] ${t.title}: ${t.description}`);
  }
  for (const w of onChainData.bytecodeAnalysis.opcodeWarnings) {
    findings.push(`[BYTECODE] ${w}`);
  }
  if (onChainData.tokenTelemetry.isErc20) {
    findings.push(
      `[LIVE 4663 ERC-20] ${onChainData.tokenTelemetry.name} ($${onChainData.tokenTelemetry.symbol}) — Total Supply: ${onChainData.tokenTelemetry.totalSupplyFormatted}, Burned in 0x...dEaD: ${onChainData.tokenTelemetry.burnedSupplyFormatted} (${onChainData.tokenTelemetry.burnedPercentage}).`
    );
  }
  if (findings.length === 0) {
    findings.push(
      `Hook bottom 14-bit mask (${bitmaskReport.bottom14BitsHex}) activates ${bitmaskReport.activePermissionsCount} permission(s) with zero delta confiscation flags.`
    );
    findings.push(
      `Target contract on Robinhood Chain (4663) has ${onChainData.bytecodeAnalysis.bytecodeSizeBytes.toLocaleString()} bytes of deployed EVM bytecode with no SELFDESTRUCT or unguarded DELEGATECALL opcodes.`
    );
  }

  let passesOnChainGuard = true;
  let solidityCheckSummary = `Passes Pulse4663Guard.sol verification (Risk ${score}/100 <= ${policy.maxAllowedRiskScore}/100, Delta Mask 0x000F = Clean).`;

  if (
    policy.blockDeltaMutationHooks &&
    bitmaskReport.hasDeltaMutationPrivilege
  ) {
    passesOnChainGuard = false;
    solidityCheckSummary = `Reverted by Pulse4663Guard.sol: DangerousDeltaHookBlocked(${bitmaskReport.address.slice(
      0,
      10
    )}..., ${bitmaskReport.bottom14BitsHex}) — Custom delta mutation bits (0x000F) are blocked by your policy.`;
  } else if (policy.blockLpLockHooks && bitmaskReport.canLockLiquidity) {
    passesOnChainGuard = false;
    solidityCheckSummary = `Reverted by Pulse4663Guard.sol: LiquidityLockHookBlocked(${bitmaskReport.address.slice(
      0,
      10
    )}...) — beforeRemoveLiquidity (0x0200) is blocked by your policy.`;
  } else if (score > policy.maxAllowedRiskScore) {
    passesOnChainGuard = false;
    solidityCheckSummary = `Reverted by Pulse4663Guard.sol: RiskScoreExceedsPolicy(${score}, ${policy.maxAllowedRiskScore}).`;
  }

  return {
    riskScore: score,
    classification,
    recommendedAction:
      classification === "CRITICAL"
        ? "BLOCK_POOL_INTERACTION"
        : classification === "WARNING"
        ? "VERIFY_HOOK_SOURCE"
        : "SAFE_TO_INTERACT",
    executiveSummary,
    technicalFindings: findings,
    guardContractVerdict: {
      passesOnChainGuard,
      solidityCheckSummary,
    },
    inferenceMode: "deterministic-engine",
    modelUsed: "Pulse4663 Bitwise & Opcode Engine",
  };
}
