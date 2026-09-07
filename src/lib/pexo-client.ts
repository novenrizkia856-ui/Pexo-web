import {
  BaseError,
  ContractFunctionRevertedError,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import { PEXO_ABI } from "@/lib/abi";
import { ERC20_ABI } from "@/lib/erc20-abi";
import {
  PEXO_ADDRESS,
  ensureCorrectChain,
  getWalletClient,
  publicClient,
} from "@/lib/chain";
import { PEXO_CONFIG, type SupportedAsset } from "@/config/pexo.config";
import { fromTokenUnits, fromUsdgUnits } from "@/lib/units";
import type { Guard } from "@/lib/guards";

/**
 * Everything that actually touches the deployed contract.
 *
 * Kept apart from the store so the store stays a thin state container and this
 * file can be read on its own when checking what the app does on chain.
 */

const GUARD_CREATED = parseAbiItem(
  "event GuardCreated(uint256 indexed guardId, address indexed owner, address indexed token, uint24 fee, uint256 amount, uint256 triggerPrice, uint256 floorPrice, uint64 expiry)",
);

/** Raw tuple returned by the public `guards` mapping getter. */
type RawGuard = readonly [
  owner: Address,
  expiry: bigint,
  fee: number,
  active: boolean,
  token: Address,
  amount: bigint,
  triggerPrice: bigint,
  floorPrice: bigint,
];

function assetFor(token: Address): SupportedAsset {
  const known = PEXO_CONFIG.tokens.supportedAssets.find(
    (a) => a.address.toLowerCase() === token.toLowerCase(),
  );
  if (known) return known;
  // A guard on a token this build does not know about. Show it rather than
  // hide it: the owner still needs to be able to withdraw.
  return {
    id: token.toLowerCase(),
    symbol: `${token.slice(0, 6)}…`,
    name: "Unknown token",
    address: token,
    decimals: 18,
    logo: "",
    accent: "#6b7280",
  };
}

/**
 * Finds every guard an address owns.
 *
 * The contract has no per-owner getter, so discovery goes through the
 * `GuardCreated` log with `owner` as an indexed topic, then reads current state
 * for each id. The event only says a guard once existed; `guards()` says what
 * it is now.
 */
export async function fetchGuards(owner: Address): Promise<Guard[]> {
  const logs = await publicClient.getLogs({
    address: PEXO_ADDRESS,
    event: GUARD_CREATED,
    args: { owner },
    fromBlock: PEXO_CONFIG.contracts.deploymentBlock,
    toBlock: "latest",
  });

  if (logs.length === 0) return [];

  const ids = [...new Set(logs.map((l) => l.args.guardId as bigint))];

  const states = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: PEXO_ADDRESS,
      abi: PEXO_ABI,
      functionName: "guards",
      args: [id],
    })),
    allowFailure: true,
  });

  const guards: Guard[] = [];
  ids.forEach((id, i) => {
    const res = states[i];
    if (res.status !== "success") return;
    const g = res.result as unknown as RawGuard;
    const asset = assetFor(g[4]);

    guards.push({
      id: id.toString(),
      asset,
      amount: fromTokenUnits(g[5], asset.decimals),
      triggerPrice: fromUsdgUnits(g[6]),
      floorPrice: fromUsdgUnits(g[7]),
      fee: Number(g[2]),
      expiresAt: Number(g[1]) * 1000,
      createdAt: 0,
      status: g[3] ? "armed" : "triggered",
    });
  });

  // Newest first.
  return guards.sort((a, b) => Number(b.id) - Number(a.id));
}

/**
 * Current exit quote for a position, price impact included.
 *
 * `guardStatus` is deliberately not a `view` function: pricing a Uniswap V3
 * trade requires QuoterV2, which executes a swap and recovers the result from
 * the revert, and that is unreachable through STATICCALL. `eth_call` is not a
 * static context, so simulating it works fine and costs nothing.
 */
export async function fetchQuote(guardId: string): Promise<number> {
  try {
    const { result } = await publicClient.simulateContract({
      address: PEXO_ADDRESS,
      abi: PEXO_ABI,
      functionName: "guardStatus",
      args: [BigInt(guardId)],
    });
    const [currentSpotOutput] = result as unknown as readonly [
      bigint, bigint, bigint, boolean, boolean,
    ];
    return fromUsdgUnits(currentSpotOutput);
  } catch {
    // A pool that cannot be quoted reads as zero rather than breaking the page.
    return 0;
  }
}

export async function fetchQuotes(guardIds: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    guardIds.map(async (id) => [id, await fetchQuote(id)] as const),
  );
  return Object.fromEntries(entries);
}

export async function fetchTokenBalance(
  token: Address,
  owner: Address,
  decimals: number,
): Promise<number> {
  const raw = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
  return fromTokenUnits(raw as bigint, decimals);
}

export async function fetchAllowance(
  token: Address,
  owner: Address,
  decimals: number,
): Promise<number> {
  const raw = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, PEXO_ADDRESS],
  });
  return fromTokenUnits(raw as bigint, decimals);
}

/*//////////////////////////////////////////////////////////////
                               WRITES
//////////////////////////////////////////////////////////////*/

async function send(
  account: Address,
  request: Parameters<ReturnType<typeof getWalletClient>["writeContract"]>[0],
): Promise<Hash> {
  await ensureCorrectChain();
  const wallet = getWalletClient(account);
  const hash = await wallet.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Approves exactly `amount`, never more.
 *
 * Pexo pulls the exact deposit and nothing else, so an unlimited allowance
 * would be a standing risk with no upside. If some allowance is already
 * outstanding this still sets the exact figure rather than topping up.
 */
export async function approveExact(
  account: Address,
  asset: SupportedAsset,
  amountUnits: bigint,
): Promise<Hash> {
  await ensureCorrectChain();
  const wallet = getWalletClient(account);
  const { request } = await publicClient.simulateContract({
    account,
    address: asset.address as Address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [PEXO_ADDRESS, amountUnits],
  });
  const hash = await wallet.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function createGuard(
  account: Address,
  args: {
    asset: SupportedAsset;
    fee: number;
    amountUnits: bigint;
    triggerUnits: bigint;
    floorUnits: bigint;
    expirySeconds: bigint;
  },
): Promise<Hash> {
  await ensureCorrectChain();
  const { request } = await publicClient.simulateContract({
    account,
    address: PEXO_ADDRESS,
    abi: PEXO_ABI,
    functionName: "createGuard",
    args: [
      args.asset.address as Address,
      args.fee,
      args.amountUnits,
      args.triggerUnits,
      args.floorUnits,
      args.expirySeconds,
    ],
  });
  return send(account, request);
}

export async function triggerGuard(account: Address, guardId: string): Promise<Hash> {
  await ensureCorrectChain();
  const { request } = await publicClient.simulateContract({
    account,
    address: PEXO_ADDRESS,
    abi: PEXO_ABI,
    functionName: "trigger",
    args: [BigInt(guardId)],
  });
  return send(account, request);
}

export async function withdrawGuard(account: Address, guardId: string): Promise<Hash> {
  await ensureCorrectChain();
  const { request } = await publicClient.simulateContract({
    account,
    address: PEXO_ADDRESS,
    abi: PEXO_ABI,
    functionName: "withdraw",
    args: [BigInt(guardId)],
  });
  return send(account, request);
}

/*//////////////////////////////////////////////////////////////
                               ERRORS
//////////////////////////////////////////////////////////////*/

/**
 * Turns a revert into something a person can act on.
 *
 * The contract uses custom errors, which arrive as a four byte selector. Left
 * raw they tell a user nothing; decoded, most of them say exactly what to
 * change.
 */
export function explainError(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      const args = (reverted.data?.args ?? []) as unknown[];
      switch (name) {
        case "TriggerConditionNotMet":
          return "The price has not reached this guard's trigger yet.";
        case "GuardNotActive":
          return "That guard has already been settled or withdrawn.";
        case "GuardExpired":
          return "This guard has expired. It can no longer settle, but you can withdraw.";
        case "NotGuardOwner":
          return "Only the owner of a guard can withdraw it.";
        case "FloorAboveTrigger":
          return "The floor cannot be above the trigger.";
        case "FloorBelowMinimum":
          return `The floor is below the ${fromUsdgUnits(
            (args[1] as bigint) ?? 0n,
          ).toLocaleString("en-US", { style: "currency", currency: "USD" })} minimum.`;
        case "ExpiryInPast":
          return "The expiry must be in the future.";
        case "TokenNotAllowed":
          return "That token is not on this deployment's allowlist.";
        case "PoolDoesNotExist":
          return "There is no pool at that fee tier for this token.";
        case "SettlementBelowFloor":
          return "The pool cannot deliver this guard's floor right now.";
        case "TransferAmountMismatch":
          return "The token did not transfer the full amount. Fee on transfer tokens are not supported.";
        case "ZeroAmount":
          return "Enter an amount above zero.";
        default:
          if (name) return `Reverted: ${name}`;
      }
    }
    if (err.shortMessage?.includes("User rejected")) return "You rejected the request.";
    if (err.shortMessage?.includes("Too little received")) {
      return "The pool cannot fill at this guard's floor right now. Nothing was settled and your tokens are untouched.";
    }
    return err.shortMessage || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/*//////////////////////////////////////////////////////////////
                          CONFIG DRIFT
//////////////////////////////////////////////////////////////*/

/**
 * Checks this build's config against the contract it points at.
 *
 * The allowlist, the settlement currency, the minimum deposit and the fee
 * constants are all immutable on chain but are duplicated here so the UI can
 * render without a round trip. If a build is ever pointed at a different
 * deployment, or someone edits a constant that the contract actually fixes,
 * the app would quietly show numbers that do not match what a transaction will
 * do. That is worth catching loudly rather than letting a user discover it
 * through a confusing revert.
 *
 * Returns a list of human readable mismatches; empty means the build agrees
 * with the chain.
 */
export async function findConfigDrift(): Promise<string[]> {
  const problems: string[] = [];
  const base = { address: PEXO_ADDRESS, abi: PEXO_ABI } as const;

  try {
    const [usdg, minDeposit, feeBps, bountyBps, allowlistLength] = await Promise.all([
      publicClient.readContract({ ...base, functionName: "usdg" }),
      publicClient.readContract({ ...base, functionName: "minDepositUsdEquivalent" }),
      publicClient.readContract({ ...base, functionName: "PROTOCOL_FEE_BPS" }),
      publicClient.readContract({ ...base, functionName: "KEEPER_BOUNTY_BPS" }),
      publicClient.readContract({ ...base, functionName: "allowedTokensLength" }),
    ]);

    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

    if (!same(usdg, PEXO_CONFIG.tokens.usdg.address)) {
      problems.push("The settlement currency in this build is not the one the contract uses.");
    }

    const onChainMin = fromUsdgUnits(minDeposit);
    if (onChainMin !== PEXO_CONFIG.protocol.minDepositUsd) {
      problems.push(
        `Minimum deposit is ${onChainMin} on chain but ${PEXO_CONFIG.protocol.minDepositUsd} in this build.`,
      );
    }
    if (feeBps !== PEXO_CONFIG.protocol.feeBps) {
      problems.push(`Protocol fee is ${feeBps} bps on chain but ${PEXO_CONFIG.protocol.feeBps} here.`);
    }
    if (bountyBps !== PEXO_CONFIG.protocol.keeperBountyBps) {
      problems.push(
        `Keeper bounty is ${bountyBps} bps on chain but ${PEXO_CONFIG.protocol.keeperBountyBps} here.`,
      );
    }

    const onChain: string[] = [];
    for (let i = 0n; i < allowlistLength; i += 1n) {
      const token = await publicClient.readContract({
        ...base,
        functionName: "allowedTokens",
        args: [i],
      });
      onChain.push(token.toLowerCase());
    }

    const configured = PEXO_CONFIG.tokens.supportedAssets.map((a) => a.address.toLowerCase());
    const missing = onChain.filter((t) => !configured.includes(t));
    const extra = configured.filter((t) => !onChain.includes(t));
    if (missing.length) {
      problems.push(`${missing.length} allowlisted token(s) are missing from this build.`);
    }
    if (extra.length) {
      problems.push(
        `This build offers ${extra.length} token(s) the contract does not accept; creating a guard on them will revert.`,
      );
    }
  } catch {
    problems.push("Could not reach the contract to verify this build's configuration.");
  }

  return problems;
}
