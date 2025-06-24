import { supabase } from '@/app/utils/supabaseClient';
import { AttendanceRecord } from '@/app/types/attendance';
import { addHours, subDays, subMonths, format, setHours, setMinutes } from 'date-fns';

export const insertAndValidateTestData = async (staffId: string, pattern: string) => {
  if (!staffId) return;

  const testData: Partial<AttendanceRecord>[] = [];
  const now = new Date();

  switch (pattern) {
    case '休憩付き通常勤務':
      // 10:00-19:00の通常勤務（1時間休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, 'yyyy-MM-dd'),
        start_time: format(setHours(setMinutes(now, 0), 10), 'HH:mm'),
        end_time: format(setHours(setMinutes(now, 0), 19), 'HH:mm'),
        break_start_time: format(setHours(setMinutes(now, 0), 13), 'HH:mm'),
        break_end_time: format(setHours(setMinutes(now, 0), 14), 'HH:mm'),
        status: '完了'
      });
      break;

    case '夜勤休憩付き':
      // 20:00-翌5:00の夜勤（1時間休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, 'yyyy-MM-dd'),
        start_time: format(setHours(setMinutes(now, 0), 20), 'HH:mm'),
        end_time: format(setHours(setMinutes(addHours(now, 24), 0), 5), 'HH:mm'),
        break_start_time: format(setHours(setMinutes(now, 0), 0), 'HH:mm'),
        break_end_time: format(setHours(setMinutes(now, 0), 1), 'HH:mm'),
        status: '完了'
      });
      break;

    case '日付跨ぎ休憩付き':
      // 22:00-翌3:00の深夜勤務（30分休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, 'yyyy-MM-dd'),
        start_time: format(setHours(setMinutes(now, 0), 22), 'HH:mm'),
        end_time: format(setHours(setMinutes(addHours(now, 24), 0), 3), 'HH:mm'),
        break_start_time: format(setHours(setMinutes(now, 30), 0), 'HH:mm'),
        break_end_time: format(setHours(setMinutes(now, 0), 1), 'HH:mm'),
        status: '完了'
      });
      break;

    case '複数日':
      // 過去3日分のデータ
      for (let i = 0; i < 3; i++) {
        const date = subDays(now, i);
        testData.push({
          staff_id: staffId,
          date: format(date, 'yyyy-MM-dd'),
          start_time: format(setHours(setMinutes(date, 0), 9), 'HH:mm'),
          end_time: format(setHours(setMinutes(date, 0), 18), 'HH:mm'),
          break_start_time: format(setHours(setMinutes(date, 0), 12), 'HH:mm'),
          break_end_time: format(setHours(setMinutes(date, 0), 13), 'HH:mm'),
          status: '完了'
        });
      }
      break;

    case '3ヶ月分':
      // 過去3ヶ月分のデータ（週5日勤務）
      for (let i = 0; i < 3; i++) {
        const monthStart = subMonths(now, i);
        for (let j = 0; j < 20; j++) {
          const date = subDays(monthStart, j);
          if ([0, 6].includes(date.getDay())) continue; // 土日はスキップ

          testData.push({
            staff_id: staffId,
            date: format(date, 'yyyy-MM-dd'),
            start_time: format(setHours(setMinutes(date, 0), 9), 'HH:mm'),
            end_time: format(setHours(setMinutes(date, 0), 18), 'HH:mm'),
            break_start_time: format(setHours(setMinutes(date, 0), 12), 'HH:mm'),
            break_end_time: format(setHours(setMinutes(date, 0), 13), 'HH:mm'),
            status: '完了'
          });
        }
      }
      break;
  }

  // データの挿入
  for (const record of testData) {
    const { error } = await supabase
      .from('attendance_records')
      .insert(record);

    if (error) {
      console.error('Error inserting test data:', error);
      return;
    }
  }
};

export const deleteTestData = async (staffId: string) => {
  if (!staffId) return;

  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error deleting test data:', error);
    return;
  }
}; 