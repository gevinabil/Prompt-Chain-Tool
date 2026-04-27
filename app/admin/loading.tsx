export default function AdminLoading() {
  return (
    <section className="surface-grid" aria-hidden="true">
      <section className="card page-hero loading-card">
        <div className="stack-tight page-hero-copy">
          <div className="loading-line loading-line-short" />
          <div className="loading-line loading-line-wide" />
          <div className="loading-line loading-line-medium" />
        </div>
        <div className="page-hero-tags">
          <div className="loading-chip" />
          <div className="loading-chip" />
        </div>
      </section>

      <section className="card loading-card">
        <div className="loading-line loading-line-wide" />
        <div className="loading-line loading-line-medium" />
        <div className="loading-grid">
          <div className="loading-line loading-line-panel" />
          <div className="loading-line loading-line-panel" />
        </div>
      </section>
    </section>
  );
}
