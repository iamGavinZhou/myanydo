import React from 'react';

const PATHS = {
  sun: <g><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></g>,
  week: <g><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M7.5 13h3M13.5 13h3M7.5 16.5h3" /></g>,
  list: <g><path d="M4.5 6.5h2M4.5 12h2M4.5 17.5h2M9.5 6.5h10M9.5 12h10M9.5 17.5h10" /></g>,
  calendar: <g><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M8 13.5h2M14.5 13.5h2" /></g>,
  gear: <g><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2.4M12 18.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M3.5 12h2.4M18.1 12h2.4M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" /></g>,
  plus: <g><path d="M12 5v14M5 12h14" /></g>,
  tag: <g><path d="M4 12V5.5A1.5 1.5 0 0 1 5.5 4H12l8 8-8 8-8-8Z" /><circle cx="8.3" cy="8.3" r="1.3" fill="currentColor" stroke="none" /></g>,
  trash: <g><path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.8 12.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.6M10 10.5v6M14 10.5v6" /></g>,
  x: <g><path d="M6 6l12 12M18 6L6 18" /></g>,
  left: <g><path d="M14.5 5.5L8 12l6.5 6.5" /></g>,
  right: <g><path d="M9.5 5.5L16 12l-6.5 6.5" /></g>,
  refresh: <g><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></g>,
  clock: <g><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  check: <g><path d="M5 12.5l4.5 4.5L19 7.5" /></g>,
  sub: <g><path d="M4 7h7M4 12h7M4 17h7M15 7v10M10.5 12H15" /></g>,
  note: <g><path d="M6 3.5h9L19.5 8v12.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" /><path d="M14.5 3.5V8h5M8.5 12.5h7M8.5 16h4.5" /></g>,
  folder: <g><path d="M3.5 6.8A1.3 1.3 0 0 1 4.8 5.5h4.4l2 2.3h8a1.3 1.3 0 0 1 1.3 1.3v8.6a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3Z" /></g>,
  user: <g><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20c.9-3.7 3.8-5.7 7.2-5.7s6.3 2 7.2 5.7" /></g>,
  sun2: <g><circle cx="12" cy="12" r="5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></g>,
  moon: <g><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5Z" /></g>
};

export default function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] || null}
    </svg>
  );
}
