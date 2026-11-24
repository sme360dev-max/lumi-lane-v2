import type { ChangeEvent, InputHTMLAttributes } from 'react';

const control = 'booking-control';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  optional?: boolean;
  multiline?: boolean;
  className?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  placeholder?: string;
}

/** Labelled form field with an associated inline validation message. */
export function BookingField({
  id,
  label,
  value,
  error,
  onChange,
  optional,
  multiline,
  className = '',
  inputProps,
  placeholder,
}: FieldProps) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    name: id.replace('book-', ''),
    value,
    placeholder,
    required: !optional,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="booking-label">
        {label}
        {optional && <span> (optional)</span>}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} className={control} />
      ) : (
        <input {...shared} {...inputProps} className={control} />
      )}
      {error && (
        <p id={errorId} className="booking-error">
          {error}
        </p>
      )}
    </div>
  );
}
