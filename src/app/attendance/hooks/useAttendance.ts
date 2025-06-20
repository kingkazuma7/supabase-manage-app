import { useState, useCallback, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { Staff, AttendanceRecord, WorkTime, AttendanceStatus, MonthlyTotal } from '../types';
import { calculateWorkTime, calculateWorkTimeForPeriod, getMinutesFromHHMM, validateRecords } from '../utils/calculations';

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
        
        const todayCompleted = attendanceData.some(record => 
          record.clock_in && new Date(record.clock_in).toISOString().split('T')[0] === todayIso && record.clock_out
        );
        setIsTodayCompleted(todayCompleted);

        let totalMonthlyMinutes = 0;
        const formattedRecords: AttendanceRecord[] = [];
        
        attendanceData.forEach(record => {
          const recordClockIn = new Date(record.clock_in);
          const recordClockOut = record.clock_out ? new Date(record.clock_out) : null;

          if (recordClockIn.getMonth() === currentMonth || (recordClockOut && recordClockOut.getMonth() === currentMonth && recordClockIn.getMonth() !== currentMonth)) {
                const isCrossDay = recordClockOut ? recordClockIn.toDateString() !== recordClockOut.toDateString() : false;

                formattedRecords.push({
                    date: recordClockIn.toLocaleDateString('ja-JP'),
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: recordClockOut ? recordClockOut.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5) : null,
                    isCrossDay,
                    originalClockIn: record.clock_in,
                    originalClockOut: record.clock_out,
                    breakStart: record.break_start || null,
                    breakEnd: record.break_end || null
                });
            }

            if (recordClockIn.toISOString().split('T')[0] === todayIso && record.clock_out) {
                setWorkTime({
                    total: calculateWorkTime(record.clock_in, record.clock_out),
                    name: staffData.name,
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: recordClockOut!.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5)
                });
            } else if (recordClockIn.toISOString().split('T')[0] === todayIso && !record.clock_out) {
                setWorkTime({
                    total: '勤務中',
                    name: staffData.name,
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: '未退勤'
                });
            }

            if (record.clock_out) {
                const segmentMinutes = getMinutesFromHHMM(
                    calculateWorkTimeForPeriod(record.clock_in, record.clock_out, firstDayOfCurrentMonth, lastDayOfCurrentMonth)
                );
                totalMonthlyMinutes += segmentMinutes;
            }
        });
        
        formattedRecords.sort((a, b) => new Date(a.originalClockIn).getTime() - new Date(b.originalClockIn).getTime());
        setRecords(formattedRecords);
        
        setMonthlyTotal({
            hours: Math.floor(totalMonthlyMinutes / 60),
            minutes: totalMonthlyMinutes % 60
        });

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
          setError('記録に不整合があります。管理者に連絡してください。');
        } else {
            setError(null);
        }
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    }
  }, [staffId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAttendance = async (type: '出勤' | '退勤') => {
    try {
      if (!staff) throw new Error('スタッフ情報がありません');
      
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
          throw new Error('既に勤務中の記録があります。');
        }
        
        if (latestRecord && latestRecord.clock_out && new Date(latestRecord.clock_in).toISOString().split('T')[0] === todayIso) {
            throw new Error('本日は既に出勤・退勤済みです。');
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
            throw new Error('出勤時間より前の時刻に退勤することはできません。');
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
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    }
  };

  /**
   * 休憩開始・終了の処理を行う関数
   * @param {string} type - 休憩の種類（'休憩開始' | '休憩終了'）
   */
  
  const handleBreak = async (type: '休憩開始' | '休憩終了') => {
    try {
      if (!staff) throw new Error('スタッフ情報がありません');
      
      const supabase = createClient();
      const now = new Date();
      
      console.log('=== 休憩処理開始 ===');
      console.log('処理タイプ:', type);
      console.log('現在時刻:', now.toISOString());
      console.log('スタッフID:', staff.id);
      
      // 最新の勤怠記録を取得する部分
      const { data: allRecentRecords, error: recentRecordsError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .order('clock_in', { ascending: false })
        .limit(1);
      
      if (recentRecordsError) throw recentRecordsError; // エラーが発生した場合はエラーをスロー
      
      const latestRecord = allRecentRecords ? allRecentRecords[0] : null; // 最新の勤怠記録を取得 これは出勤記録
      
      if (!latestRecord || latestRecord.clock_out) throw new Error('勤務中の記録がありません。');
      
      if (type === '休憩開始') {
        // 休憩中の記録がある場合はエラーをスロー
        if (latestRecord.break_start && !latestRecord.break_end) {
          throw new Error('既に休憩中の記録があります。');
        }
        
        const { data: updateResult, error } = await supabase
          .from('attendance')
          .update({
            break_start: now.toISOString()
          })
          .eq('id', latestRecord.id)
          .select();
          
        console.log('更新結果:', updateResult);
        
        if (error) throw error;
      } else if (type === '休憩終了') {
        if (!latestRecord.break_start || latestRecord.break_end) {
          throw new Error('休憩開始記録がありません、または既に休憩終了済みです。');
        }
        
        if (new Date(latestRecord.break_start).getTime() > now.getTime()) {
            throw new Error('休憩開始時間より前の時刻に休憩終了することはできません。');
        }

        const { data: updateResult, error } = await supabase
          .from('attendance')
          .update({ break_end: now.toISOString() })
          .eq('id', latestRecord.id)
          .select();
          
        console.log('更新結果:', updateResult);
        console.log('更新エラー:', error);
        
        if (error) throw error;
      }
      
      console.log('=== 休憩処理完了 ===');
    } catch (error) {
      console.error('休憩処理エラー:', error);
      setError(error instanceof Error ? error.message : 'エラーが発生しました');
    }
    
    await fetchData(); // データを再取得
    setError(null); // エラーメッセージをクリア
  }
  
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