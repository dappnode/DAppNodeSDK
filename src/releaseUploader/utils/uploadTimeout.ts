/**
 * Upload requests abort only when the connection stops moving.
 * A total limit would fail healthy large uploads on slow links
 * (a ~1.6 GB release needs over 3.6 Mbit/s to finish within an hour).
 * The idle window also covers the server hashing/pinning after the last byte.
 */
export const uploadTimeout = { socket: 15 * 60 * 1000 } as const;
