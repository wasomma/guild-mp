/* Single source of truth for the game version, shown in the client title.
   Bump on every deploy to live, then tag the commit vX.Y.Z (see CLAUDE.md,
   "Versioning and releases"). Alpha scheme: 0.MINOR.PATCH — patch bumps for
   normal releases (0.1.1, 0.1.2, ...); minor only on an owner-declared major
   baseline change. */
export const VERSION = "0.1.24";
