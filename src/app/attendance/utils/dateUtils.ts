/**
 * 日付処理のユーティリティ関数
 */

/**
 * 日付フォーマットの定数
 */
export const DATE_FORMAT = {
  TIME: { hour: '2-digit', minute: '2-digit', hour12: false } as const,
  DATE: { year: 'numeric', month: '2-digit', day: '2-digit' } as const,
  LOCALE: 'ja-JP'
} as const;

/**
 * 日付を YYYY-MM-DD 形式の文字列に変換
 */
export const formatDateToISOString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * 時刻を HH:mm 形式の文字列に変換
 */
export const formatTimeString = (date: Date): string => {
  return date.toLocaleTimeString(DATE_FORMAT.LOCALE, DATE_FORMAT.TIME);
};

/**
 * 日付を YYYY年MM月DD日 形式の文字列に変換
 */
export const formatDateJP = (date: Date): string => {
  return date.toLocaleDateString(DATE_FORMAT.LOCALE, DATE_FORMAT.DATE);
};

/**
 * 指定された月の最初の日を取得
 */
export const getFirstDayOfMonth = (year: number, month: number): Date => {
  return new Date(year, month - 1, 1);
};

/**
 * 指定された月の最後の日を取得
 */
export const getLastDayOfMonth = (year: number, month: number): Date => {
  return new Date(year, month, 0);
};

/**
 * 2つの日付が同じ日かどうかを判定
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return formatDateToISOString(date1) === formatDateToISOString(date2);
};

/**
 * 日付が指定された範囲内かどうかを判定
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const targetTime = date.getTime();
  return targetTime >= startDate.getTime() && targetTime <= endDate.getTime();
}; 