import { createClient } from "../utils/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * テストデータのパターン定義
 */
export type TestPattern = {
  name: string;
  description: string;
  generate: () => Array<{
    clock_in: string;
    clock_out: string | null;
    break_start?: string | null;
    break_end?: string | null;
    expected_wage: number;
  }>;
};

/**
 * 通常勤務パターン（9:00-18:00）
 */
const normalPattern: TestPattern = {
  name: "通常勤務",
  description: "9:00-18:00（9時間）",
  generate: () => {
    const today = new Date();
    return [
      {
        clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
        clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
        expected_wage: 9 * 1500, // 9時間 × 1500円
      },
    ];
  },
};

/**
 * 休憩時間付き通常勤務パターン（9:00-18:00、休憩12:00-13:00）
 */
const normalWithBreakPattern: TestPattern = {
  name: "休憩付き通常勤務",
  description: "9:00-18:00（9時間）、休憩12:00-13:00（実働8時間）",
  generate: () => {
    const today = new Date();
    return [
      {
        clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
        clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
        break_start: new Date(today.setHours(12, 0, 0)).toISOString(),
        break_end: new Date(today.setHours(13, 0, 0)).toISOString(),
        expected_wage: 8 * 1500, // 実働8時間 × 1500円
      },
    ];
  },
};

/**
 * 複数休憩付き勤務パターン（9:00-18:00、休憩2回）
 */
const multipleBreaksPattern: TestPattern = {
  name: "複数休憩付き勤務",
  description:
    "9:00-18:00（9時間）、休憩10:30-10:45、15:00-15:15（実働8.5時間）",
  generate: () => {
    const today = new Date();
    return [
      {
        clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
        clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
        break_start: new Date(today.setHours(10, 30, 0)).toISOString(),
        break_end: new Date(today.setHours(15, 15, 0)).toISOString(), // 2回の休憩を1つの期間で表現
        expected_wage: Math.round(8.5 * 1500), // 実働8.5時間 × 1500円
      },
    ];
  },
};

/**
 * 夜勤休憩付きパターン（20:00-23:30、休憩21:30-21:45）
 */
const nightWithBreakPattern: TestPattern = {
  name: "夜勤休憩付き",
  description: "20:00-23:30（3.5時間）、休憩21:30-21:45（実働3.25時間）",
  generate: () => {
    const today = new Date();
    return [
      {
        clock_in: new Date(today.setHours(20, 0, 0)).toISOString(),
        clock_out: new Date(today.setHours(23, 30, 0)).toISOString(),
        break_start: new Date(today.setHours(21, 30, 0)).toISOString(),
        break_end: new Date(today.setHours(21, 45, 0)).toISOString(),
        expected_wage: Math.round(3.25 * 1500), // 実働3.25時間 × 1500円（簡略化）
      },
    ];
  },
};

/**
 * 日付跨ぎ休憩付きパターン（21:00-翌日2:30、休憩23:00-23:30）
 */
const crossDayWithBreakPattern: TestPattern = {
  name: "日付跨ぎ休憩付き",
  description: "21:00-翌日2:30（5.5時間）、休憩23:00-23:30（実働5時間）",
  generate: () => {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);

    return [
      {
        clock_in: new Date(today.setHours(21, 0, 0)).toISOString(),
        clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
        break_start: new Date(today.setHours(23, 0, 0)).toISOString(),
        break_end: new Date(today.setHours(23, 30, 0)).toISOString(),
        expected_wage: Math.round(5 * 1500), // 実働5時間 × 1500円（簡略化）
      },
    ];
  },
};

/**
 * 夜勤パターン（20:00-23:30）
 */
const nightPattern: TestPattern = {
  name: "夜勤",
  description: "20:00-23:30（3.5時間）、休憩21:30-21:45（実働3.25時間）",
  generate: () => {
    const today = new Date();
    return [
      {
        clock_in: new Date(today.setHours(20, 0, 0)).toISOString(),
        clock_out: new Date(today.setHours(23, 30, 0)).toISOString(),
        break_start: new Date(today.setHours(21, 30, 0)).toISOString(),
        break_end: new Date(today.setHours(21, 45, 0)).toISOString(),
        expected_wage: Math.round(3.25 * 1500), // 実働3.25時間 × 1500円（簡略化）
      },
    ];
  },
};

/**
 * 日付跨ぎパターン（21:00-翌日2:30）
 */
const crossDayPattern: TestPattern = {
  name: "日付跨ぎ",
  description: "21:00-翌日2:30（5.5時間）、休憩23:00-23:30（実働5時間）",
  generate: () => {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);

    return [
      {
        clock_in: new Date(today.setHours(21, 0, 0)).toISOString(),
        clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
        break_start: new Date(today.setHours(23, 0, 0)).toISOString(),
        break_end: new Date(today.setHours(23, 30, 0)).toISOString(),
        expected_wage: Math.round(5 * 1500), // 実働5時間 × 1500円（簡略化）
      },
    ];
  },
};

/**
 * 複数日パターン（3日分）
 */
const multiDayPattern: TestPattern = {
  name: "複数日",
  description: "3日分の勤務パターン（全て休憩付き、過去3日分）",
  generate: () => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今日の0時を基準にする

    // 3日前から1日前までのデータを生成
    for (let i = 3; i > 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i); // i日前の日付

      switch (i) {
        case 3: // 3日前：通常勤務
          data.push({
            clock_in: new Date(targetDate.setHours(9, 0, 0)).toISOString(),
            clock_out: new Date(targetDate.setHours(18, 0, 0)).toISOString(),
            break_start: new Date(targetDate.setHours(12, 0, 0)).toISOString(),
            break_end: new Date(targetDate.setHours(13, 0, 0)).toISOString(),
            expected_wage: 8 * 1500, // 実働8時間
          });
          break;

        case 2: // 2日前：夜勤
          data.push({
            clock_in: new Date(targetDate.setHours(20, 0, 0)).toISOString(),
            clock_out: new Date(targetDate.setHours(23, 30, 0)).toISOString(),
            break_start: new Date(targetDate.setHours(21, 30, 0)).toISOString(),
            break_end: new Date(targetDate.setHours(21, 45, 0)).toISOString(),
            expected_wage: Math.round(3.25 * 1500), // 実働3.25時間
          });
          break;

        case 1: // 1日前：日付跨ぎ
          const nextDate = new Date(targetDate);
          nextDate.setDate(targetDate.getDate() + 1);

          // 日付跨ぎの場合でも、終了時刻が今日を超えないようにする
          if (nextDate < today) {
            data.push({
              clock_in: new Date(targetDate.setHours(21, 0, 0)).toISOString(),
              clock_out: new Date(nextDate.setHours(2, 30, 0)).toISOString(),
              break_start: new Date(
                targetDate.setHours(23, 0, 0),
              ).toISOString(),
              break_end: new Date(targetDate.setHours(23, 30, 0)).toISOString(),
              expected_wage: Math.round(5 * 1500), // 実働5時間
            });
          }
          break;
      }
    }

    return data;
  },
};

/**
 * 月跨ぎパターン（月末21:00-翌月2:30）
 */
const crossMonthPattern: TestPattern = {
  name: "月跨ぎ",
  description: "月末21:00-翌月2:30（5.5時間）、休憩23:00-23:30（実働5時間）",
  generate: () => {
    const today = new Date();
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    const firstDayOfNextMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
    );

    return [
      {
        clock_in: new Date(lastDayOfMonth.setHours(21, 0, 0)).toISOString(),
        clock_out: new Date(
          firstDayOfNextMonth.setHours(2, 30, 0),
        ).toISOString(),
        break_start: new Date(lastDayOfMonth.setHours(23, 0, 0)).toISOString(),
        break_end: new Date(lastDayOfMonth.setHours(23, 30, 0)).toISOString(),
        expected_wage: Math.round(5 * 1500), // 実働5時間 × 1500円（簡略化）
      },
    ];
  },
};

/**
 * 1ヶ月分フルフルパターン（様々な勤務パターンを含む1ヶ月分）
 */
const fullMonthPattern: TestPattern = {
  name: "1ヶ月分フルフル",
  description: "様々な勤務パターンを含む1ヶ月分のデータ（全て休憩付き）",
  generate: () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const data = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, currentMonth, day);
      const dayOfWeek = currentDate.getDay(); // 0=日曜日, 6=土曜日

      // 土日は休日勤務（夜勤系）
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 日曜日：夜勤（20:00-23:30）
        if (dayOfWeek === 0) {
          data.push({
            clock_in: new Date(
              currentYear,
              currentMonth,
              day,
              20,
              0,
              0,
            ).toISOString(),
            clock_out: new Date(
              currentYear,
              currentMonth,
              day,
              23,
              30,
              0,
            ).toISOString(),
            break_start: new Date(
              currentYear,
              currentMonth,
              day,
              21,
              30,
              0,
            ).toISOString(),
            break_end: new Date(
              currentYear,
              currentMonth,
              day,
              21,
              45,
              0,
            ).toISOString(),
            expected_wage: Math.round(3.25 * 1500), // 実働3.25時間
          });
        }
        // 土曜日：日付跨ぎ勤務（21:00-翌日2:30）
        else {
          const nextDay = new Date(currentYear, currentMonth, day + 1);
          data.push({
            clock_in: new Date(
              currentYear,
              currentMonth,
              day,
              21,
              0,
              0,
            ).toISOString(),
            clock_out: new Date(
              nextDay.getFullYear(),
              nextDay.getMonth(),
              nextDay.getDate(),
              2,
              30,
              0,
            ).toISOString(),
            break_start: new Date(
              currentYear,
              currentMonth,
              day,
              23,
              0,
              0,
            ).toISOString(),
            break_end: new Date(
              currentYear,
              currentMonth,
              day,
              23,
              30,
              0,
            ).toISOString(),
            expected_wage: Math.round(5 * 1500), // 実働5時間
          });
        }
      }
      // 平日は通常勤務（9:00-18:00）
      else {
        data.push({
          clock_in: new Date(
            currentYear,
            currentMonth,
            day,
            9,
            0,
            0,
          ).toISOString(),
          clock_out: new Date(
            currentYear,
            currentMonth,
            day,
            18,
            0,
            0,
          ).toISOString(),
          break_start: new Date(
            currentYear,
            currentMonth,
            day,
            12,
            0,
            0,
          ).toISOString(),
          break_end: new Date(
            currentYear,
            currentMonth,
            day,
            13,
            0,
            0,
          ).toISOString(),
          expected_wage: 8 * 1500, // 実働8時間
        });
      }
    }

    return data;
  },
};

/**
 * 3ヶ月分パターン（前月・当月・翌月、月跨ぎ含む、月10日程度）
 */
const threeMonthPattern: TestPattern = {
  name: "3ヶ月分（跨ぎ含む）",
  description:
    "前月・当月・翌月の3ヶ月分＋月跨ぎ勤務を含み、月10日程度（全て休憩付き）",
  generate: () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const data = [];
    const targetDaysPerMonth = 10; // 月あたりの目標勤務日数

    // 前月、当月、翌月の情報
    const months = [currentMonth - 1, currentMonth, currentMonth + 1];
    const years = [
      currentMonth === 0 ? currentYear - 1 : currentYear,
      currentYear,
      currentMonth === 11 ? currentYear + 1 : currentYear,
    ];

    // 月跨ぎ：前月末21:00〜当月1日2:30
    const prevMonthLastDay = new Date(years[0], months[0] + 1, 0);
    const thisMonthFirstDay = new Date(years[1], months[1], 1);
    data.push({
      clock_in: new Date(
        prevMonthLastDay.getFullYear(),
        prevMonthLastDay.getMonth(),
        prevMonthLastDay.getDate(),
        21,
        0,
        0,
      ).toISOString(),
      clock_out: new Date(
        thisMonthFirstDay.getFullYear(),
        thisMonthFirstDay.getMonth(),
        thisMonthFirstDay.getDate(),
        2,
        30,
        0,
      ).toISOString(),
      break_start: new Date(
        prevMonthLastDay.getFullYear(),
        prevMonthLastDay.getMonth(),
        prevMonthLastDay.getDate(),
        23,
        0,
        0,
      ).toISOString(),
      break_end: new Date(
        prevMonthLastDay.getFullYear(),
        prevMonthLastDay.getMonth(),
        prevMonthLastDay.getDate(),
        23,
        30,
        0,
      ).toISOString(),
      expected_wage: Math.round(5 * 1500), // 実働5時間
    });

    // 月跨ぎ：当月末21:00〜翌月1日2:30
    const thisMonthLastDay = new Date(years[1], months[1] + 1, 0);
    const nextMonthFirstDay = new Date(years[2], months[2], 1);
    data.push({
      clock_in: new Date(
        thisMonthLastDay.getFullYear(),
        thisMonthLastDay.getMonth(),
        thisMonthLastDay.getDate(),
        21,
        0,
        0,
      ).toISOString(),
      clock_out: new Date(
        nextMonthFirstDay.getFullYear(),
        nextMonthFirstDay.getMonth(),
        nextMonthFirstDay.getDate(),
        2,
        30,
        0,
      ).toISOString(),
      break_start: new Date(
        thisMonthLastDay.getFullYear(),
        thisMonthLastDay.getMonth(),
        thisMonthLastDay.getDate(),
        23,
        0,
        0,
      ).toISOString(),
      break_end: new Date(
        thisMonthLastDay.getFullYear(),
        thisMonthLastDay.getMonth(),
        thisMonthLastDay.getDate(),
        23,
        30,
        0,
      ).toISOString(),
      expected_wage: Math.round(5 * 1500), // 実働5時間
    });

    // 各月ごとにデータを追加
    months.forEach((month, idx) => {
      const year = years[idx];
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let workDaysInMonth = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        if (workDaysInMonth >= targetDaysPerMonth) break;

        const date = new Date(year, month, day);
        // 未来日付をスキップ
        if (date >= today) continue;

        const dayOfWeek = date.getDay();
        let clockIn, clockOut, breakStart, breakEnd, expectedWage;

        // ランダムに勤務日を選択（約50%の確率で勤務）
        if (Math.random() < 0.5) continue;

        switch (dayOfWeek) {
          case 0: // 日曜：夜勤（3.5h）- 休憩15分
            clockIn = new Date(year, month, day, 20, 0, 0);
            clockOut = new Date(year, month, day, 23, 30, 0);
            breakStart = new Date(year, month, day, 21, 30, 0);
            breakEnd = new Date(year, month, day, 21, 45, 0);
            expectedWage = Math.round(3.25 * 1500);
            break;

          case 6: // 土曜：日付跨ぎ（5.5h）- 休憩30分
            const nextDay = new Date(year, month, day + 1);
            clockIn = new Date(year, month, day, 21, 0, 0);
            clockOut = new Date(
              nextDay.getFullYear(),
              nextDay.getMonth(),
              nextDay.getDate(),
              2,
              30,
              0,
            );
            breakStart = new Date(year, month, day, 23, 0, 0);
            breakEnd = new Date(year, month, day, 23, 30, 0);
            expectedWage = Math.round(5 * 1500);
            break;

          default: // 平日：通常勤務（9h）- 休憩1時間
            clockIn = new Date(year, month, day, 9, 0, 0);
            clockOut = new Date(year, month, day, 18, 0, 0);
            breakStart = new Date(year, month, day, 12, 0, 0);
            breakEnd = new Date(year, month, day, 13, 0, 0);
            expectedWage = 8 * 1500;
        }

        data.push({
          clock_in: clockIn.toISOString(),
          clock_out: clockOut.toISOString(),
          break_start: breakStart.toISOString(),
          break_end: breakEnd.toISOString(),
          expected_wage: expectedWage,
        });
        workDaysInMonth++;
      }
    });

    return data;
  },
};

/**
 * 半年分のテストデータパターン（月10日程度の勤務）
 */
const halfYearPattern: TestPattern = {
  name: "半年分データ",
  description: "過去半年分のデータ（月10日程度、休憩付き、月跨ぎ含む）",
  generate: () => {
    const today = new Date();
    const data = [];
    const targetDaysPerMonth = 10; // 月あたりの目標勤務日数

    // 過去6ヶ月分のデータを生成
    for (let monthOffset = 6; monthOffset > 0; monthOffset--) {
      const targetDate = new Date(today);
      targetDate.setMonth(today.getMonth() - monthOffset);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let workDaysInMonth = 0; // その月の勤務日数カウンター

      // 月末の日付跨ぎデータを追加（前月末から当月1日）
      if (monthOffset > 1) {
        // 今月は除外
        const nextMonth = new Date(year, month + 1, 1);
        data.push({
          clock_in: new Date(year, month, daysInMonth, 21, 0, 0).toISOString(),
          clock_out: new Date(
            nextMonth.getFullYear(),
            nextMonth.getMonth(),
            nextMonth.getDate(),
            2,
            30,
            0,
          ).toISOString(),
          break_start: new Date(
            year,
            month,
            daysInMonth,
            23,
            0,
            0,
          ).toISOString(),
          break_end: new Date(
            year,
            month,
            daysInMonth,
            23,
            30,
            0,
          ).toISOString(),
          expected_wage: Math.round(5 * 1500), // 実働5時間
        });
        workDaysInMonth++;
      }

      // 各日のデータを生成
      for (let day = 1; day <= daysInMonth; day++) {
        if (workDaysInMonth >= targetDaysPerMonth) break;

        const date = new Date(year, month, day);
        // 今日以降のデータは生成しない
        if (date >= today) break;

        const dayOfWeek = date.getDay();
        let clockIn, clockOut, breakStart, breakEnd, expectedWage;

        // ランダムに勤務日を選択（約50%の確率で勤務）
        if (Math.random() < 0.5) continue;

        switch (dayOfWeek) {
          case 0: // 日曜：夜勤（3.5h）- 休憩15分
            clockIn = new Date(year, month, day, 20, 0, 0);
            clockOut = new Date(year, month, day, 23, 30, 0);
            breakStart = new Date(year, month, day, 21, 30, 0);
            breakEnd = new Date(year, month, day, 21, 45, 0);
            expectedWage = Math.round(3.25 * 1500);
            break;

          case 6: // 土曜：日付跨ぎ（5.5h）- 休憩30分
            const nextDay = new Date(year, month, day + 1);
            clockIn = new Date(year, month, day, 21, 0, 0);
            clockOut = new Date(
              nextDay.getFullYear(),
              nextDay.getMonth(),
              nextDay.getDate(),
              2,
              30,
              0,
            );
            breakStart = new Date(year, month, day, 23, 0, 0);
            breakEnd = new Date(year, month, day, 23, 30, 0);
            expectedWage = Math.round(5 * 1500);
            break;

          default: // 平日：通常勤務（9h）- 休憩1時間
            clockIn = new Date(year, month, day, 9, 0, 0);
            clockOut = new Date(year, month, day, 18, 0, 0);
            breakStart = new Date(year, month, day, 12, 0, 0);
            breakEnd = new Date(year, month, day, 13, 0, 0);
            expectedWage = 8 * 1500;
        }

        data.push({
          clock_in: clockIn.toISOString(),
          clock_out: clockOut.toISOString(),
          break_start: breakStart.toISOString(),
          break_end: breakEnd.toISOString(),
          expected_wage: expectedWage,
        });
        workDaysInMonth++;
      }
    }

    return data;
  },
};

/**
 * 2025年上半期のテストデータパターン（月10日程度の均等分散勤務）
 */
const firstHalf2025Pattern: TestPattern = {
  name: "2025年上半期",
  description:
    "2025年1月から6月まで（月10日程度、休憩付き、月跨ぎ含む、均等分散）",
  generate: () => {
    const data: Array<{
      clock_in: string;
      clock_out: string;
      break_start: string;
      break_end: string;
      expected_wage: number;
    }> = [];
    const targetDaysPerMonth = 10; // 月あたりの目標勤務日数

    // 2025年1月から6月までの各月
    for (let month = 0; month < 6; month++) {
      const year = 2025;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let workDaysInMonth = 0;

      // 月末の日付跨ぎデータを追加（月初を除く）
      if (month < 5) {
        // 6月は除外
        const nextMonth = new Date(year, month + 1, 1);
        data.push({
          clock_in: new Date(year, month, daysInMonth, 21, 0, 0).toISOString(),
          clock_out: new Date(
            nextMonth.getFullYear(),
            nextMonth.getMonth(),
            nextMonth.getDate(),
            2,
            30,
            0,
          ).toISOString(),
          break_start: new Date(
            year,
            month,
            daysInMonth,
            23,
            0,
            0,
          ).toISOString(),
          break_end: new Date(
            year,
            month,
            daysInMonth,
            23,
            30,
            0,
          ).toISOString(),
          expected_wage: Math.round(5 * 1500), // 実働5時間
        });
        workDaysInMonth++;
      }

      // 各週の勤務日を確実に設定
      const weeksInMonth = Math.floor(daysInMonth / 7);
      const targetDaysPerWeek = Math.ceil(
        (targetDaysPerMonth - workDaysInMonth) / weeksInMonth,
      );

      // 月の1日から順に処理
      for (let day = 1; day <= daysInMonth; day++) {
        if (workDaysInMonth >= targetDaysPerMonth) break;

        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const weekNumber = Math.floor((day - 1) / 7);

        // 各週に最低2日は確実に入れる
        const daysInThisWeek = data.filter((d) => {
          const clockIn = new Date(d.clock_in);
          return (
            clockIn.getFullYear() === year &&
            clockIn.getMonth() === month &&
            Math.floor((clockIn.getDate() - 1) / 7) === weekNumber
          );
        }).length;

        // その週の勤務日数が目標に達していない場合のみ追加
        if (daysInThisWeek < targetDaysPerWeek) {
          let shiftData: {
            clockIn: Date;
            clockOut: Date;
            breakStart: Date;
            breakEnd: Date;
            expectedWage: number;
          } | null = null;

          // 曜日に応じたシフトパターン
          switch (dayOfWeek) {
            case 0: // 日曜：夜勤（3.5h）- 休憩15分
              shiftData = {
                clockIn: new Date(year, month, day, 20, 0, 0),
                clockOut: new Date(year, month, day, 23, 30, 0),
                breakStart: new Date(year, month, day, 21, 30, 0),
                breakEnd: new Date(year, month, day, 21, 45, 0),
                expectedWage: Math.round(3.25 * 1500),
              };
              break;

            case 6: // 土曜：日付跨ぎ（5.5h）- 休憩30分
              const nextDay = new Date(year, month, day + 1);
              shiftData = {
                clockIn: new Date(year, month, day, 21, 0, 0),
                clockOut: new Date(
                  nextDay.getFullYear(),
                  nextDay.getMonth(),
                  nextDay.getDate(),
                  2,
                  30,
                  0,
                ),
                breakStart: new Date(year, month, day, 23, 0, 0),
                breakEnd: new Date(year, month, day, 23, 30, 0),
                expectedWage: Math.round(5 * 1500),
              };
              break;

            default: // 平日：通常勤務（9h）- 休憩1時間
              // 平日は確実に入れる（特に火・水・木を優先）
              if (dayOfWeek >= 2 && dayOfWeek <= 4) {
                shiftData = {
                  clockIn: new Date(year, month, day, 9, 0, 0),
                  clockOut: new Date(year, month, day, 18, 0, 0),
                  breakStart: new Date(year, month, day, 12, 0, 0),
                  breakEnd: new Date(year, month, day, 13, 0, 0),
                  expectedWage: 8 * 1500,
                };
              }
          }

          // シフトが設定された場合のみデータを追加
          if (shiftData) {
            data.push({
              clock_in: shiftData.clockIn.toISOString(),
              clock_out: shiftData.clockOut.toISOString(),
              break_start: shiftData.breakStart.toISOString(),
              break_end: shiftData.breakEnd.toISOString(),
              expected_wage: shiftData.expectedWage,
            });
            workDaysInMonth++;
          }
        }
      }

      // その月の勤務日数が目標に達していない場合、追加の平日シフトで補完
      while (workDaysInMonth < targetDaysPerMonth) {
        // 月の中旬（15日前後）の平日を探して追加
        for (let day = 13; day <= 17; day++) {
          if (workDaysInMonth >= targetDaysPerMonth) break;

          const date = new Date(year, month, day);
          const dayOfWeek = date.getDay();

          // 平日のみ
          if (dayOfWeek > 0 && dayOfWeek < 6) {
            data.push({
              clock_in: new Date(year, month, day, 9, 0, 0).toISOString(),
              clock_out: new Date(year, month, day, 18, 0, 0).toISOString(),
              break_start: new Date(year, month, day, 12, 0, 0).toISOString(),
              break_end: new Date(year, month, day, 13, 0, 0).toISOString(),
              expected_wage: 8 * 1500,
            });
            workDaysInMonth++;
          }
        }
      }
    }

    return data;
  },
};

/**
 * 1年分のテストデータパターン（月15日程度の勤務）
 */
const fullYearPattern: TestPattern = {
  name: "1年分データ",
  description: "過去1年分のデータ（月15日程度、休憩付き、月跨ぎ含む）",
  generate: () => {
    const today = new Date();
    const data = [];
    const targetDaysPerMonth = 15; // 月あたりの目標勤務日数

    // 過去12ヶ月分のデータを生成
    for (let monthOffset = 12; monthOffset > 0; monthOffset--) {
      const targetDate = new Date(today);
      targetDate.setMonth(today.getMonth() - monthOffset);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let workDaysInMonth = 0;

      // 月末の日付跨ぎデータを追加（今月は除外）
      if (monthOffset > 1) {
        const nextMonth = new Date(year, month + 1, 1);
        data.push({
          clock_in: new Date(year, month, daysInMonth, 21, 0, 0).toISOString(),
          clock_out: new Date(
            nextMonth.getFullYear(),
            nextMonth.getMonth(),
            nextMonth.getDate(),
            2,
            30,
            0,
          ).toISOString(),
          break_start: new Date(
            year,
            month,
            daysInMonth,
            23,
            0,
            0,
          ).toISOString(),
          break_end: new Date(
            year,
            month,
            daysInMonth,
            23,
            30,
            0,
          ).toISOString(),
          expected_wage: Math.round(5 * 1500),
        });
        workDaysInMonth++;
      }

      // 各日のデータを生成（より確実に目標日数を達成）
      const targetDays = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date >= today) break;

        const dayOfWeek = date.getDay();
        // 平日を優先的に選択
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          targetDays.push(day);
        }
      }

      // 土日も追加
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date >= today) break;

        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          targetDays.push(day);
        }
      }

      // シャッフルして目標日数分選択
      targetDays.sort(() => Math.random() - 0.5);
      const selectedDays = targetDays.slice(
        0,
        targetDaysPerMonth - workDaysInMonth,
      );

      selectedDays.forEach((day) => {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        let clockIn, clockOut, breakStart, breakEnd, expectedWage;

        switch (dayOfWeek) {
          case 0: // 日曜：夜勤
            clockIn = new Date(year, month, day, 20, 0, 0);
            clockOut = new Date(year, month, day, 23, 30, 0);
            breakStart = new Date(year, month, day, 21, 30, 0);
            breakEnd = new Date(year, month, day, 21, 45, 0);
            expectedWage = Math.round(3.25 * 1500);
            break;

          case 6: // 土曜：日付跨ぎ
            const nextDay = new Date(year, month, day + 1);
            clockIn = new Date(year, month, day, 21, 0, 0);
            clockOut = new Date(
              nextDay.getFullYear(),
              nextDay.getMonth(),
              nextDay.getDate(),
              2,
              30,
              0,
            );
            breakStart = new Date(year, month, day, 23, 0, 0);
            breakEnd = new Date(year, month, day, 23, 30, 0);
            expectedWage = Math.round(5 * 1500);
            break;

          default: // 平日：通常勤務
            clockIn = new Date(year, month, day, 9, 0, 0);
            clockOut = new Date(year, month, day, 18, 0, 0);
            breakStart = new Date(year, month, day, 12, 0, 0);
            breakEnd = new Date(year, month, day, 13, 0, 0);
            expectedWage = 8 * 1500;
        }

        data.push({
          clock_in: clockIn.toISOString(),
          clock_out: clockOut.toISOString(),
          break_start: breakStart.toISOString(),
          break_end: breakEnd.toISOString(),
          expected_wage: expectedWage,
        });
      });
    }

    return data;
  },
};

/**
 * 利用可能なテストパターン
 */
export const testPatterns: TestPattern[] = [
  normalPattern,
  normalWithBreakPattern,
  multipleBreaksPattern,
  nightWithBreakPattern,
  crossDayWithBreakPattern,
  nightPattern,
  crossDayPattern,
  multiDayPattern,
  crossMonthPattern,
  fullMonthPattern,
  threeMonthPattern,
  halfYearPattern,
  firstHalf2025Pattern,
  fullYearPattern,
];

/**
 * 未来日付をチェックする関数
 * @param dates - チェックする日付の配列
 * @returns 全ての日付が現在時刻以前の場合はtrue
 */
const validateDates = (...dates: Date[]): boolean => {
  const now = new Date();
  return dates.every((date) => date <= now);
};

/**
 * テストデータを挿入し検証結果を表示
 * @param {string} staffId - スタッフID
 * @param {string} patternName - テストパターン名
 */
export const insertAndValidateTestData = async (
  staffId: string,
  patternName: string,
) => {
  try {
    const supabase = createClient();
    const pattern = testPatterns.find((p) => p.name === patternName);

    if (!pattern) {
      throw new Error("指定されたパターンが見つかりません");
    }

    const testData = pattern.generate();
    const now = new Date();
    const results = [];
    const skippedData = [];

    for (const record of testData) {
      // 未来日付のチェック
      const clockIn = new Date(record.clock_in);
      const clockOut = record.clock_out ? new Date(record.clock_out) : null;
      const breakStart = record.break_start
        ? new Date(record.break_start)
        : null;
      const breakEnd = record.break_end ? new Date(record.break_end) : null;

      // 全ての時刻が現在時刻以前であることを確認
      if (
        clockIn > now ||
        (clockOut && clockOut > now) ||
        (breakStart && breakStart > now) ||
        (breakEnd && breakEnd > now)
      ) {
        skippedData.push({
          clockIn: clockIn.toLocaleString(),
          clockOut: clockOut?.toLocaleString(),
          breakStart: breakStart?.toLocaleString(),
          breakEnd: breakEnd?.toLocaleString(),
          reason: "未来の日時のため、スキップされました",
        });
        continue;
      }

      const { data, error } = await supabase
        .from("attendance")
        .insert({
          staff_id: staffId,
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          break_start: record.break_start || null,
          break_end: record.break_end || null,
        })
        .select("*");

      if (error) throw error;

      // 給与計算検証
      const calculated = await calculateWage(supabase, data[0].id);
      results.push({
        id: data[0].id,
        expected: record.expected_wage,
        actual: calculated,
        passed: calculated === record.expected_wage,
      });
    }

    // 結果の表示
    if (skippedData.length > 0) {
      console.log("スキップされたデータ:");
      console.table(skippedData);
    }

    if (results.length > 0) {
      console.log("テスト結果:");
      console.table(results, ["id", "expected", "actual", "passed"]);
      alert(
        `${pattern.name}パターンのテスト完了\n` +
          `成功: ${results.filter((r) => r.passed).length}/${results.length}\n` +
          `スキップ: ${skippedData.length}件`,
      );
    } else {
      alert("全てのデータが未来日付のためスキップされました");
    }
  } catch (error) {
    console.error("テスト失敗:", error);
    alert("テスト実行中にエラーが発生しました");
  }
};

/**
 * 給与計算関数（テスト用）- 休憩時間を考慮
 */
const calculateWage = async (supabase: SupabaseClient, recordId: string) => {
  const { data } = await supabase
    .from("attendance")
    .select("clock_in, clock_out, break_start, break_end")
    .eq("id", recordId)
    .single();

  if (!data || !data.clock_out) return 0;

  const clockIn = new Date(data.clock_in);
  const clockOut = new Date(data.clock_out);
  const breakStart = data.break_start ? new Date(data.break_start) : null;
  const breakEnd = data.break_end ? new Date(data.break_end) : null;

  let total = 0;
  const current = new Date(clockIn);

  while (current < clockOut) {
    const nextHour = new Date(current);
    nextHour.setHours(current.getHours() + 1);

    // 休憩時間をスキップ
    if (breakStart && breakEnd && current >= breakStart && current < breakEnd) {
      current.setTime(nextHour.getTime());
      continue;
    }

    const hour = current.getHours();
    let rate = 1500; // 基本時給

    if (hour >= 22 || hour < 6) {
      rate = 1875; // 夜勤手当
    }

    // 日付跨ぎの場合は深夜手当
    if (current.getDate() !== clockIn.getDate()) {
      rate = 2000;
    }

    total += rate;
    current.setTime(nextHour.getTime());
  }

  return total;
};

/**
 * テストデータを削除する
 * @param {string} staffId - スタッフID
 */
export const deleteTestData = async (staffId: string) => {
  try {
    const supabase = createClient();

    // テストデータの削除
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("staff_id", staffId);

    if (error) throw error;

    alert("テストデータを削除しました");
  } catch (error) {
    console.error("テストデータの削除に失敗:", error);
    alert("テストデータの削除に失敗しました");
  }
};
