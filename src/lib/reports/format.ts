import type { Currency } from '@/types'

export const formatCurrency = (
  value: number,
  currency: Currency
): string => {
  return new Intl.NumberFormat(
    'en-GB',
    {
      style: 'currency',
      currency
    }
  ).format(value)
}