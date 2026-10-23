export interface HookPermissionBit {
  bitIndex: number;
  hexMask: string;
  maskValue: number;
  name: string;
  shortLabel: string;
  enabled: boolean;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  technicalImpact: string;
}

export interface HookBitmaskReport {
  address: string;
  bottom14BitsHex: string;
  bottom14BitsBinary: string;
  bottom14BitsDecimal: number;
  isStandardZeroHook: boolean;
  activePermissionsCount: number;
  hasDeltaMutationPrivilege: boolean;
  canLockLiquidity: boolean;
  canInterceptSwaps: boolean;
  permissions: HookPermissionBit[];
  threatFlags: {
    code: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description: string;
  }[];
  deterministicRiskScore: number;
  deterministicClassification: "SAFE" | "WARNING" | "CRITICAL";
}

export const UNISWAP_V4_PERMISSION_DEFS: Omit<HookPermissionBit, "enabled">[] =
  [
    {
      bitIndex: 13,
      hexMask: "0x2000",
      maskValue: 1 << 13,
      name: "BEFORE_INITIALIZE_FLAG",
      shortLabel: "beforeInitialize",
      riskLevel: "SAFE",
      technicalImpact:
        "Runs custom validation logic before a new Uniswap v4 PoolKey is initialized.",
    },
    {
      bitIndex: 12,
      hexMask: "0x1000",
      maskValue: 1 << 12,
      name: "AFTER_INITIALIZE_FLAG",
      shortLabel: "afterInitialize",
      riskLevel: "SAFE",
      technicalImpact:
        "Sets initial hook state or starting dynamic fee right after pool initialization.",
    },
    {
      bitIndex: 11,
      hexMask: "0x0800",
      maskValue: 1 << 11,
      name: "BEFORE_ADD_LIQUIDITY_FLAG",
      shortLabel: "beforeAddLiquidity",
      riskLevel: "LOW",
      technicalImpact:
        "Intercepts LP minting; can enforce LP allowlists or deposit caps.",
    },
    {
      bitIndex: 10,
      hexMask: "0x0400",
      maskValue: 1 << 10,
      name: "AFTER_ADD_LIQUIDITY_FLAG",
      shortLabel: "afterAddLiquidity",
      riskLevel: "LOW",
      technicalImpact:
        "Executes post-deposit accounting or staking receipt hooks.",
    },
    {
      bitIndex: 9,
      hexMask: "0x0200",
      maskValue: 1 << 9,
      name: "BEFORE_REMOVE_LIQUIDITY_FLAG",
      shortLabel: "beforeRemoveLiquidity",
      riskLevel: "HIGH",
      technicalImpact:
        "Can revert or time-lock LP withdrawals, potentially trapping liquidity providers.",
    },
    {
      bitIndex: 8,
      hexMask: "0x0100",
      maskValue: 1 << 8,
      name: "AFTER_REMOVE_LIQUIDITY_FLAG",
      shortLabel: "afterRemoveLiquidity",
      riskLevel: "LOW",
      technicalImpact:
        "Updates reward accounting after liquidity is withdrawn.",
    },
    {
      bitIndex: 7,
      hexMask: "0x0080",
      maskValue: 1 << 7,
      name: "BEFORE_SWAP_FLAG",
      shortLabel: "beforeSwap",
      riskLevel: "MEDIUM",
      technicalImpact:
        "Runs before every swap; can adjust dynamic swap fees or revert sell orders (honeypot gatekeeping).",
    },
    {
      bitIndex: 6,
      hexMask: "0x0040",
      maskValue: 1 << 6,
      name: "AFTER_SWAP_FLAG",
      shortLabel: "afterSwap",
      riskLevel: "LOW",
      technicalImpact:
        "Runs after swap execution; commonly used for TWAMM orders, buyback triggers, or oracle updates.",
    },
    {
      bitIndex: 5,
      hexMask: "0x0020",
      maskValue: 1 << 5,
      name: "BEFORE_DONATE_FLAG",
      shortLabel: "beforeDonate",
      riskLevel: "SAFE",
      technicalImpact: "Intercepts direct token donations to in-range LPs.",
    },
    {
      bitIndex: 4,
      hexMask: "0x0010",
      maskValue: 1 << 4,
      name: "AFTER_DONATE_FLAG",
      shortLabel: "afterDonate",
      riskLevel: "SAFE",
      technicalImpact:
        "Triggers post-donation accounting or dividend distributions.",
    },
    {
      bitIndex: 3,
      hexMask: "0x0008",
      maskValue: 1 << 3,
      name: "BEFORE_SWAP_RETURNS_DELTA_FLAG",
      shortLabel: "beforeSwapReturnDelta",
      riskLevel: "CRITICAL",
      technicalImpact:
        "CRITICAL PRIVILEGE: Enables custom curve accounting (NoOp). The hook can take 100% of the trader's input tokens and return zero output.",
    },
    {
      bitIndex: 2,
      hexMask: "0x0004",
      maskValue: 1 << 2,
      name: "AFTER_SWAP_RETURNS_DELTA_FLAG",
      shortLabel: "afterSwapReturnDelta",
      riskLevel: "HIGH",
      technicalImpact:
        "HIGH PRIVILEGE: Allows the hook to extract an arbitrary percentage (up to 100%) of the swap output token as a custom hook fee.",
    },
    {
      bitIndex: 1,
      hexMask: "0x0002",
      maskValue: 1 << 1,
      name: "AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG",
      shortLabel: "afterAddLiquidityReturnDelta",
      riskLevel: "HIGH",
      technicalImpact:
        "Allows the hook to alter balance deltas during LP deposits (custom deposit fee).",
    },
    {
      bitIndex: 0,
      hexMask: "0x0001",
      maskValue: 1 << 0,
      name: "AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG",
      shortLabel: "afterRemoveLiquidityReturnDelta",
      riskLevel: "CRITICAL",
      technicalImpact:
        "CRITICAL PRIVILEGE: Allows the hook to confiscate up to 100% of underlying tokens when LPs withdraw their liquidity.",
    },
  ];

/**
 * Decodes the bottom 14 bits (`0x3FFF`) of any 20-byte EVM address according to
 * the Uniswap v4 `Hooks.sol` specification.
 */
export function decodeHookAddressBitmask(rawAddress: string): HookBitmaskReport {
  const clean = rawAddress.trim();
  const isValidHex = /^0x[0-9a-fA-F]{40}$/.test(clean);

  if (!isValidHex) {
    throw new Error(
      "Invalid EVM address format. Please provide a 20-byte 0x-prefixed hex address."
    );
  }

  const last4Hex = clean.slice(-4);
  const rawInt = parseInt(last4Hex, 16);
  const mask14 = rawInt & 0x3fff;
  const isZero = /^0x0{40}$/i.test(clean);

  const permissions: HookPermissionBit[] = UNISWAP_V4_PERMISSION_DEFS.map(
    (def) => ({
      ...def,
      enabled: !isZero && (mask14 & def.maskValue) !== 0,
    })
  );

  const activePermissions = permissions.filter((p) => p.enabled);
  const threatFlags: HookBitmaskReport["threatFlags"] = [];

  const hasBeforeSwapDelta = (mask14 & (1 << 3)) !== 0 && !isZero;
  const hasAfterSwapDelta = (mask14 & (1 << 2)) !== 0 && !isZero;
  const hasAfterAddDelta = (mask14 & (1 << 1)) !== 0 && !isZero;
  const hasAfterRemoveDelta = (mask14 & (1 << 0)) !== 0 && !isZero;
  const canLockLiquidity = (mask14 & (1 << 9)) !== 0 && !isZero;
  const canInterceptSwaps = (mask14 & (1 << 7)) !== 0 && !isZero;

  if (hasBeforeSwapDelta) {
    threatFlags.push({
      code: "BEFORE_SWAP_DELTA_DRAIN_RISK",
      severity: "CRITICAL",
      title: "Unbounded Input Confiscation Privilege (beforeSwapReturnDelta)",
      description:
        "Bit 3 (0x0008) is active. This Hook can bypass Uniswap v4 core swap math and take 100% of swap input tokens via custom delta accounting.",
    });
  }

  if (hasAfterRemoveDelta) {
    threatFlags.push({
      code: "LP_WITHDRAWAL_CONFISCATION_RISK",
      severity: "CRITICAL",
      title:
        "LP Withdrawal Confiscation Privilege (afterRemoveLiquidityReturnDelta)",
      description:
        "Bit 0 (0x0001) is active. This Hook can seize underlying tokens when liquidity providers attempt to withdraw from the pool.",
    });
  }

  if (hasAfterSwapDelta) {
    threatFlags.push({
      code: "UNCAPPED_SWAP_OUTPUT_TAX",
      severity: "HIGH",
      title: "Arbitrary Swap Output Tax Privilege (afterSwapReturnDelta)",
      description:
        "Bit 2 (0x0004) is active. This Hook can deduct an uncapped tax from the output tokens received by the trader.",
    });
  }

  if (canLockLiquidity) {
    threatFlags.push({
      code: "LP_EXIT_GATEKEEPER",
      severity: "HIGH",
      title: "Liquidity Removal Gatekeeper (beforeRemoveLiquidity)",
      description:
        "Bit 9 (0x0200) is active. The Hook can selectively revert removeLiquidity calls, locking LP funds inside the pool.",
    });
  }

  if (canInterceptSwaps && !hasBeforeSwapDelta) {
    threatFlags.push({
      code: "BEFORE_SWAP_INTERCEPTOR",
      severity: "MEDIUM",
      title: "Pre-Swap Execution Interceptor (beforeSwap)",
      description:
        "Bit 7 (0x0080) is active. Used for legitimate dynamic fees, but can also enforce address blacklists or block sell orders if unverified.",
    });
  }

  let score = 5;
  if (hasBeforeSwapDelta) score += 48;
  if (hasAfterRemoveDelta) score += 35;
  if (hasAfterSwapDelta) score += 25;
  if (hasAfterAddDelta) score += 15;
  if (canLockLiquidity) score += 22;
  if (canInterceptSwaps) score += 10;

  const finalScore = isZero ? 0 : Math.min(99, score);
  const classification =
    finalScore >= 70 ? "CRITICAL" : finalScore >= 35 ? "WARNING" : "SAFE";

  return {
    address: clean,
    bottom14BitsHex: `0x${mask14.toString(16).toUpperCase().padStart(4, "0")}`,
    bottom14BitsBinary: mask14.toString(2).padStart(14, "0"),
    bottom14BitsDecimal: mask14,
    isStandardZeroHook: isZero,
    activePermissionsCount: activePermissions.length,
    hasDeltaMutationPrivilege:
      hasBeforeSwapDelta ||
      hasAfterSwapDelta ||
      hasAfterAddDelta ||
      hasAfterRemoveDelta,
    canLockLiquidity,
    canInterceptSwaps,
    permissions,
    threatFlags,
    deterministicRiskScore: finalScore,
    deterministicClassification: classification,
  };
}

/**
 * Simulates CREATE2 salt mining for developers building Uniswap v4 Hooks on Robinhood Chain (4663),
 * producing a deterministic salt and valid contract address whose bottom 14 bits match `targetMask`.
 */
export function synthesizeHookAddressForMask(
  deployerAddress: string,
  targetMask: number
): {
  targetMaskHex: string;
  targetMaskBinary: string;
  minedSaltHex: string;
  synthesizedHookAddress: string;
  iterations: number;
} {
  const cleanMask = targetMask & 0x3fff;
  const maskHex = cleanMask.toString(16).padStart(4, "0");

  // Deterministic pseudo-CREATE2 mining simulation for instant UX feedback
  let seed = (cleanMask * 2654435761) >>> 0;
  const iterations = 1200 + (cleanMask % 4800);
  const saltHex = `0x${seed.toString(16).padStart(64, "0")}`;

  const deployerPrefix = /^0x[0-9a-fA-F]{40}$/.test(deployerAddress)
    ? deployerAddress.slice(2, 10).toLowerCase()
    : "46630000";

  const middle = ((seed ^ 0xa5a5a5a5) >>> 0).toString(16).padStart(8, "4");
  const body36 = `${deployerPrefix}${middle}8366a39cc670b4001a11`.slice(0, 36);
  const synthesizedHookAddress = `0x${body36}${maskHex}`;

  return {
    targetMaskHex: `0x${maskHex.toUpperCase()}`,
    targetMaskBinary: cleanMask.toString(2).padStart(14, "0"),
    minedSaltHex: saltHex,
    synthesizedHookAddress,
    iterations,
  };
}
