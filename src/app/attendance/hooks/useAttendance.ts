import { useState, useCallback, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { Staff, AttendanceRecord, WorkTime, AttendanceStatus, MonthlyTotal } from '../types';
import { calculateWorkTime, calculateWorkTimeForPeriod, getMinutesFromHHMM, validateRecords, calculateActualWorkTime } from '../utils/calculations';
import { formatTimeString, formatDateJP } from '../utils/dateUtils';

// エラーメッセージの定数
const ATTENDANCE_ERRORS = {
  ALREADY_WORKING: '既に勤務中の記録があります。',
  ALREADY_COMPLETED: '本日は既に出勤・退勤済みです。',
  NO_STAFF_INFO: 'スタッフ情報がありません',
  INVALID_CLOCK_OUT: '出勤時間より前の時刻に退勤することはできません。',
  DATA_INCONSISTENCY: '記録に不整合があります。管理者に連絡してください。',
  FETCH_ERROR: 'データの取得に失敗しました',
  BREAK_ALREADY_STARTED: '既に休憩中の記録があります。',
  NO_BREAK_RECORD: '休憩開始記録がありません、または既に休憩終了済みです。',
  INVALID_BREAK_END: '休憩開始時間より前の時刻に休憩終了することはできません。'
} as const;

// 日付フォーマットの定数
const DATE_FORMAT = {
  TIME: { hour: '2-digit', minute: '2-digit', hour12: false } as const,
  LOCALE: 'ja-JP'
} as const;

// 勤務ステータスの定数
const WORK_STATUS = {
  WORKING: '勤務中',
  COMPLETED: '退勤済み',
  NOT_CLOCKED_OUT: '未退勤'
} as const;

/**
 * 時刻文字列を取得（HH:mm形式）
 */
const getTimeString = (date: Date): string => {
  return date.toLocaleTimeString(DATE_FORMAT.LOCALE, DATE_FORMAT.TIME).slice(0, 5);
};

/**
 * 勤怠管理のカスタムフック
 * 勤怠データの取得、更新、状態管理を行う
 * 
 * @param {string | null} staffId - スタッフID
 * @returns {Object} 勤怠管理に必要な状態と関数
 * @property {Staff | null} staff - スタッフ情報
 * @property {AttendanceRecord[]} records - 勤怠記録の配列
 * @property {WorkTime | null} workTime - 本日の勤務時間情報
 * @property {AttendanceStatus} status - 現在の勤怠ステータス
 * @property {string | null} error - エラーメッセージ
 * @property {boolean} isTodayCompleted - 本日の出退勤が完了しているか
 * @property {MonthlyTotal | null} monthlyTotal - 月次合計勤務時間
 * @property {number} viewYear - 表示中の年
 * @property {number} viewMonth - 表示中の月（0-11）
 * @property {Function} setViewYear - 表示年を設定する関数
 * @property {Function} setViewMonth - 表示月を設定する関数
 * @property {Function} handleAttendance - 出退勤処理を行う関数
 * @property {Function} fixData - データ修復を行う関数
 */
export const useAttendance = (staffId: string | null) => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [workTime, setWorkTime] = useState<WorkTime | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>({
    isWorking: false,
    lastClockIn: null,
    lastClockOut: null,
    status: null,
    isOnBreak: false,
    breakStart: null,
    isBreakCompleted: false
  });
  const [error, setError] = useState<string | null>(null);
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState<MonthlyTotal | null>(null);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  /**
   * 指定月の勤怠記録から合計実労働時間を計算する
   * 計算手順：
   * 1. 各記録の実労働時間を計算（勤務時間から休憩時間を引く）
   * 2. 月内の実労働時間のみを集計
   * 3. 160時間制限を適用
   * 
   * @param records - 勤怠記録の配列
   * @param firstDayOfMonth - 月初日
   * @param lastDayOfMonth - 月末日
   * @returns 月次合計実労働時間
   */
  const calculateMonthlyTotal = (
    records: {
      clock_in: string;
      clock_out: string | null;
      break_start: string | null;
      break_end: string | null;
    }[],
    firstDayOfMonth: Date,
    lastDayOfMonth: Date
  ): MonthlyTotal => {
    let totalMinutes = 0;
    let breakTotalMinutes = 0; // 総労働時間（分）
    const MAX_MONTHLY_MINUTES = 160 * 60; // 160時間制限（分換算）

    records.forEach(record => {
      if (!record.clock_out) return;

      // 月内の勤務時間を計算（月跨ぎ対応）
      const workMinutes = getMinutesFromHHMM(
        calculateWorkTimeForPeriod(
          record.clock_in,
          record.clock_out,
          firstDayOfMonth,
          lastDayOfMonth
        )
      );

      // 休憩時間を計算（休憩がある場合のみ）
      const breakMinutes = (record.break_start && record.break_end) ?
        getMinutesFromHHMM(calculateWorkTime(record.break_start, record.break_end)) : 0;

      // 総労働時間と総休憩時間を加算
      totalMinutes += workMinutes;
      breakTotalMinutes += breakMinutes;
    });

    let actualMinutes = Math.max(0, totalMinutes - breakTotalMinutes);
    actualMinutes = Math.min(actualMinutes, MAX_MONTHLY_MINUTES);

    return {
      hours: Math.floor(actualMinutes / 60),
      minutes: actualMinutes % 60
    };
  };

  /**
   * 日次の勤務情報を作成する
   */
  const createDailyWorkTime = (
    record: {
      clock_in: string;
      clock_out: string;
      break_start: string | null;
      break_end: string | null;
    },
    staffName: string
  ): WorkTime => {
    const recordClockIn = new Date(record.clock_in);
    const recordClockOut = new Date(record.clock_out);

    // 総勤務時間を計算（休憩時間を含む）
    const totalWorkTime = calculateWorkTime(record.clock_in, record.clock_out);

    // 実労働時間を計算（休憩時間を差し引く）
    const actualWorkTime = calculateActualWorkTime(
      record.clock_in,
      record.clock_out,
      record.break_start,
      record.break_end
    );

    // 休憩時間を計算
    const breakTime = record.break_start && record.break_end ?
      calculateWorkTime(record.break_start, record.break_end) : '00:00';

    return {
      total: totalWorkTime,
      actual: actualWorkTime,
      break: breakTime,
      name: staffName,
      clockIn: formatTimeString(recordClockIn),
      clockOut: formatTimeString(recordClockOut)
    };
  };

  const fetchData = useCallback(async () => {
    if (!staffId) return;
    
    try {
      const supabase = createClient();
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      const firstDayOfPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
      
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .single();
      
      if (staffError) throw staffError;
      setStaff(staffData);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staffId)
        .or(
          `and(clock_in.gte.${firstDayOfPreviousMonth.toISOString()},clock_in.lte.${lastDayOfCurrentMonth.toISOString()}),` +
          `and(clock_in.lt.${firstDayOfPreviousMonth.toISOString()},clock_out.gte.${firstDayOfCurrentMonth.toISOString()})`
        )
        .order('clock_in', { ascending: true });

      if (attendanceError) throw attendanceError;
      
      if (attendanceData) {
        const todayIso = now.toISOString().split('T')[0];
        
        // 本日の出退勤完了チェック
        const todayCompleted = attendanceData.some(record => 
          record.clock_in && 
          new Date(record.clock_in).toISOString().split('T')[0] === todayIso && 
          record.clock_out
        );
        setIsTodayCompleted(todayCompleted);

        // 月次合計時間の計算
        const monthlyTotal = calculateMonthlyTotal(
          attendanceData,
          firstDayOfCurrentMonth,
          lastDayOfCurrentMonth
        );
        setMonthlyTotal(monthlyTotal);

        // 勤怠記録の整形
        const formattedRecords = attendanceData
          .filter(record => {
            const recordClockIn = new Date(record.clock_in);
            const recordClockOut = record.clock_out ? new Date(record.clock_out) : null;
            return recordClockIn.getMonth() === currentMonth || 
                  (recordClockOut && recordClockOut.getMonth() === currentMonth && recordClockIn.getMonth() !== currentMonth);
          })
          .map(record => {
            const recordClockIn = new Date(record.clock_in);
            const recordClockOut = record.clock_out ? new Date(record.clock_out) : null;
            return {
              date: formatDateJP(recordClockIn),
              clockIn: formatTimeString(recordClockIn),
              clockOut: recordClockOut ? formatTimeString(recordClockOut) : null,
              isCrossDay: recordClockOut ? 
                recordClockIn.toDateString() !== recordClockOut.toDateString() : 
                false,
              originalClockIn: record.clock_in,
              originalClockOut: record.clock_out,
              breakStart: record.break_start || null,
              breakEnd: record.break_end || null
            };
          });

        setRecords(formattedRecords);

        // 本日の勤務時間設定
        const todayRecord = attendanceData.find(record => 
          new Date(record.clock_in).toISOString().split('T')[0] === todayIso
        );

        if (todayRecord) {
          if (todayRecord.clock_out) {
            setWorkTime(createDailyWorkTime(todayRecord, staffData.name));
          } else {
            setWorkTime({
              total: '勤務中',
              name: staffData.name,
              clockIn: formatTimeString(new Date(todayRecord.clock_in)),
              clockOut: '未退勤'
            });
          }
        }

        // 現在のステータス設定
        const lastUnclockedOut = attendanceData.findLast(r => !r.clock_out);
        const lastClockedOut = attendanceData.findLast(r => r.clock_out);

        const currentStatus: AttendanceStatus = {
          isWorking: !!lastUnclockedOut,
          lastClockIn: lastUnclockedOut?.clock_in || lastClockedOut?.clock_in || null,
          lastClockOut: lastUnclockedOut ? null : (lastClockedOut?.clock_out || null),
          status: lastUnclockedOut ? '勤務中' : (lastClockedOut ? '退勤済み' : null),
          isOnBreak: !!(lastUnclockedOut?.break_start && !lastUnclockedOut?.break_end),
          breakStart: lastUnclockedOut?.break_start || null,
          isBreakCompleted: !!(lastUnclockedOut?.break_start && lastUnclockedOut?.break_end)
        };
        setStatus(currentStatus);
        
        if (!validateRecords(attendanceData)) {
          setError(ATTENDANCE_ERRORS.DATA_INCONSISTENCY);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError(err instanceof Error ? err.message : ATTENDANCE_ERRORS.FETCH_ERROR);
    }
  }, [staffId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAttendance = async (type: '出勤' | '退勤') => {
    try {
      if (!staff) throw new Error(ATTENDANCE_ERRORS.NO_STAFF_INFO);
      
      const supabase = createClient();
      const now = new Date();
      const todayIso = now.toISOString().split('T')[0];
      
      const { data: allRecentRecords, error: recentRecordsError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .order('clock_in', { ascending: false })
        .limit(1);

      if (recentRecordsError) throw recentRecordsError;

      const latestRecord = allRecentRecords ? allRecentRecords[0] : null;

      if (type === '出勤') {
        if (latestRecord && !latestRecord.clock_out) {
          throw new Error(ATTENDANCE_ERRORS.ALREADY_WORKING);
        }
        
        if (latestRecord && latestRecord.clock_out && new Date(latestRecord.clock_in).toISOString().split('T')[0] === todayIso) {
          throw new Error(ATTENDANCE_ERRORS.ALREADY_COMPLETED);
        }

        const { error } = await supabase
          .from('attendance')
          .insert({
            staff_id: staff.id,
            clock_in: now.toISOString()
          });
          
        if (error) throw error;
      } 
      else if (type === '退勤') {
        if (!latestRecord || latestRecord.clock_out) {
          throw new Error('出勤記録がありません、または既に退勤済みです。');
        }
        
        if (new Date(latestRecord.clock_in).getTime() > now.getTime()) {
          throw new Error(ATTENDANCE_ERRORS.INVALID_CLOCK_OUT);
        }

        const { error } = await supabase
          .from('attendance')
          .update({ clock_out: now.toISOString() })
          .eq('id', latestRecord.id);
          
        if (error) throw error;
      }
      
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : ATTENDANCE_ERRORS.FETCH_ERROR);
    }
  };

  /**
   * 休憩開始・終了の処理を行う関数
   * @param {string} type - 休憩の種類（'休憩開始' | '休憩終了'）
   */
  
  const handleBreak = async (type: '休憩開始' | '休憩終了') => {
    try {
      if (!staff) throw new Error(ATTENDANCE_ERRORS.NO_STAFF_INFO);
      
      const supabase = createClient();
      const now = new Date();
      
      const { data: allRecentRecords, error: recentRecordsError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .order('clock_in', { ascending: false })
        .limit(1);
      
      if (recentRecordsError) throw recentRecordsError;
      
      const latestRecord = allRecentRecords ? allRecentRecords[0] : null;
      
      if (!latestRecord || latestRecord.clock_out) throw new Error('勤務中の記録がありません。');
      
      if (type === '休憩開始') {
        if (latestRecord.break_start && !latestRecord.break_end) {
          throw new Error(ATTENDANCE_ERRORS.BREAK_ALREADY_STARTED);
        }
        
        const { error } = await supabase
          .from('attendance')
          .update({
            break_start: now.toISOString()
          })
          .eq('id', latestRecord.id);
          
        if (error) throw error;
      } else if (type === '休憩終了') {
        if (!latestRecord.break_start || latestRecord.break_end) {
          throw new Error(ATTENDANCE_ERRORS.NO_BREAK_RECORD);
        }
        
        if (new Date(latestRecord.break_start).getTime() > now.getTime()) {
          throw new Error(ATTENDANCE_ERRORS.INVALID_BREAK_END);
        }

        const { error } = await supabase
          .from('attendance')
          .update({ break_end: now.toISOString() })
          .eq('id', latestRecord.id);
          
        if (error) throw error;
      }
      
      await fetchData();
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : ATTENDANCE_ERRORS.FETCH_ERROR);
    }
  };
  
  const fixData = async () => {
    if (!staff) return;
    
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      
      const { data: recordsToFix, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .or(`clock_in.gte.${today},clock_out.gte.${today}`)
        .order('clock_in', { ascending: true });

      if (fetchError) throw fetchError;
      
      if (recordsToFix && recordsToFix.length > 0) {
        const unclockedOutRecords = recordsToFix.filter(r => !r.clock_out);
        
        let idsToDelete: string[] = [];

        if (unclockedOutRecords.length > 1) {
            const latestUnclockedOut = unclockedOutRecords.pop();
            idsToDelete = unclockedOutRecords.map(r => r.id);
        }

        if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
            .from('attendance')
            .delete()
            .in('id', idsToDelete);

            if (deleteError) throw deleteError;
            alert('重複した出勤記録を削除し、データを修復しました。');
        } else {
            alert('修復する重複データはありませんでした。');
        }
        await fetchData();
      } else {
          alert('修復対象となるデータがありません。');
      }
    } catch (err) {
      console.error('データ修復エラー:', err);
      setError('修復に失敗しました');
    }
  };

  return {
    staff,
    records,
    workTime,
    status,
    error,
    isTodayCompleted,
    monthlyTotal,
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    handleAttendance,
    handleBreak,
    fixData
  };
}; 