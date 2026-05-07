export function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="status-page">
      <div className="brand-strip">
        <div className="brand-mark">
          <span className="brand-leaf" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z" />
            </svg>
          </span>
          <span className="brand-name">Bay Branch Farm</span>
        </div>
      </div>
      <div className="status-shell">{children}</div>
      <footer className="status-foot">
        <div>Bay Branch Farm · 3612 W 114th St, Cleveland</div>
      </footer>
    </div>
  );
}
