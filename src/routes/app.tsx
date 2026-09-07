import { useEffect, useMemo, useState } from "react";
import { MOCK_MODE, PEXO_CONFIG } from "@/config/pexo.config";
import { useProtocol } from "@/state/protocol";
import { effectiveStatus, isTriggerable } from "@/lib/guards";
import { money } from "@/lib/format";
import { txUrl } from "@/lib/chain";
import { SiteHeader } from "@/components/site-header";
import { LiveBanner } from "@/components/live-banner";
import { GuardCard } from "@/components/guard-card";
import { CreateGuard } from "@/components/create-guard";
import { Button, Eyebrow } from "@/components/ui";

type Tab = "positions" | "keeper";

/** Abbreviates an address for the header chip. */
function shortAccount(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function AppRoute() {
  const {
    connected,
    account,
    walletAvailable,
    walletConnectAvailable,
    guards,
    loadingGuards,
    status,
    error,
    lastTxHash,
    connect,
    disconnect,
    refresh,
    advance,
    quoteFor,
    clearError,
    checkConfig,
    triggerGuard,
    withdrawGuard,
  } = useProtocol();

  const [tab, setTab] = useState<Tab>("positions");
  const [creating, setCreating] = useState(false);
  const busy = status === "pending";

  // A build pointed at the wrong deployment shows wrong numbers everywhere, so
  // check that before anything else is trusted.
  useEffect(() => {
    void checkConfig();
  }, [checkConfig]);

  // Only meaningful in mock mode; on chain the quotes come from the contract.
  useEffect(() => {
    if (!MOCK_MODE) return;
    const id = window.setInterval(advance, 2600);
    return () => window.clearInterval(id);
  }, [advance]);

  // Quotes move with the pool, so re-read them periodically while connected.
  useEffect(() => {
    if (MOCK_MODE || !connected) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [connected, refresh]);

  const open = useMemo(
    () => guards.filter((g) => effectiveStatus(g) !== "triggered"),
    [guards],
  );

  const triggerable = useMemo(
    () => guards.filter((g) => isTriggerable(g, quoteFor(g.id))),
    [guards, quoteFor],
  );

  const shown = tab === "keeper" ? triggerable : guards;

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full max-w-[76rem] px-6 pb-24 pt-28 md:px-10">
        <LiveBanner />

        {error ? (
          <div
            role="alert"
            className="pxo-card mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-l-2 border-l-danger px-5 py-3.5"
          >
            <span className="text-sm text-danger">{error}</span>
            <Button variant="ghost" small onClick={clearError}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {lastTxHash && !error ? (
          <div className="pxo-card mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
            <span className="pxo-state pxo-state-armed">Confirmed</span>
            <a
              className="num text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
              href={txUrl(lastTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAccount(lastTxHash)}
            </a>
          </div>
        ) : null}

        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>{PEXO_CONFIG.chain.name}</Eyebrow>
            <h1 className="pxo-title mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)]">
              {tab === "keeper" ? "Open bounties" : "Your guards"}
            </h1>
            <p className="pxo-lead mt-2 text-sm">
              {tab === "keeper"
                ? "Any address can settle these. The bounty goes to whoever does."
                : loadingGuards
                  ? "Reading your guards from the chain…"
                  : `${open.length} open · ${guards.length} total`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {connected && account ? (
              <>
                <span className="num pxo-card px-4 py-2 text-sm" title={account}>
                  {shortAccount(account)}
                </span>
                <Button variant="ghost" small disabled={busy} onClick={() => void refresh()}>
                  Refresh
                </Button>
                <Button variant="ghost" small onClick={disconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                {walletAvailable ? (
                  <Button
                    variant="secondary"
                    small
                    disabled={busy}
                    onClick={() => void connect("injected")}
                  >
                    {busy ? "Connecting…" : "Connect wallet"}
                  </Button>
                ) : null}
                {/*
                  With no extension present this is the only way in, so it takes
                  the prominent style. Alongside one it stays secondary: pairing
                  a phone is the deliberate choice, not the default.
                */}
                {walletConnectAvailable ? (
                  <Button
                    variant={walletAvailable ? "ghost" : "secondary"}
                    small
                    disabled={busy}
                    onClick={() => void connect("walletconnect")}
                  >
                    {busy && !walletAvailable ? "Connecting…" : "WalletConnect"}
                  </Button>
                ) : null}
                {!walletAvailable && !walletConnectAvailable ? (
                  <Button variant="secondary" small disabled>
                    No wallet found
                  </Button>
                ) : null}
              </>
            )}
            <Button
              variant="primary"
              small
              withArrow
              onClick={() => setCreating((v) => !v)}
              disabled={!connected}
            >
              {creating ? "Close" : "New guard"}
            </Button>
          </div>
        </header>

        {creating && connected ? (
          <div className="mb-10">
            <CreateGuard onDone={() => setCreating(false)} />
          </div>
        ) : null}

        <nav className="mb-6 flex gap-1" aria-label="Views">
          {(
            [
              ["positions", "Positions"],
              ["keeper", `Settleable${triggerable.length ? ` · ${triggerable.length}` : ""}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`pxo-button pxo-button-small ${
                tab === value ? "pxo-button-secondary" : "pxo-button-ghost"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {!connected ? (
          <div className="pxo-card border-dashed p-12 text-center">
            <h2 className="text-base font-medium">
              {walletAvailable || walletConnectAvailable
                ? "Connect to view your guards"
                : "A browser wallet is required"}
            </h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
              {walletAvailable || walletConnectAvailable
                ? "Pexo is noncustodial. Connecting only reads your positions. It grants no access to your tokens."
                : "Pexo talks to the contract directly from your browser. Install a wallet that supports Robinhood Chain to continue."}
            </p>
            {!walletAvailable && walletConnectAvailable ? (
              <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
                No extension in this browser. WalletConnect pairs a wallet on
                another device instead; scan the code with it to continue.
              </p>
            ) : null}
          </div>
        ) : loadingGuards && guards.length === 0 ? (
          <div className="pxo-card border-dashed p-12 text-center">
            <h2 className="text-base font-medium">Reading the chain…</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
              Finding your guards from the contract's events, then reading each one's
              current state.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="pxo-card border-dashed p-12 text-center">
            <h2 className="text-base font-medium">
              {tab === "keeper" ? "Nothing is settleable right now" : "No guards yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">
              {tab === "keeper"
                ? "Guards appear here the moment their quote reaches the trigger their owner set."
                : `Create a guard to set a floor under a position. Minimum ${money(
                    PEXO_CONFIG.protocol.minDepositUsd,
                  )}.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((guard) => (
              <GuardCard
                key={guard.id}
                guard={guard}
                quote={quoteFor(guard.id)}
                busy={busy}
                onTrigger={(id) => void triggerGuard(id)}
                onWithdraw={(id) => void withdrawGuard(id)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
