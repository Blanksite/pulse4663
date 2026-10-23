import { NextRequest, NextResponse } from "next/server";
import {
  decodeHookAddressBitmask,
  synthesizeHookAddressForMask,
} from "@/lib/v4-bitmask";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const deployerAddress =
      typeof body.deployerAddress === "string"
        ? body.deployerAddress.trim()
        : "0x9423Be20379148fEC92499191282fFfe6B8D9356";
    const targetMask =
      typeof body.targetMask === "number" ? body.targetMask & 0x3fff : 0x00c0;

    const mined = synthesizeHookAddressForMask(deployerAddress, targetMask);
    const decoded = decodeHookAddressBitmask(mined.synthesizedHookAddress);

    return NextResponse.json({
      mined,
      decoded,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to mine hook salt.",
      },
      { status: 400 }
    );
  }
}
