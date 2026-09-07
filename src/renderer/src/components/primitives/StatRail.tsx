export interface Stat {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

/**
 * Four figures in one recessed strip, divided by hairlines.
 *
 * These were four separate cards with four identical icons, which is what made
 * them read as interchangeable: identical containers say "these are the same
 * kind of thing" far louder than the labels say what each one is. One strip
 * groups them, and dropping the icons -- none of which carried information --
 * lets the numbers do the work.
 */
export function StatRail({ stats }: { stats: readonly Stat[] }) {
  return (
    <section className="stat-rail panel">
      {stats.map((stat) => (
        <div key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.detail}</small>
        </div>
      ))}
    </section>
  );
}
