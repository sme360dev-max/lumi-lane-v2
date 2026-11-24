'use client';

import { useRef, useState, type FormEvent } from 'react';
import { BUSINESS } from '@/data/business';
import { BOOK, VISIT } from '@/data/content';
import { CtaLink, ctaClass } from '@/components/ui/Button';
import { Parallax } from '@/components/motion/Parallax';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { API_BASE_URL, createRequestKey, readAuthToken } from '@/lib/api';
import { BookingDate } from './BookingDate';
import { BookingField } from './BookingField';
import {
  EMPTY_BOOKING,
  FIELD_ORDER,
  formatDate,
  formatTime,
  parseDate,
  parseTime,
  prettyDate,
  validateBooking,
  type BookingErrors,
  type BookingField as Field,
  type BookingValues,
} from './validation';

const INITIAL = { ...EMPTY_BOOKING, guests: '2' };

export function BookingForm() {
  const [values, setValues] = useState<BookingValues>(INITIAL);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const requestKey = useRef(createRequestKey());

  const set = (field: Field) => (value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };
  const focusField = (field: Field) => document.getElementById(`book-${field}`)?.focus();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateBooking(values);
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      focusField(first);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const parsedDate = parseDate(values.date)!;
      const parsedTime = parseTime(values.time)!;
      const booking = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        guests: values.guests.trim(),
        date: `${parsedDate.year}-${String(parsedDate.month).padStart(2, '0')}-${String(parsedDate.day).padStart(2, '0')}`,
        time: `${String(parsedTime.hours).padStart(2, '0')}:${String(parsedTime.minutes).padStart(2, '0')}`,
        notes: values.notes.trim(),
      };
      const response = await fetch(`${API_BASE_URL}/api/bookings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
        },
        body: JSON.stringify({ requestId: requestKey.current.for(JSON.stringify(booking)), ...booking }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.errors && typeof result.errors === 'object') setErrors(result.errors as BookingErrors);
        throw new Error(result.error || 'We could not send your request. Please try again or call the venue.');
      }
      requestKey.current.reset();
      setChecked(true);
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not send your request. Please try again or call the venue.');
    } finally {
      setSubmitting(false);
    }
  };

  const edit = () => {
    setChecked(false);
    window.requestAnimationFrame(() => focusField('name'));
  };
  const reset = () => {
    setValues(INITIAL);
    setErrors({});
    edit();
  };

  const date = parseDate(values.date);
  const time = parseTime(values.time);

  if (checked) {
    const rows = [
      ['Name', values.name.trim()],
      ['Guests', values.guests.trim()],
      ['When', `${date ? prettyDate(date) : values.date}, ${time ? formatTime(time) : values.time} (Adelaide time)`],
      ['Contact', `${values.email.trim()} · ${values.phone.trim()}`],
    ];
    if (values.notes.trim()) rows.push(['Requests', values.notes.trim()]);

    return (
      <div className="lane-page lane-book">
        <div className="site-container lane-book-summary" data-testid="booking-summary">
          <p className="lane-kicker">Your table details</p>
          <h1 ref={summaryRef} tabIndex={-1} className="lane-title">
            Request <em>received.</em>
          </h1>
          <p role="status">
            Your table request has been sent. The team will contact you to confirm your reservation.
          </p>
          <dl>
            {rows.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="lane-book-actions">
            <a href={BUSINESS.phone.href} className={ctaClass({ compact: true })}>
              Call {BUSINESS.phone.display}
            </a>
            <button type="button" onClick={edit} className={ctaClass({ variant: 'editorial' })}>
              Edit details
            </button>
            <button type="button" onClick={reset} className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })}>
              Start over
            </button>
            <CtaLink href="/menu/" compact variant="editorial">
              See the menu
            </CtaLink>
          </div>
          <p className="lane-book-phone-note">Listed phone number. Confirm directly with Lumi Lane.</p>
        </div>
      </div>
    );
  }

  const guestCount = Number(values.guests);
  const validGuestCount = Number.isSafeInteger(guestCount) && guestCount >= 1;
  const adjustGuests = (delta: number) => {
    const next = validGuestCount ? guestCount + delta : 1;
    if (Number.isSafeInteger(next)) set('guests')(String(Math.max(1, next)));
  };

  return (
    <div className="lane-page lane-book">
      <div className="site-container lane-book-layout">
        <header className="lane-book-intro">
          <div className="lane-book-heading">
            <p className="lane-kicker">{BOOK.eyebrow} · Lightsview</p>
            <h1 className="lane-title">
              <span className="title-line">
                <span>Reserve Your</span>
              </span>{' '}
              <span className="title-line">
                <em>Table.</em>
              </span>
            </h1>
          </div>
          <div className="lane-book-lede">
            <p>{BOOK.intro}</p>
            <p id="booking-note" className="lane-book-note">
              Send a table request. The venue team will contact you to confirm.
            </p>
            <p className="lane-book-call">
              <a href={BUSINESS.phone.href} className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })}>
                Call {BUSINESS.phone.display}
              </a>
              <span className="lane-book-phone-note">Listed phone number. Confirm directly with Lumi Lane.</span>
            </p>
          </div>
        </header>
        <form
          noValidate
          onSubmit={onSubmit}
          aria-label="Table request"
          aria-describedby="booking-note"
          className="lane-book-form"
        >
          <fieldset>
            <legend>Your visit</legend>
            <div className="lane-book-visit">
              <div className="lane-guest-field">
                <label htmlFor="book-guests" className="booking-label">
                  Guests
                </label>
                <div className="lane-stepper lane-guest-stepper">
                  <button
                    type="button"
                    aria-label="Remove one guest"
                    disabled={!validGuestCount || guestCount <= 1}
                    onClick={() => adjustGuests(-1)}
                  >
                    −
                  </button>
                  <input
                    id="book-guests"
                    name="guests"
                    type="text"
                    inputMode="numeric"
                    required
                    value={values.guests}
                    aria-invalid={errors.guests ? true : undefined}
                    aria-describedby={errors.guests ? 'book-guests-error' : undefined}
                    onChange={(event) => set('guests')(event.target.value)}
                  />
                  <button type="button" aria-label="Add one guest" onClick={() => adjustGuests(1)}>
                    +
                  </button>
                </div>
                {errors.guests && (
                  <p id="book-guests-error" className="booking-error">
                    {errors.guests}
                  </p>
                )}
              </div>
              <BookingDate value={values.date} error={errors.date} onChange={set('date')} />
              <BookingField
                id="book-time"
                label="Preferred time"
                value={values.time}
                error={errors.time}
                onChange={set('time')}
                inputProps={{ type: 'time' }}
              />
            </div>
            <p className="lane-book-hint">
              {date ? `${formatDate(date)} · ` : ''}Adelaide time. Your selection indicates a preference only.
            </p>
          </fieldset>
          <fieldset>
            <legend>Your details</legend>
            <div className="lane-book-fields">
              <BookingField
                id="book-name"
                label="Full name"
                className="lane-form-full"
                value={values.name}
                error={errors.name}
                onChange={set('name')}
                placeholder="Full name"
                inputProps={{ type: 'text', autoComplete: 'name' }}
              />
              <BookingField
                id="book-email"
                label="Email"
                value={values.email}
                error={errors.email}
                onChange={set('email')}
                placeholder="you@example.com"
                inputProps={{ type: 'email', autoComplete: 'email', inputMode: 'email' }}
              />
              <BookingField
                id="book-phone"
                label="Phone"
                value={values.phone}
                error={errors.phone}
                onChange={set('phone')}
                placeholder="0400 000 000"
                inputProps={{ type: 'tel', autoComplete: 'tel', inputMode: 'tel' }}
              />
              <BookingField
                id="book-notes"
                label="Special Requests"
                optional
                multiline
                className="lane-form-full"
                value={values.notes}
                onChange={set('notes')}
                placeholder="Dietary requirements, accessibility or a special occasion"
              />
            </div>
          </fieldset>
          <div className="lane-book-actions">
            <button type="submit" className={ctaClass()}>
              {submitting ? 'Sending request…' : 'Send table request'}
            </button>
            {submitError && <p role="alert" className="booking-error">{submitError}</p>}
          </div>
        </form>
        <figure className="lane-book-photo">
          <Parallax className="arch-frame" travel={40}>
            <ResponsivePicture
              name="storefront"
              widths={[480, 800, 1200]}
              sizes="(min-width: 961px) 34vw, 89vw"
              width={1360}
              height={972}
              alt={VISIT.storefrontAlt}
            />
          </Parallax>
          <figcaption>Fosters Road, Lightsview</figcaption>
        </figure>
      </div>
    </div>
  );
}
