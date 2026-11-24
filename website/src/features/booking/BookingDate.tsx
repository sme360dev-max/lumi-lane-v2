'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { dateKey, formatDate, parseDate, prettyDate, venueToday, type CalendarDate } from './validation';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabel = new Intl.DateTimeFormat('en-AU', { year: 'numeric', month: 'long', timeZone: 'UTC' });

export function BookingDate({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (date: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [today, setToday] = useState<CalendarDate | null>(null);
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);

  const selected = parseDate(value);
  const open = () => {
    const now = venueToday();
    const initial = selected && dateKey(selected) >= dateKey(now) ? selected : now;
    setToday(now);
    setMonth(initial);
    dialog.current?.showModal();
    window.requestAnimationFrame(() =>
      dialog.current?.querySelector<HTMLElement>('button[aria-pressed="true"], button[aria-current="date"]')?.focus(),
    );
  };
  const close = () => dialog.current?.close();

  const shiftMonth = (delta: number) => {
    if (!month) return;
    const next = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };
  const moveDay = (event: KeyboardEvent<HTMLDivElement>) => {
    const day = Number((event.target as HTMLElement).dataset.day);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!day || !step) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-day="${day + step}"]:enabled`)?.focus();
  };

  const calendarStart = month && new Date(Date.UTC(month.year, month.month - 1, 1));
  const dayCount = month ? new Date(Date.UTC(month.year, month.month, 0)).getUTCDate() : 0;
  const leading = calendarStart ? (calendarStart.getUTCDay() + 6) % 7 : 0;
  const canGoBack = today && month && month.year * 12 + month.month > today.year * 12 + today.month;

  return (
    <div>
      <label className="booking-label" htmlFor="book-date">
        Date
      </label>
      <div className="lane-date-field">
        <input
          className="booking-control"
          id="book-date"
          name="date"
          type="text"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          value={value}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'book-date-error' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" aria-label="Open calendar" aria-haspopup="dialog" onClick={open}>
          <svg
            viewBox="0 0 20 20"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <rect x="3.5" y="5" width="13" height="12" rx="1" />
            <path d="M3.5 8.5h13M7 3v4m6-4v4" />
          </svg>
        </button>
      </div>
      {error && (
        <p id="book-date-error" className="booking-error">
          {error}
        </p>
      )}

      <dialog
        ref={dialog}
        className="lane-calendar"
        aria-labelledby="calendar-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div>
          <header>
            <h2 id="calendar-title">Choose a date</h2>
            <button className="lane-filter-close" type="button" aria-label="Close calendar" onClick={close}>
              ×
            </button>
          </header>
          {month && today && calendarStart && (
            <>
              <div className="lane-calendar-month">
                <button type="button" aria-label="Previous month" disabled={!canGoBack} onClick={() => shiftMonth(-1)}>
                  ‹
                </button>
                <p aria-live="polite">{monthLabel.format(calendarStart)}</p>
                <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
                  ›
                </button>
              </div>
              <div className="lane-calendar-days" onKeyDown={moveDay}>
                {DAYS.map((day) => (
                  <span key={day} aria-hidden="true">
                    {day}
                  </span>
                ))}
                {Array.from({ length: leading }, (_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {Array.from({ length: dayCount }, (_, index) => {
                  const date = { ...month, day: index + 1 };
                  const key = dateKey(date);
                  const isToday = dateKey(today) === key;
                  const isSelected = selected !== null && dateKey(selected) === key;
                  return (
                    <button
                      key={date.day}
                      type="button"
                      data-day={date.day}
                      aria-label={prettyDate(date)}
                      aria-current={isToday ? 'date' : undefined}
                      aria-pressed={isSelected}
                      disabled={key < dateKey(today)}
                      onClick={() => {
                        onChange(formatDate(date));
                        close();
                      }}
                    >
                      {date.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
