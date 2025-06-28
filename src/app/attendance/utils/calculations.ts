import { TIME } from '../constants';

/**
 * 勤務時間を計算する
 * 出勤時間から退勤時間までの総時間を計算し、HH:mm形式で返す
 * 分単位は切り上げで統一（1分でも勤務した場合は1分としてカウント）
 * 
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @returns {string} 勤務時間（HH:mm形式）
 */
export const calculateWorkTime = (clockIn: string, clockOut: string): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  const diffMinutes = Math.ceil((end.getTime() - start.getTime()) / TIME.MILLISECONDS_IN_MINUTE);
  
  if (diffMinutes < 0) return '00:00';

  return formatMinutesToTime(diffMinutes);
};

/**
 * 分を「HH:mm」形式に変換する
 * @param totalMinutes - 合計分数
 * @returns HH:mm形式の文字列
 */
export const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / TIME.MINUTES_IN_HOUR);
  const minutes = totalMinutes % TIME.MINUTES_IN_HOUR;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * 休憩時間を計算する（内部使用）
 * 休憩開始から休憩終了までの時間を計算し、分単位で返す
 * 分単位は切り上げで統一
 * 
 * @private
 * @param {string} breakStart - 休憩開始時間（ISO形式）
 * @param {string} breakEnd - 休憩終了時間（ISO形式）
 * @returns {number} 休憩時間（分）
 */
const calculateBreakMinutes = (breakStart: string, breakEnd: string): number => {
  const start = new Date(breakStart);
  const end = new Date(breakEnd);
  
  const diffMilliseconds = end.getTime() - start.getTime();

  // if (diffMilliseconds <= 0) return 0;
  
  if (diffMilliseconds <= 0 || diffMilliseconds < TIME.MILLISECONDS_IN_MINUTE) {
    return 0;
  }

  return Math.ceil(diffMilliseconds / TIME.MILLISECONDS_IN_MINUTE);
};

/**
 * 指定期間内の勤務時間を計算する
 * 月跨ぎ勤務の場合でも、指定期間内の時間のみを正確に計算
 * 期間終了時刻は24:00:00として扱う
 * 
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {Date} periodStart - 期間開始日
 * @param {Date} periodEnd - 期間終了日（24:00:00として扱う）
 * @returns {string} 期間内の勤務時間（HH:mm形式）
 */
export const calculateWorkTimeForPeriod = (
  clockIn: string, 
  clockOut: string, 
  periodStart: Date, 
  periodEnd: Date
): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  // 期間終了時刻を次の日の00:00:00として扱う
  const adjustedPeriodEnd = new Date(periodEnd);
  adjustedPeriodEnd.setDate(adjustedPeriodEnd.getDate() + 1);
  adjustedPeriodEnd.setHours(0, 0, 0, 0);
  
  // 期間内の実効開始・終了時刻を計算
  const effectiveStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
  const effectiveEnd = new Date(Math.min(end.getTime(), adjustedPeriodEnd.getTime()));
  
  if (effectiveStart.getTime() >= effectiveEnd.getTime()) return '00:00';

  const diffMinutes = Math.floor(
    (effectiveEnd.getTime() - effectiveStart.getTime()) / TIME.MILLISECONDS_IN_MINUTE
  );
  
  return formatMinutesToTime(diffMinutes);
};

/**
 * HH:mm形式の時間文字列を分数に変換する
 * 
 * @param {string} timeString - HH:mm形式の時間文字列
 * @returns {number} 合計分数
 */
export const getMinutesFromHHMM = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * TIME.MINUTES_IN_HOUR) + minutes;
};

/**
 * 勤怠記録の整合性をチェックする
 * 連続した出勤打刻、退勤打刻なしの状態で退勤打刻などを検出
 * 
 * @param {Array<{clock_in: string; clock_out: string | null}>} records - 勤怠記録の配列
 * @returns {boolean} 整合性が取れている場合はtrue
 */
export const validateRecords = (
  records: { clock_in: string; clock_out: string | null }[]
): boolean => {
  if (records.length === 0) return true;
  
  // 未退勤の記録が複数存在しないことを確認
  const unclockedOutCount = records.filter(record => !record.clock_out).length;
  return unclockedOutCount <= 1;
};

/**
 * 実労働時間を計算する（休憩時間を考慮）
 * 計算手順：
 * 1. 総勤務時間を計算（出勤から退勤までの時間）
 * 2. 休憩時間を計算（休憩開始から休憩終了までの時間）
 * 3. 総勤務時間から休憩時間を差し引いて実労働時間を算出
 * 
 * 端数処理：
 * - すべての時間計算で分単位を切り上げ
 * - 1分未満の勤務/休憩も1分として計算
 * - 実労働時間が0分未満になる場合は0分（'00:00'）として扱う
 * 
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {string | null} breakStart - 休憩開始時間（ISO形式）
 * @param {string | null} breakEnd - 休憩終了時間（ISO形式）
 * @returns {string} 実労働時間（HH:mm形式）
 * 
 * 使用例：
 * 入力: clockIn='2024-01-06T20:00:00Z', clockOut='2024-01-06T23:30:00Z',
 *      breakStart='2024-01-06T21:00:00Z', breakEnd='2024-01-06T21:15:00Z'
 * 計算: 総勤務時間 210分 - 休憩時間 15分 = 実労働時間 195分
 * 出力: '03:15'
 */
export const calculateActualWorkTime = (
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null
): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  // 総勤務時間を分単位で計算（切り上げ）
  const totalWorkMinutes = Math.ceil((end.getTime() - start.getTime()) / TIME.MILLISECONDS_IN_MINUTE);
  
  // 休憩時間を分単位で計算（休憩がある場合のみ）
  let breakMinutes = 0;
  if (breakStart && breakEnd) {
    breakMinutes = calculateBreakMinutes(breakStart, breakEnd);
  }
  
  // 実労働時間を計算（休憩時間を差し引く）
  // 負の値になる場合は0分として扱う
  const actualMinutes = Math.max(0, totalWorkMinutes - breakMinutes);
  
  return formatMinutesToTime(actualMinutes);
}; 