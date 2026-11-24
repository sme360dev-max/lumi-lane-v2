import type { NoticeColumn, PricingColumn } from '@/types/menu';

export function MenuColumn({ column }: { column: NoticeColumn | PricingColumn }) {
  if (column.kind === 'notice') {
    return (
      <section className="lane-menu-note">
        <h3>{column.title}</h3>
        <p>{column.text}</p>
      </section>
    );
  }
  return (
    <section className="lane-menu-pricing" aria-label="Açai size and service prices">
      {column.groups.map(({ title, rows }) => (
        <div key={title}>
          <h3>{title}</h3>
          <dl>
            {rows.map(({ label, price }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd data-price>{price}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p>{column.note}</p>
    </section>
  );
}
