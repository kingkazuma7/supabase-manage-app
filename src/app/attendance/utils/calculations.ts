/**
 * 勤務時間を計算する
 * 出勤時間から退勤時間までの総時間を計算し、HH:mm形式で返す
 * 
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @returns {string} 勤務時間（HH:mm形式）
 */
export const calculateWorkTime = (clockIn: string, clockOut: string): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  
  if (diffMinutes < 0) {
    return '00:00';
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 指定期間内の勤務時間を計算する
 * 月跨ぎ勤務の場合でも、指定期間内の時間のみを正確に計算
 * 
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {Date} periodStart - 期間開始日
 * @param {Date} periodEnd - 期間終了日
 * @returns {string} 期間内の勤務時間（HH:mm形式）
 */
export const calculateWorkTimeForPeriod = (clockIn: string, clockOut: string, periodStart: Date, periodEnd: Date): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  const effectiveStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
  const effectiveEnd = new Date(Math.min(end.getTime(), periodEnd.getTime()));
  
  if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
      return '00:00';
  }

  const diffMinutes = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * HH:mm形式の時間文字列を分数に変換する
 * 
 * @param {string} timeString - HH:mm形式の時間文字列
 * @returns {number} 合計分数
 */
export const getMinutesFromHHMM = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 勤怠記録の整合性をチェックする
 * 連続した出勤打刻、退勤打刻なしの状態で退勤打刻などを検出
 * 
 * @param {Array<{clock_in: string; clock_out: string | null}>} records - 勤怠記録の配列
 * @returns {boolean} 整合性が取れている場合はtrue
 */
export const validateRecords = (records: { clock_in: string; clock_out: string | null }[]) => {
  if (records.length === 0) return true;
  
  let hasUnclockedOut = false;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record.clock_out) {
      if (hasUnclockedOut) {
        return false;
      }
      hasUnclockedOut = true;
    }
  }
  return true;
}; 