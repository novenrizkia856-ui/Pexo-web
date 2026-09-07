import { MOCK_MODE, PEXO_CONFIG, isPlaceholderAddress } from "@/config/pexo.config";
import { shortAddress } from "@/config/pexo.config";

/**
 * Standing notice about what this page is actually talking to.
 *
 * Two states, and the distinction matters more than it looks. In mock mode
 * nothing here touches a chain and it must say so, or a demo gets mistaken for
 * a deployment. Live, it names the contract and links it, so a visitor can go
 * and read the verified source rather than take the page's word for anything.
 */
export function LiveBanner() {
  const address = PEXO_CONFIG.contracts.gapGuard;

  if (MOCK_MODE || isPlaceholderAddress(address)) {
    return (
      <div
        role="status"
        className="pxo-card mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-dashed px-5 py-3.5"
      >
        <span className="pxo-state pxo-state-triggered">Simulated</span>
        <p className="text-sm text-muted">
          Prices, balances and transactions on this page are generated locally because no
          guard contract is deployed yet. Nothing here touches a chain.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="pxo-card mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5"
    >
      <span className="pxo-state pxo-state-armed">Live</span>
      <p className="text-sm text-muted">
        Talking to{" "}
        <a
          className="num text-ink underline-offset-4 hover:underline"
          href={`${PEXO_CONFIG.chain.explorerUrl}/address/${address}?tab=contract`}
          target="_blank"
          rel="noreferrer"
          title={address}
        >
          {shortAddress(address)}
        </a>{" "}
        on {PEXO_CONFIG.chain.name}. The source is verified: read it before you deposit.
      </p>
    </div>
  );
}
