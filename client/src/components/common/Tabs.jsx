/**
 * Controlled segmented tabs used by My Courses and the course details page.
 * Implements the WAI-ARIA tab pattern including arrow-key navigation.
 */
export default function Tabs({ tabs, value, onChange, className = '' }) {
  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    if (index < 0) return;

    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;

    if (next !== null) {
      event.preventDefault();
      onChange(tabs[next].value);
    }
  };

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`inline-flex flex-wrap items-center gap-1 rounded-xl bg-ink-100/70 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              isActive
                ? 'bg-white text-ink-900 shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'bg-ink-200/70 text-ink-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
