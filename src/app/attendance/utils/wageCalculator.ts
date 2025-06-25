import { WAGE_RATES } from '../constants';

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
  breakEnd?: Date | null
): number => {
  let totalWage = 0;
  let currentTime = new Date(startTime);

  while (currentTime < endTime) {
    const nextHour = new Date(currentTime);
    nextHour.setHours(nextHour.getHours() + 1); // 一時間進める
    nextHour.setMinutes(0); // 分を0にする
    nextHour.setSeconds(0); // 秒を0にする
    nextHour.setMilliseconds(0); // ミリ秒を0にする

    // 現在の時間帯の終了時刻（次の時間帯開始または勤務終了のいずれか早い方）
    const slotEndTime = new Date(Math.min(nextHour.getTime(), endTime.getTime()));
    
    // 休憩時間中はスキップ
    if (breakStart && breakEnd && 
        currentTime >= breakStart && 
        currentTime < breakEnd) {
      currentTime = new Date(Math.min(breakEnd.getTime(), endTime.getTime()));
      continue;
    }

    // 時間帯の労働時間を計算（時間単位）
    let workTimeInSlot = (slotEndTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

    // 休憩時間が時間帯の途中で始まる場合の調整
    if (breakStart && breakEnd && 
        breakStart > currentTime && 
        breakStart < slotEndTime) {
      const breakEndInSlot = new Date(Math.min(breakEnd.getTime(), slotEndTime.getTime()));
      const breakTimeInSlot = (breakEndInSlot.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
      workTimeInSlot -= breakTimeInSlot;
    }

    // 時給の決定
    let hourlyWage = WAGE_RATES.NORMAL;
    const hour = currentTime.getHours();
    
    // 日付跨ぎの場合（0時〜3時）
    if (hour >= 0 && hour < 3) {
      hourlyWage = WAGE_RATES.CROSS_DAY;
    }
    // 夜間時給（22時〜24時）
    else if (hour >= 22) {
      hourlyWage = WAGE_RATES.NIGHT;
    }

    // 該当時間帯の給与を加算
    totalWage += workTimeInSlot * hourlyWage;

    // 次の時間帯へ
    currentTime = new Date(slotEndTime);
  }

  return Math.round(totalWage);
}; 