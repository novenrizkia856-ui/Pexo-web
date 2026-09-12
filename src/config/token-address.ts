/**
 * ============================================================================
 *  THE PEXO TOKEN ADDRESS. THIS LINE IS THE WHOLE LAUNCH CHANGE.
 * ============================================================================
 *
 * Set it to the deployed address and the site publishes it everywhere at once.
 * Leave it `null` and the site says "Coming soon" instead. Nothing else has to
 * be touched, which is the point: at launch the address goes live in one edit,
 * one commit, one deploy.
 *
 *     export const PEXO_TOKEN_ADDRESS = "0x1234...cdef";
 *
 * Paste it from the explorer, in the mixed case form it shows. That casing is
 * EIP-55, a checksum over the address itself, and copying it verbatim is what
 * lets anyone else detect a typo. `src/config/pexo.config.ts` rejects anything
 * that is not exactly `0x` followed by 40 hex characters, so a truncated or
 * whitespace padded paste keeps the site on "Coming soon" rather than
 * publishing an address that takes someone's money to a dead contract.
 *
 * It is deliberately its own file. Nothing else lives here, so there is no
 * scrolling, no neighbouring value to fat finger, and the diff at launch is a
 * single line.
 */
export const PEXO_TOKEN_ADDRESS: string | null = null;
