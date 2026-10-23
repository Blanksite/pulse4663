import { NextRequest, NextResponse } from "next/server";
import { decodeHookAddressBitmask } from "@/lib/v4-bitmask";
import {
  PULSE_4663_PRESETS,
  fetchRobinhoodOnChainTelemetry,
  checkLiveRobinhoodV4Stack,
} from "@/lib/robinhood-rpc";
import { generatePulse4663Audit } from "@/lib/venice-audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      presetId,
      targetAddress: rawTargetAddress,
      hookAddress: rawHookAddress,
      veniceApiKey,
      policy,
    } = body as {
      presetId?: string;
      targetAddress?: string;
      hookAddress?: string;
      veniceApiKey?: string;
      policy?: {
        maxAllowedRiskScore?: number;
        blockDeltaMutationHooks?: boolean;
        blockLpLockHooks?: boolean;
      };
    };

    const preset =
      PULSE_4663_PRESETS.find((p) => p.id === presetId) ?? PULSE_4663_PRESETS[0];

    const targetAddress =
      rawTargetAddress && /^0x[0-9a-fA-F]{40}$/.test(rawTargetAddress.trim())
        ? rawTargetAddress.trim()
        : preset.targetAddress;

    const hookAddress =
      rawHookAddress && /^0x[0-9a-fA-F]{40}$/.test(rawHookAddress.trim())
        ? rawHookAddress.trim()
        : preset.hookAddress;

    const bitmaskReport = decodeHookAddressBitmask(hookAddress);

    const [onChainData, v4StackStatus] = await Promise.all([
      fetchRobinhoodOnChainTelemetry(targetAddress),
      checkLiveRobinhoodV4Stack(),
    ]);

    const securityVerdict = await generatePulse4663Audit(
      bitmaskReport,
      onChainData,
      {
        veniceApiKey,
        maxAllowedRiskScore: policy?.maxAllowedRiskScore ?? 35,
        blockDeltaMutationHooks: policy?.blockDeltaMutationHooks ?? true,
        blockLpLockHooks: policy?.blockLpLockHooks ?? true,
      }
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      presetUsed: preset.id,
      bitmaskReport,
      onChainData,
      v4StackStatus,
      securityVerdict,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run Pulse4663 scan.",
      },
      { status: 400 }
    );
  }
}
