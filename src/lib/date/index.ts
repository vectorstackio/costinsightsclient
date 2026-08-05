// lib/date/index.ts

export const getPreviousMonthYYYYMM = (): string => {
  const now = new Date()

  const year = now.getFullYear()
  const month = now.getMonth()

  const previousMonth =
    new Date(year, month - 1, 1)

  const previousYear =
    previousMonth.getFullYear()

  const previousMonthNumber =
    String(previousMonth.getMonth() + 1)
      .padStart(2, '0')

  return `${previousYear}-${previousMonthNumber}`
}