// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title Pulse4663Guard
 * @notice On-chain Uniswap v4 Hook Bitmask Verifier, Safety Policy Registry, and Guarded Execution Firewall
 *         built for Robinhood Chain (Chain ID: 4663).
 * @dev Inspects the bottom 14 bits (`0x3FFF`) of Uniswap v4 Hook addresses to block unauthorized
 *      `RETURNS_DELTA` token confiscation and `BEFORE_REMOVE_LIQUIDITY` LP lock traps.
 */
contract Pulse4663Guard {
    // -------------------------------------------------------------------------
    // Uniswap v4 14-Bit Hook Permission Constants (@uniswap/v4-core Hooks.sol)
    // -------------------------------------------------------------------------
    uint160 public constant ALL_HOOK_MASK = 0x3FFF;

    uint160 public constant BEFORE_INITIALIZE_FLAG = 1 << 13; // 0x2000
    uint160 public constant AFTER_INITIALIZE_FLAG = 1 << 12; // 0x1000
    uint160 public constant BEFORE_ADD_LIQUIDITY_FLAG = 1 << 11; // 0x0800
    uint160 public constant AFTER_ADD_LIQUIDITY_FLAG = 1 << 10; // 0x0400
    uint160 public constant BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 9; // 0x0200 (LP Lock Vector)
    uint160 public constant AFTER_REMOVE_LIQUIDITY_FLAG = 1 << 8; // 0x0100
    uint160 public constant BEFORE_SWAP_FLAG = 1 << 7; // 0x0080 (Swap Intercept / Gatekeeper)
    uint160 public constant AFTER_SWAP_FLAG = 1 << 6; // 0x0040
    uint160 public constant BEFORE_DONATE_FLAG = 1 << 5; // 0x0020
    uint160 public constant AFTER_DONATE_FLAG = 1 << 4; // 0x0010

    // High-Risk Custom Accounting / Balance Delta Mutation Flags
    uint160 public constant BEFORE_SWAP_RETURNS_DELTA_FLAG = 1 << 3; // 0x0008 (CRITICAL: Can seize swap input)
    uint160 public constant AFTER_SWAP_RETURNS_DELTA_FLAG = 1 << 2; // 0x0004 (HIGH: Can extract uncapped output tax)
    uint160 public constant AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 1; // 0x0002
    uint160 public constant AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 0; // 0x0001 (CRITICAL: Can seize withdrawn LP)

    /// @notice Combined mask of all 4 delta-returning flags capable of mutating user balances directly.
    uint160 public constant DELTA_MUTATION_MASK = 0x000F;

    /// @notice Official Uniswap v4 Singleton PoolManager on Robinhood Chain (4663)
    address public constant ROBINHOOD_V4_POOL_MANAGER =
        0x8366a39CC670B4001A1121B8F6A443A643e40951;

    struct UserSafetyPolicy {
        uint8 maxAllowedRiskScore;
        bool blockDeltaMutationHooks;
        bool blockLpLockHooks;
        bool emergencyPaused;
        uint64 guardedExecutions;
    }

    struct AuditAttestation {
        address auditor;
        uint8 riskScore;
        uint16 hookBitmask;
        bytes32 bytecodeHash;
        uint64 timestamp;
    }

    mapping(address => UserSafetyPolicy) public policies;
    mapping(address => mapping(address => bool)) public whitelistedHooks;
    mapping(address => AuditAttestation) public latestAttestations;

    event PolicyConfigured(
        address indexed user,
        uint8 maxAllowedRiskScore,
        bool blockDeltaMutationHooks,
        bool blockLpLockHooks
    );
    event HookWhitelisted(
        address indexed user,
        address indexed hook,
        bool allowed
    );
    event AuditRecorded(
        address indexed targetContract,
        address indexed auditor,
        uint8 riskScore,
        uint16 hookBitmask,
        bytes32 bytecodeHash
    );
    event GuardedPoolVerified(
        address indexed user,
        address indexed hook,
        uint16 hookBitmask,
        uint8 computedRiskScore
    );

    error PolicyEmergencyPaused();
    error DangerousDeltaHookBlocked(address hook, uint16 deltaBits);
    error LiquidityLockHookBlocked(address hook);
    error RiskScoreExceedsPolicy(uint8 computedScore, uint8 maxAllowed);
    error InvalidRiskThreshold();

    /**
     * @notice Configures the caller's on-chain Uniswap v4 firewall policy on Robinhood Chain.
     */
    function configurePolicy(
        uint8 maxAllowedRiskScore,
        bool blockDeltaMutationHooks,
        bool blockLpLockHooks
    ) external {
        if (maxAllowedRiskScore > 100) revert InvalidRiskThreshold();

        UserSafetyPolicy storage policy = policies[msg.sender];
        policy.maxAllowedRiskScore = maxAllowedRiskScore;
        policy.blockDeltaMutationHooks = blockDeltaMutationHooks;
        policy.blockLpLockHooks = blockLpLockHooks;

        emit PolicyConfigured(
            msg.sender,
            maxAllowedRiskScore,
            blockDeltaMutationHooks,
            blockLpLockHooks
        );
    }

    /**
     * @notice Allows a user to explicitly trust an audited Uniswap v4 Hook contract.
     */
    function setHookWhitelist(address hook, bool allowed) external {
        whitelistedHooks[msg.sender][hook] = allowed;
        emit HookWhitelisted(msg.sender, hook, allowed);
    }

    /**
     * @notice Decodes the 14-bit permission mask and computes the deterministic on-chain risk score (0-100).
     */
    function inspectHookAddress(
        address hook
    )
        public
        pure
        returns (
            uint16 bitmask,
            bool hasDeltaMutation,
            bool canLockLiquidity,
            bool canInterceptSwap,
            uint8 deterministicRiskScore
        )
    {
        if (hook == address(0)) {
            return (0, false, false, false, 0);
        }

        uint160 raw = uint160(hook) & ALL_HOOK_MASK;
        bitmask = uint16(raw);
        hasDeltaMutation = (raw & DELTA_MUTATION_MASK) != 0;
        canLockLiquidity = (raw & BEFORE_REMOVE_LIQUIDITY_FLAG) != 0;
        canInterceptSwap = (raw & BEFORE_SWAP_FLAG) != 0;

        uint256 score = 5;
        if ((raw & BEFORE_SWAP_RETURNS_DELTA_FLAG) != 0) score += 45;
        if ((raw & AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG) != 0) score += 35;
        if ((raw & AFTER_SWAP_RETURNS_DELTA_FLAG) != 0) score += 25;
        if (canLockLiquidity) score += 20;
        if (canInterceptSwap) score += 10;

        deterministicRiskScore = score > 99 ? 99 : uint8(score);
    }

    /**
     * @notice Pre-execution guard that reverts if a Uniswap v4 Hook violates the caller's safety policy.
     */
    function verifyHookBeforeExecution(address hook) external returns (uint8) {
        UserSafetyPolicy storage policy = policies[msg.sender];
        if (policy.emergencyPaused) revert PolicyEmergencyPaused();

        if (whitelistedHooks[msg.sender][hook] || hook == address(0)) {
            policy.guardedExecutions += 1;
            return 0;
        }

        (
            uint16 bitmask,
            bool hasDeltaMutation,
            bool canLockLiquidity,
            ,
            uint8 riskScore
        ) = inspectHookAddress(hook);

        if (policy.blockDeltaMutationHooks && hasDeltaMutation) {
            revert DangerousDeltaHookBlocked(
                hook,
                uint16(uint160(hook) & DELTA_MUTATION_MASK)
            );
        }

        if (policy.blockLpLockHooks && canLockLiquidity) {
            revert LiquidityLockHookBlocked(hook);
        }

        uint8 threshold = policy.maxAllowedRiskScore == 0
            ? 35
            : policy.maxAllowedRiskScore;
        if (riskScore > threshold) {
            revert RiskScoreExceedsPolicy(riskScore, threshold);
        }

        policy.guardedExecutions += 1;
        emit GuardedPoolVerified(msg.sender, hook, bitmask, riskScore);
        return riskScore;
    }

    /**
     * @notice Records an on-chain security attestation for a contract on Robinhood Chain.
     */
    function recordAuditAttestation(
        address targetContract,
        uint8 riskScore
    ) external {
        if (riskScore > 100) revert InvalidRiskThreshold();

        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(targetContract)
        }

        uint16 hookMask = uint16(uint160(targetContract) & ALL_HOOK_MASK);
        latestAttestations[targetContract] = AuditAttestation({
            auditor: msg.sender,
            riskScore: riskScore,
            hookBitmask: hookMask,
            bytecodeHash: codeHash,
            timestamp: uint64(block.timestamp)
        });

        emit AuditRecorded(
            targetContract,
            msg.sender,
            riskScore,
            hookMask,
            codeHash
        );
    }
}
