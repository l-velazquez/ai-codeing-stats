/** Six rounded arms, shared by the app, Dock, and menu-bar identity. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 5v22M6.474 10.5l19.052 11M6.474 21.5l19.052-11"
        stroke="currentColor" strokeWidth="4.8" strokeLinecap="round" />
    </svg>
  );
}
