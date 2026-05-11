import type { ButtonHTMLAttributes } from 'react';
import { btnPrimary, btnSecondary, btnDanger } from '../constants/styles';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({ variant = 'primary', className = '', ...props }: Props) {
  const cls = variant === 'primary' ? btnPrimary : variant === 'danger' ? btnDanger : btnSecondary;
  return <button className={`${cls} ${className}`} {...props} />;
}
