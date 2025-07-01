/**
 * 日付処理のユーティリティ関数
 */

/**
 * 日付フォーマットの定数
 */
export const DATE_FORMAT = {
  TIME: { hour: "2-digit", minute: "2-digit", hour12: false } as const,
  DATE: { year: "numeric", month: "2-digit", day: "2-digit" } as const,
  LOCALE: "ja-JP",
} as const;

/**
 * 曜日の定数
 */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 日付を YYYY-MM-DD 形式の文字列に変換
 */
export const formatDateToISOString = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

/**
 * 時刻を HH:mm 形式の文字列に変換
 * @param date - 変換する日付オブジェクト
 * @returns HH:mm形式の時刻文字列、不正な日付の場合は '--:--' を返す
 */
export const formatTimeString = (date: Date): string => {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "--:--";
    }
    return date.toLocaleTimeString(DATE_FORMAT.LOCALE, DATE_FORMAT.TIME);
  } catch (e) {
    console.error("時刻フォーマットエラー:", e);
    return "--:--";
  }
};

/**
 * 日付を YYYY年MM月DD日 形式の文字列に変換
 */
export const formatDateJP = (date: Date): string => {
  return date.toLocaleDateString(DATE_FORMAT.LOCALE, DATE_FORMAT.DATE);
};

/**
 * 日付を MM/DD（曜） 形式の文字列に変換
 * 例: 01/15（月）
 */
export const formatDateWithWeekday = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}/${day}（${weekday}）`;
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
export const isDateInRange = (
  date: Date,
  startDate: Date,
  endDate: Date,
): boolean => {
  const targetTime = date.getTime();
  return targetTime >= startDate.getTime() && targetTime <= endDate.getTime();
};
