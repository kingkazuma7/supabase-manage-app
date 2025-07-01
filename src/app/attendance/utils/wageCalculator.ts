import { WAGE_RATES } from "../constants";
import { TIME } from "../constants";

/**
 * 時給レートを決定する
 * @param time 対象時刻
 * @returns 適用される時給レート
 */
const determineHourlyWage = (time: Date): number => {
  const hour = time.getHours();

  switch (true) {
    // 深夜時給（0:00-3:00）
    case hour >= 0 && hour < 3:
      return WAGE_RATES.CROSS_DAY;
    // 夜間時給（22:00-24:00）
    case hour >= 22:
      return WAGE_RATES.NIGHT;
    // 通常時給（その他の時間帯）
    default:
      return WAGE_RATES.NORMAL;
  }
};

/**
 * 次の時給レート変更時刻を取得する
 * @param currentTime 現在時刻
 * @returns 次の時給レート変更時刻
 */
const getNextRateChangeTime = (currentTime: Date): Date => {
  const hour = currentTime.getHours();
  const nextTime = new Date(currentTime);

  switch (true) {
    // 22:00前の場合、次は22:00
    case hour < 22:
      nextTime.setHours(22, 0, 0, 0);
      break;
    // 22:00-23:59の場合、次は0:00（翌日）
    case hour >= 22:
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(0, 0, 0, 0);
      break;
    // 0:00-2:59の場合、次は3:00
    case hour >= 0 && hour < 3:
      nextTime.setHours(3, 0, 0, 0);
      break;
    default:
      // 次の時間の開始時刻
      nextTime.setHours(hour + 1, 0, 0, 0);
  }
  return nextTime;
};

/**
 * 日付跨ぎを考慮して終了時刻を調整する
 * @param startTime 開始時刻
 * @param endTime 終了時刻
 * @returns 調整された終了時刻
 */
const adjustEndTimeForDateCrossing = (startTime: Date, endTime: Date): Date => {
  // 終了時刻が開始時刻以前（＝日付が跨っている）場合のみ、1日加算
  const adjustedEndTime = new Date(endTime);

  if (adjustedEndTime.getTime() <= startTime.getTime()) {
    adjustedEndTime.setDate(adjustedEndTime.getDate() + 1);
  }

  return adjustedEndTime;
};

/**
 * 指定された時間帯の給与を計算する
 * @param startTime 開始時間
 * @param endTime 終了時間
 * @param breakStart 休憩開始時間（オプション）
 * @param breakEnd 休憩終了時間（オプション）
 * @returns 計算された給与（円）
 */
export const calculateWageForTimeRange = (
  startTime: Date,
  endTime: Date,
  breakStart?: Date | null,
  breakEnd?: Date | null,
): number => {
  let totalWage = 0;
  let currentTime = new Date(startTime);

  // 日付跨ぎを考慮して終了時刻を調整
  const adjustedEndTime = adjustEndTimeForDateCrossing(startTime, endTime);

  // 休憩時間も日付跨ぎを考慮して調整
  let adjustedBreakStart: Date | undefined;
  let adjustedBreakEnd: Date | undefined;

  if (breakStart && breakEnd) {
    adjustedBreakStart = new Date(breakStart);
    adjustedBreakEnd = adjustEndTimeForDateCrossing(breakStart, breakEnd);

    // 休憩開始時刻を勤務開始日に合わせる
    adjustedBreakStart.setDate(startTime.getDate());
    if (adjustedBreakStart.getHours() < startTime.getHours()) {
      adjustedBreakStart.setDate(startTime.getDate() + 1);
    }
  }

  while (currentTime < adjustedEndTime) {
    // 次の時給レート変更時刻または勤務終了時刻のいずれか早い方
    const nextChangeTime = getNextRateChangeTime(currentTime);
    const slotEndTime = new Date(
      Math.min(nextChangeTime.getTime(), adjustedEndTime.getTime()),
    );

    // 時間帯の労働時間を計算（時間単位）
    let workTimeInSlot =
      (slotEndTime.getTime() - currentTime.getTime()) /
      (TIME.MILLISECONDS_IN_MINUTE * TIME.MINUTES_IN_HOUR);

    if (workTimeInSlot < 1 / TIME.MINUTES_IN_HOUR) {
      workTimeInSlot =
        Math.floor(
          (slotEndTime.getTime() - currentTime.getTime()) /
            TIME.MILLISECONDS_IN_MINUTE,
        ) / TIME.MINUTES_IN_HOUR;
    }

    // 休憩時間の処理
    if (adjustedBreakStart && adjustedBreakEnd) {
      // 休憩時間と現在の時間帯が重なっているかチェック
      const breakOverlap = !(
        adjustedBreakEnd.getTime() <= currentTime.getTime() ||
        adjustedBreakStart.getTime() >= slotEndTime.getTime()
      );

      if (breakOverlap) {
        // 重なっている時間を計算
        const overlapStart = new Date(
          Math.max(currentTime.getTime(), adjustedBreakStart.getTime()),
        );
        const overlapEnd = new Date(
          Math.min(slotEndTime.getTime(), adjustedBreakEnd.getTime()),
        );
        const breakTimeInSlot =
          (overlapEnd.getTime() - overlapStart.getTime()) /
          (TIME.MILLISECONDS_IN_MINUTE * TIME.MINUTES_IN_HOUR);
        workTimeInSlot -= breakTimeInSlot;
      }
    }

    // 時給レートを決定して給与を計算
    const hourlyWage = determineHourlyWage(currentTime);
    const slotWage = workTimeInSlot * hourlyWage;
    totalWage += slotWage;

    // 次の時間帯へ
    currentTime = new Date(slotEndTime);
  }

  let finalWage = Math.round(totalWage);

  // 給与がマイナスになってしまった場合は0円にする
  if (finalWage < 0) {
    finalWage = 0;
  }

  return finalWage;
};
