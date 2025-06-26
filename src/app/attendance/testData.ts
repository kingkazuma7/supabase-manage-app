import { createClient } from '../utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * テストデータのパターン定義
 */
export type TestPattern = {
  name: string
  description: string
  generate: () => Array<{
    clock_in: string, 
    clock_out: string | null, 
    break_start?: string | null,
    break_end?: string | null,
    expected_wage: number
  }>
}

/**
 * 通常勤務パターン（9:00-18:00）
 */
const normalPattern: TestPattern = {
  name: '通常勤務',
  description: '9:00-18:00（9時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
      expected_wage: 9 * 1500 // 9時間 × 1500円
    }]
  }
}

/**
 * 休憩時間付き通常勤務パターン（9:00-18:00、休憩12:00-13:00）
 */
const normalWithBreakPattern: TestPattern = {
  name: '休憩付き通常勤務',
  description: '9:00-18:00（9時間）、休憩12:00-13:00（実働8時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
      break_start: new Date(today.setHours(12, 0, 0)).toISOString(),
      break_end: new Date(today.setHours(13, 0, 0)).toISOString(),
      expected_wage: 8 * 1500 // 実働8時間 × 1500円
    }]
  }
}

/**
 * 複数休憩付き勤務パターン（9:00-18:00、休憩2回）
 */
const multipleBreaksPattern: TestPattern = {
  name: '複数休憩付き勤務',
  description: '9:00-18:00（9時間）、休憩10:30-10:45、15:00-15:15（実働8.5時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
      break_start: new Date(today.setHours(10, 30, 0)).toISOString(),
      break_end: new Date(today.setHours(15, 15, 0)).toISOString(), // 2回の休憩を1つの期間で表現
      expected_wage: Math.round(8.5 * 1500) // 実働8.5時間 × 1500円
    }]
  }
}

/**
 * 夜勤休憩付きパターン（20:00-23:30、休憩21:30-21:45）
 */
const nightWithBreakPattern: TestPattern = {
  name: '夜勤休憩付き',
  description: '20:00-23:30（3.5時間）、休憩21:30-21:45（実働3.25時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(23, 30, 0)).toISOString(),
      break_start: new Date(today.setHours(21, 30, 0)).toISOString(),
      break_end: new Date(today.setHours(21, 45, 0)).toISOString(),
      expected_wage: Math.round(3.25 * 1500) // 実働3.25時間 × 1500円（簡略化）
    }]
  }
}

/**
 * 日付跨ぎ休憩付きパターン（21:00-翌日2:30、休憩23:00-23:30）
 */
const crossDayWithBreakPattern: TestPattern = {
  name: '日付跨ぎ休憩付き',
  description: '21:00-翌日2:30（5.5時間）、休憩23:00-23:30（実働5時間）',
  generate: () => {
    const today = new Date()
    const nextDay = new Date(today)
    nextDay.setDate(today.getDate() + 1)
    
    return [{
      clock_in: new Date(today.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
      break_start: new Date(today.setHours(23, 0, 0)).toISOString(),
      break_end: new Date(today.setHours(23, 30, 0)).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間 × 1500円（簡略化）
    }]
  }
}

/**
 * 夜勤パターン（20:00-23:30）
 */
const nightPattern: TestPattern = {
  name: '夜勤',
  description: '20:00-23:30（3.5時間）、休憩21:30-21:45（実働3.25時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(23, 30, 0)).toISOString(),
      break_start: new Date(today.setHours(21, 30, 0)).toISOString(),
      break_end: new Date(today.setHours(21, 45, 0)).toISOString(),
      expected_wage: Math.round(3.25 * 1500) // 実働3.25時間 × 1500円（簡略化）
    }]
  }
}

/**
 * 日付跨ぎパターン（21:00-翌日2:30）
 */
const crossDayPattern: TestPattern = {
  name: '日付跨ぎ',
  description: '21:00-翌日2:30（5.5時間）、休憩23:00-23:30（実働5時間）',
  generate: () => {
    const today = new Date()
    const nextDay = new Date(today)
    nextDay.setDate(today.getDate() + 1)
    
    return [{
      clock_in: new Date(today.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
      break_start: new Date(today.setHours(23, 0, 0)).toISOString(),
      break_end: new Date(today.setHours(23, 30, 0)).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間 × 1500円（簡略化）
    }]
  }
}

/**
 * 複数日パターン（3日分）
 */
const multiDayPattern: TestPattern = {
  name: '複数日',
  description: '3日分の勤務パターン（全て休憩付き）',
  generate: () => {
    const today = new Date()
    const data = []
    
    // 1日目：通常勤務（今日）
    data.push({
      clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
      break_start: new Date(today.setHours(12, 0, 0)).toISOString(),
      break_end: new Date(today.setHours(13, 0, 0)).toISOString(),
      expected_wage: 8 * 1500 // 実働8時間
    })
    
    // 2日目：夜勤（明日）
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    data.push({
      clock_in: new Date(tomorrow.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(tomorrow.setHours(23, 30, 0)).toISOString(),
      break_start: new Date(tomorrow.setHours(21, 30, 0)).toISOString(),
      break_end: new Date(tomorrow.setHours(21, 45, 0)).toISOString(),
      expected_wage: Math.round(3.25 * 1500) // 実働3.25時間
    })
    
    // 3日目：日付跨ぎ（明後日）
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(tomorrow.getDate() + 1)
    const nextDay = new Date(dayAfterTomorrow)
    nextDay.setDate(dayAfterTomorrow.getDate() + 1)
    data.push({
      clock_in: new Date(dayAfterTomorrow.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
      break_start: new Date(dayAfterTomorrow.setHours(23, 0, 0)).toISOString(),
      break_end: new Date(dayAfterTomorrow.setHours(23, 30, 0)).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間
    })
    
    return data
  }
}

/**
 * 月跨ぎパターン（月末21:00-翌月2:30）
 */
const crossMonthPattern: TestPattern = {
  name: '月跨ぎ',
  description: '月末21:00-翌月2:30（5.5時間）、休憩23:00-23:30（実働5時間）',
  generate: () => {
    const today = new Date()
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    
    return [{
      clock_in: new Date(lastDayOfMonth.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(firstDayOfNextMonth.setHours(2, 30, 0)).toISOString(),
      break_start: new Date(lastDayOfMonth.setHours(23, 0, 0)).toISOString(),
      break_end: new Date(lastDayOfMonth.setHours(23, 30, 0)).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間 × 1500円（簡略化）
    }]
  }
}

/**
 * 1ヶ月分フルフルパターン（様々な勤務パターンを含む1ヶ月分）
 */
const fullMonthPattern: TestPattern = {
  name: '1ヶ月分フルフル',
  description: '様々な勤務パターンを含む1ヶ月分のデータ（全て休憩付き）',
  generate: () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const data = []
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, currentMonth, day)
      const dayOfWeek = currentDate.getDay() // 0=日曜日, 6=土曜日
      
      // 土日は休日勤務（夜勤系）
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 日曜日：夜勤（20:00-23:30）
        if (dayOfWeek === 0) {
          data.push({
            clock_in: new Date(currentYear, currentMonth, day, 20, 0, 0).toISOString(),
            clock_out: new Date(currentYear, currentMonth, day, 23, 30, 0).toISOString(),
            break_start: new Date(currentYear, currentMonth, day, 21, 30, 0).toISOString(),
            break_end: new Date(currentYear, currentMonth, day, 21, 45, 0).toISOString(),
            expected_wage: Math.round(3.25 * 1500) // 実働3.25時間
          })
        }
        // 土曜日：日付跨ぎ勤務（21:00-翌日2:30）
        else {
          const nextDay = new Date(currentYear, currentMonth, day + 1)
          data.push({
            clock_in: new Date(currentYear, currentMonth, day, 21, 0, 0).toISOString(),
            clock_out: new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 2, 30, 0).toISOString(),
            break_start: new Date(currentYear, currentMonth, day, 23, 0, 0).toISOString(),
            break_end: new Date(currentYear, currentMonth, day, 23, 30, 0).toISOString(),
            expected_wage: Math.round(5 * 1500) // 実働5時間
          })
        }
      }
      // 平日は通常勤務（9:00-18:00）
      else {
        data.push({
          clock_in: new Date(currentYear, currentMonth, day, 9, 0, 0).toISOString(),
          clock_out: new Date(currentYear, currentMonth, day, 18, 0, 0).toISOString(),
          break_start: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          break_end: new Date(currentYear, currentMonth, day, 13, 0, 0).toISOString(),
          expected_wage: 8 * 1500 // 実働8時間
        })
      }
    }
    
    return data
  }
}

/**
 * 3ヶ月分パターン（前月・当月・翌月、月跨ぎ含む、各月最大160h）
 */
const threeMonthPattern: TestPattern = {
  name: '3ヶ月分（跨ぎ含む）',
  description: '前月・当月・翌月の3ヶ月分＋月跨ぎ勤務を含み、各月最大160h（全て休憩付き）',
  generate: () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const data = [];
    const maxMinutes = 160 * 60; // 160h

    // 前月、当月、翌月の情報
    const months = [currentMonth - 1, currentMonth, currentMonth + 1];
    const years = [
      currentMonth === 0 ? currentYear - 1 : currentYear,
      currentYear,
      currentMonth === 11 ? currentYear + 1 : currentYear
    ];

    // 月跨ぎ：前月末21:00〜当月1日2:30
    const prevMonthLastDay = new Date(years[0], months[0] + 1, 0);
    const thisMonthFirstDay = new Date(years[1], months[1], 1);
    data.push({
      clock_in: new Date(prevMonthLastDay.getFullYear(), prevMonthLastDay.getMonth(), prevMonthLastDay.getDate(), 21, 0, 0).toISOString(),
      clock_out: new Date(thisMonthFirstDay.getFullYear(), thisMonthFirstDay.getMonth(), thisMonthFirstDay.getDate(), 2, 30, 0).toISOString(),
      break_start: new Date(prevMonthLastDay.getFullYear(), prevMonthLastDay.getMonth(), prevMonthLastDay.getDate(), 23, 0, 0).toISOString(),
      break_end: new Date(prevMonthLastDay.getFullYear(), prevMonthLastDay.getMonth(), prevMonthLastDay.getDate(), 23, 30, 0).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間
    });
    // 月跨ぎ：当月末21:00〜翌月1日2:30
    const thisMonthLastDay = new Date(years[1], months[1] + 1, 0);
    const nextMonthFirstDay = new Date(years[2], months[2], 1);
    data.push({
      clock_in: new Date(thisMonthLastDay.getFullYear(), thisMonthLastDay.getMonth(), thisMonthLastDay.getDate(), 21, 0, 0).toISOString(),
      clock_out: new Date(nextMonthFirstDay.getFullYear(), nextMonthFirstDay.getMonth(), nextMonthFirstDay.getDate(), 2, 30, 0).toISOString(),
      break_start: new Date(thisMonthLastDay.getFullYear(), thisMonthLastDay.getMonth(), thisMonthLastDay.getDate(), 23, 0, 0).toISOString(),
      break_end: new Date(thisMonthLastDay.getFullYear(), thisMonthLastDay.getMonth(), thisMonthLastDay.getDate(), 23, 30, 0).toISOString(),
      expected_wage: Math.round(5 * 1500) // 実働5時間
    });

    // 各月ごとに最大160hまでデータを追加
    months.forEach((month, idx) => {
      const year = years[idx];
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let totalMinutes = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (totalMinutes >= maxMinutes) break;
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        let clockIn, clockOut, breakStart, breakEnd, expectedWage, workMinutes;
        if (dayOfWeek === 0) {
          // 日曜：夜勤（3.5h）- 休憩15分
          clockIn = new Date(year, month, day, 20, 0, 0);
          clockOut = new Date(year, month, day, 23, 30, 0);
          breakStart = new Date(year, month, day, 21, 30, 0);
          breakEnd = new Date(year, month, day, 21, 45, 0);
          workMinutes = 3.25 * 60; // 実働3.25時間
          expectedWage = Math.round(3.25 * 1500);
        } else if (dayOfWeek === 6) {
          // 土曜：日付跨ぎ（5.5h）- 休憩30分
          const nextDay = new Date(year, month, day + 1);
          clockIn = new Date(year, month, day, 21, 0, 0);
          clockOut = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 2, 30, 0);
          breakStart = new Date(year, month, day, 23, 0, 0);
          breakEnd = new Date(year, month, day, 23, 30, 0);
          workMinutes = 5 * 60; // 実働5時間
          expectedWage = Math.round(5 * 1500);
        } else {
          // 平日：通常勤務（9h）- 休憩1時間
          clockIn = new Date(year, month, day, 9, 0, 0);
          clockOut = new Date(year, month, day, 18, 0, 0);
          breakStart = new Date(year, month, day, 12, 0, 0);
          breakEnd = new Date(year, month, day, 13, 0, 0);
          workMinutes = 8 * 60; // 実働8時間
          expectedWage = 8 * 1500;
        }
        // 追加しても160hを超えない場合のみpush
        if (totalMinutes + workMinutes <= maxMinutes) {
          data.push({
            clock_in: clockIn.toISOString(),
            clock_out: clockOut.toISOString(),
            break_start: breakStart.toISOString(),
            break_end: breakEnd.toISOString(),
            expected_wage: expectedWage
          });
          totalMinutes += workMinutes;
        } else if (totalMinutes < maxMinutes) {
          // 端数調整：残り分だけ追加
          const remain = maxMinutes - totalMinutes;
          // 端数分の勤務時間をclock_outに反映
          const partialClockOut = new Date(clockIn.getTime() + remain * 60 * 1000);
          // 給与は1分単位で1500円/60分で計算
          const partialWage = Math.round(remain * (1500 / 60));
          data.push({
            clock_in: clockIn.toISOString(),
            clock_out: partialClockOut.toISOString(),
            break_start: breakStart.toISOString(),
            break_end: breakEnd.toISOString(),
            expected_wage: partialWage
          });
          totalMinutes = maxMinutes;
        }
      }
    });
    return data;
  }
};

/**
 * 週休3日のアルバイトパターン（2ヶ月分）
 */
const partTimePattern: TestPattern = {
  name: '週休3日アルバイト',
  description: '2ヶ月分の週休3日アルバイトパターン（火水木のみ勤務、当日より過去分）',
  generate: () => {
    const data: {
      clock_in: string;
      clock_out: string;
      break_start: string;
      break_end: string;
      expected_wage: number;
    }[] = [];
    
    const today = new Date();
    
    // 2ヶ月前の日付を取得
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 2);
    startDate.setHours(0, 0, 0, 0);
    
    // 開始日から当日まで1日ずつ処理
    const processDate = (baseDate: Date) => {
      const currentDate = new Date(baseDate);
      const dayOfWeek = currentDate.getDay(); // 0=日曜日, 6=土曜日
      
      // 火(2)・水(3)・木(4)のみ勤務
      if (dayOfWeek >= 2 && dayOfWeek <= 4) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = currentDate.getDate();
        
        let workSchedule: {
          clockIn: Date;
          clockOut: Date;
          breakStart: Date;
          breakEnd: Date;
          expectedWage: number;
        };
        
        switch (dayOfWeek) {
          case 2: // 火曜：通常勤務 10:00-19:00
            workSchedule = {
              clockIn: new Date(year, month, date, 10, 0),
              clockOut: new Date(year, month, date, 19, 0),
              breakStart: new Date(year, month, date, 14, 0),
              breakEnd: new Date(year, month, date, 15, 0),
              expectedWage: 8 * 1500 // 実働8時間
            };
            break;
            
          case 3: // 水曜：夜勤 17:00-22:00
            workSchedule = {
              clockIn: new Date(year, month, date, 17, 0),
              clockOut: new Date(year, month, date, 22, 0),
              breakStart: new Date(year, month, date, 19, 30),
              breakEnd: new Date(year, month, date, 20, 0),
              expectedWage: Math.round(4.5 * 1500) // 実働4.5時間
            };
            break;
            
          case 4: // 木曜：早朝勤務 7:00-16:00
            workSchedule = {
              clockIn: new Date(year, month, date, 7, 0),
              clockOut: new Date(year, month, date, 16, 0),
              breakStart: new Date(year, month, date, 11, 0),
              breakEnd: new Date(year, month, date, 12, 0),
              expectedWage: 8 * 1500 // 実働8時間
            };
            break;
            
          default:
            return;
        }
        
        data.push({
          clock_in: workSchedule.clockIn.toISOString(),
          clock_out: workSchedule.clockOut.toISOString(),
          break_start: workSchedule.breakStart.toISOString(),
          break_end: workSchedule.breakEnd.toISOString(),
          expected_wage: workSchedule.expectedWage
        });
      }
    };
    
    // 開始日から当日まで1日ずつ処理
    for (
      const currentDate = new Date(startDate);
      currentDate <= today;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      processDate(currentDate);
    }
    
    return data;
  }
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
  partTimePattern
]

/**
 * テストデータを挿入し検証結果を表示
 * @param {string} staffId - スタッフID
 * @param {string} patternName - テストパターン名
 */
export const insertAndValidateTestData = async (staffId: string, patternName: string) => {
  try {
    const supabase = createClient()
    const pattern = testPatterns.find(p => p.name === patternName)
    
    if (!pattern) {
      throw new Error('指定されたパターンが見つかりません')
    }
    
    const testData = pattern.generate()
    
    const results = []
    for (const record of testData) {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          staff_id: staffId,
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          break_start: record.break_start || null,
          break_end: record.break_end || null
        })
        .select('*')
      
      if (error) throw error
      
      // 給与計算検証
      const calculated = await calculateWage(supabase, data[0].id)
      results.push({
        id: data[0].id,
        expected: record.expected_wage,
        actual: calculated,
        passed: calculated === record.expected_wage
      })
    }
    
    console.table(results, ['id', 'expected', 'actual', 'passed'])
    alert(`${pattern.name}パターンのテスト完了\n成功: ${results.filter(r => r.passed).length}/${results.length}`)
  } catch (error) {
    console.error('テスト失敗:', error)
    alert('テスト実行中にエラーが発生しました')
  }
}

/**
 * 給与計算関数（テスト用）
 */
const calculateWage = async (supabase: SupabaseClient, recordId: string) => {
  const { data } = await supabase
    .from('attendance')
    .select('clock_in, clock_out')
    .eq('id', recordId)
    .single()
  
  if (!data || !data.clock_out) return 0
  
  const clockIn = new Date(data.clock_in)
  const clockOut = new Date(data.clock_out)
  let total = 0
  const current = new Date(clockIn)
  
  while (current < clockOut) {
    const hour = current.getHours()
    let rate = hour >= 22 ? 1875 : 1500
    if (current.getDate() !== clockIn.getDate()) rate = 2000 // 日付跨ぎ
    
    total += rate
    current.setHours(current.getHours() + 1)
  }
  
  return total
}

/**
 * テストデータを削除する
 * @param {string} staffId - スタッフID
 */
export const deleteTestData = async (staffId: string) => {
  try {
    const supabase = createClient()
    
    // テストデータの削除
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('staff_id', staffId)
    
    if (error) throw error
    
    alert('テストデータを削除しました')
  } catch (error) {
    console.error('テストデータの削除に失敗:', error)
    alert('テストデータの削除に失敗しました')
  }
}