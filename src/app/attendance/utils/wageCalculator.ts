import { WAGE_RATES } from '../constants';

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
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();
  const endMinutes = endTime.getMinutes();
  const isEndMidnight = endHour === 0 && endMinutes === 0;
  const isStartBeforeMidnight = startHour >= 22;

  // 日付を調整
  const adjustedEndTime = new Date(endTime);
  if (isEndMidnight && isStartBeforeMidnight) {
    // 24:00（翌日の0:00）の場合
    adjustedEndTime.setDate(startTime.getDate() + 1);
  } else if (endHour < startHour && !isEndMidnight) {
    // その他の日付跨ぎの場合
    adjustedEndTime.setDate(startTime.getDate() + 1);
  } else {
    // 同日の場合
    adjustedEndTime.setDate(startTime.getDate());
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
  breakEnd?: Date | null
): number => {
  let totalWage = 0;
  let currentTime = new Date(startTime);

  // 日付跨ぎを考慮して終了時刻を調整
  const adjustedEndTime = adjustEndTimeForDateCrossing(startTime, endTime);

  while (currentTime < adjustedEndTime) {
    // 次の時給レート変更時刻または勤務終了時刻のいずれか早い方
    const nextChangeTime = getNextRateChangeTime(currentTime);
    const slotEndTime = new Date(Math.min(nextChangeTime.getTime(), adjustedEndTime.getTime()));
    
    // デバッグログ
    // console.log(`計算中の時間帯: ${currentTime.toLocaleTimeString()} - ${slotEndTime.toLocaleTimeString()}`);
    
    // 休憩時間中はスキップ
    if (breakStart && breakEnd && 
        currentTime >= breakStart && 
        currentTime < breakEnd) {
      currentTime = new Date(Math.min(breakEnd.getTime(), adjustedEndTime.getTime()));
      // console.log(`休憩時間をスキップ: ${breakStart.toLocaleTimeString()} - ${breakEnd.toLocaleTimeString()}`);
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
      // console.log(`休憩時間を差し引き: ${breakTimeInSlot}時間`);
    }

    // 時給レートを決定して給与を計算
    const hourlyWage = determineHourlyWage(currentTime);
    const slotWage = workTimeInSlot * hourlyWage;
    totalWage += slotWage;
    
    // console.log(`時給レート: ¥${hourlyWage}, 労働時間: ${workTimeInSlot}時間, 給与: ¥${Math.round(slotWage)}`);

    // 次の時間帯へ
    currentTime = new Date(slotEndTime);
  }

  // console.log(`合計給与: ¥${Math.round(totalWage)}`);
  return Math.round(totalWage);
}; 