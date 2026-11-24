'use client';

interface QuantityStepperProps {
  quantity: number;
  label: string;
  onChange: (delta: number) => void;
}

export function QuantityStepper({ quantity, label, onChange }: QuantityStepperProps) {
  return (
    <div className="lane-stepper" role="group" aria-label={`${label} quantity`}>
      <button type="button" aria-label={`Remove one ${label}`} disabled={quantity <= 0} onClick={() => onChange(-1)}>
        <span aria-hidden="true">−</span>
      </button>
      <output aria-label={`${label} quantity`} key={quantity}>
        {quantity}
      </output>
      <button type="button" aria-label={`Add one ${label}`} disabled={quantity >= 99} onClick={() => onChange(1)}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
