import { Beef } from 'lucide-react';
import type { SpeciesCount } from './types';
import styles from './GISSidebar.module.css';

const colors = ['#d6bc68', '#aabb84', '#80b8aa', '#c59572', '#ada3c8', '#8eb5cf'];

export function GISPopulationDistribution({ items }: { items: SpeciesCount[] }) {
  const species = [...items].sort((a, b) => b.heads - a.heads);
  const total = species.reduce((sum, item) => sum + item.heads, 0);

  return (
    <section className={styles.distribution} aria-label="Livestock distribution">
      <div className={styles.distributionHeading}>
        <span className="flex items-center gap-2"><Beef className="size-4" /> Livestock distribution</span>
        <span>{total.toLocaleString()} heads</span>
      </div>
      {total > 0 ? species.map((item, index) => (
        <div key={item.species} className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span>{item.species}</span>
            <span className="tabular-nums">{item.heads.toLocaleString()} <span className={styles.muted}>heads</span></span>
          </div>
          <div
            className={styles.segmentTrack}
            role="progressbar"
            aria-label={`${item.species} share of recorded livestock`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={item.heads}
            aria-valuetext={`${item.heads.toLocaleString()} of ${total.toLocaleString()} heads`}
          >
            <div style={{ width: `${(item.heads / total) * 100}%`, backgroundColor: colors[index % colors.length] }} />
          </div>
        </div>
      )) : <p className="mt-3 text-xs">No approved livestock counts available for this scope.</p>}
    </section>
  );
}
