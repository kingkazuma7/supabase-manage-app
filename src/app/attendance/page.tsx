'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'
import styles from './attendance.module.css'
import Link from 'next/link'
import { insertAndValidateTestData, deleteTestData, testPatterns } from './testData'

/**
 * スタッフ情報の型定義
 * @typedef {Object} Staff
 * @property {string} id - スタッフID
 * @property {string} name - スタッフ名
 */
type Staff = {
  id: string
  name: string
}

/**
 * 勤怠記録の型定義
 * @typedef {Object} AttendanceRecord
 * @property {string} date - 記録日付（YYYY/MM/DD形式）
 * @property {string} clockIn - 出勤時間（HH:mm形式）
 * @property {string | null} clockOut - 退勤時間（HH:mm形式）
 * @property {boolean} isCrossDay - 日付跨ぎフラグ
 * @property {string} originalClockIn - 出勤時間（ISO形式、計算用）
 * @property {string | null} originalClockOut - 退勤時間（ISO形式、計算用）
 */
type AttendanceRecord = {
  date: string;
  clockIn: string;
  clockOut: string | null;
  isCrossDay: boolean;
  originalClockIn: string; // ISO形式の出勤時間（正確な計算用）
  originalClockOut: string | null; // ISO形式の退勤時間（正確な計算用）
}

/**
 * 勤務時間情報の型定義
 * @typedef {Object} WorkTime
 * @property {string} total - 総勤務時間（HH:mm形式）
 * @property {string} name - スタッフ名
 * @property {string} clockIn - 出勤時間
 * @property {string} clockOut - 退勤時間
 */
type WorkTime = {
  total: string
  name: string
  clockIn: string
  clockOut: string
}

/**
 * 勤怠ステータスの型定義
 * @typedef {Object} AttendanceStatus
 * @property {boolean} isWorking - 勤務中かどうか
 * @property {string | null} lastClockIn - 最終出勤時間（ISO形式）
 * @property {string | null} lastClockOut - 最終退勤時間（ISO形式）
 * @property {'勤務中' | '退勤済み' | null} status - 勤怠ステータス
 */
type AttendanceStatus = {
  isWorking: boolean
  lastClockIn: string | null
  lastClockOut: string | null
  status: '勤務中' | '退勤済み' | null
}

// 追加：月次合計の型定義
type MonthlyTotal = {
    hours: number;
    minutes: number;
};

/**
 * 勤務時間の合計を計算する（出勤から退勤までの純粋な総時間）
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @returns {string} 勤務時間（HH:mm形式）
 */
const calculateWorkTime = (clockIn: string, clockOut: string): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  
  if (diffMinutes < 0) {
    // 退勤時間が出勤時間より前の場合など、不正な場合は0を返す
    return '00:00';
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};


/**
 * 指定された期間 (periodStart - periodEnd) 内の勤務時間を計算する
 * 月をまたぐ勤務でも、指定期間内の時間のみを正確に集計します。
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {Date} periodStart - 期間開始日 (Dateオブジェクト)
 * @param {Date} periodEnd - 期間終了日 (Dateオブジェクト)
 * @returns {string} 勤務時間（HH:mm形式）
 */
const calculateWorkTimeForPeriod = (clockIn: string, clockOut: string, periodStart: Date, periodEnd: Date): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  // 勤務開始と期間開始の遅い方
  const effectiveStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
  // 勤務終了と期間終了の早い方
  const effectiveEnd = new Date(Math.min(end.getTime(), periodEnd.getTime()));
  
  // 期間内に勤務がない場合や、期間が逆転している場合は00:00を返す
  if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
      return '00:00';
  }

  const diffMinutes = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 勤務時間の合計分数を取得するヘルパー関数
 * @param {string} timeString - HH:mm形式の文字列
 * @returns {number} 合計分数
 */
const getMinutesFromHHMM = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};


/**
 * 勤怠記録の整合性をチェックする
 * 連続した出勤打刻、退勤打刻なしの状態で退勤打刻などを検出します。
 * @param {Array<{clock_in: string; clock_out: string | null}>} records - 勤怠記録の配列
 * @returns {boolean} 整合性が取れている場合はtrue
 */
const validateRecords = (records: { clock_in: string; clock_out: string | null }[]) => {
  if (records.length === 0) return true;
  
  let hasUnclockedOut = false; // 未退勤の記録があるか
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record.clock_out) {
      if (hasUnclockedOut) {
        // 既に未退勤の記録があるのに、また未退勤の記録があった場合（不正）
        return false;
      }
      hasUnclockedOut = true;
    }
  }
  return true;
};

/**
 * 勤怠管理のメインコンポーネント
 * @returns {JSX.Element} 勤怠管理画面
 */
function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [workTime, setWorkTime] = useState<WorkTime | null>(null) // 本日の勤務時間
  const [status, setStatus] = useState<AttendanceStatus>({
    isWorking: false,
    lastClockIn: null,
    lastClockOut: null,
    status: null
  })
  const [error, setError] = useState<string | null>(null)
  const [isTodayCompleted, setIsTodayCompleted] = useState(false)
  const [monthlyTotal, setMonthlyTotal] = useState<MonthlyTotal | null>(null); // 月次合計勤務時間

  const fetchData = useCallback(async () => {
    if (!staffId) return;
    
    try {
      const supabase = createClient();
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // 今月の月初と月末 (期間計算の基準となる日付)
      const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

      // 前月の月初と月末 (月跨ぎ勤務の出勤日取得のため)
      const firstDayOfPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
      
      // スタッフデータ取得
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .single();
      
      if (staffError) throw staffError;
      setStaff(staffData);

      // 勤怠データ取得
      // 取得範囲: 前月の月初から今月の月末まで（月跨ぎ勤務を確実に取得するため）
      // clock_in が前月の月初から今月の月末まで、または
      // clock_in が前月以前でも clock_out が今月以降のものを取得
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
        // 今日の出勤記録があり、かつ退勤記録もあるか
        const todayCompleted = attendanceData.some(record => 
          record.clock_in && new Date(record.clock_in).toISOString().split('T')[0] === todayIso && record.clock_out
        );
        setIsTodayCompleted(todayCompleted);

        // データ整形と月次合計の計算
        let totalMonthlyMinutes = 0;
        const formattedRecords: AttendanceRecord[] = [];
        
        attendanceData.forEach(record => {
          const recordClockIn = new Date(record.clock_in);
          const recordClockOut = record.clock_out ? new Date(record.clock_out) : null;

          // 「〇月の記録」に表示するレコードをフィルタリング (出勤日基準で当月分)
          // または、出勤が前月でも退勤が当月にある場合は表示
          if (recordClockIn.getMonth() === currentMonth || (recordClockOut && recordClockOut.getMonth() === currentMonth && recordClockIn.getMonth() !== currentMonth)) {
                const isCrossDay = recordClockOut ? recordClockIn.toDateString() !== recordClockOut.toDateString() : false;

                formattedRecords.push({
                    date: recordClockIn.toLocaleDateString('ja-JP'),
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: recordClockOut ? recordClockOut.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5) : null,
                    isCrossDay,
                    originalClockIn: record.clock_in, // ISO形式で保持
                    originalClockOut: record.clock_out // ISO形式で保持
                });
            }

            // 「本日の勤務時間」の更新
            // 今日出勤した記録で、かつ退勤済みの場合
            if (recordClockIn.toISOString().split('T')[0] === todayIso && record.clock_out) {
                setWorkTime({
                    total: calculateWorkTime(record.clock_in, record.clock_out),
                    name: staffData.name,
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: recordClockOut!.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5)
                });
            } else if (recordClockIn.toISOString().split('T')[0] === todayIso && !record.clock_out) {
                // 今日出勤したがまだ退勤していない場合
                setWorkTime({
                    total: '勤務中', // またはリアルタイム計算するなど
                    name: staffData.name,
                    clockIn: recordClockIn.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5),
                    clockOut: '未退勤'
                });
            }

            // 月累計の勤務時間計算 (当月分のみを抽出して合計)
            if (record.clock_out) {
                // 勤務期間が当月と重なる部分を抽出して加算
                const segmentMinutes = getMinutesFromHHMM(
                    calculateWorkTimeForPeriod(record.clock_in, record.clock_out, firstDayOfCurrentMonth, lastDayOfCurrentMonth)
                );
                totalMonthlyMinutes += segmentMinutes;
            }
        });
        
        // 取得したレコードを日付順にソート (重複表示を防ぐため)
        formattedRecords.sort((a, b) => new Date(a.originalClockIn).getTime() - new Date(b.originalClockIn).getTime());
        setRecords(formattedRecords);
        
        setMonthlyTotal({
            hours: Math.floor(totalMonthlyMinutes / 60),
            minutes: totalMonthlyMinutes % 60
        });

        // ステータス更新
        // 最新の未退勤記録を探す
        const lastUnclockedOut = attendanceData.findLast(r => !r.clock_out);
        // 最新の退勤済み記録を探す
        const lastClockedOut = attendanceData.findLast(r => r.clock_out);

        const currentStatus: AttendanceStatus = {
            isWorking: !!lastUnclockedOut,
            lastClockIn: lastUnclockedOut?.clock_in || lastClockedOut?.clock_in || null,
            lastClockOut: lastUnclockedOut ? null : (lastClockedOut?.clock_out || null),
            status: lastUnclockedOut ? '勤務中' : (lastClockedOut ? '退勤済み' : null)
        };
        setStatus(currentStatus);
        
        // 整合性チェック
        if (!validateRecords(attendanceData)) {
          setError('記録に不整合があります。管理者に連絡してください。');
        } else {
            setError(null); // エラーがなければクリア
        }
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    }
  }, [staffId]);

  // データ取得をuseEffectでトリガー
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 出退勤処理
  const handleAttendance = async (type: '出勤' | '退勤') => {
    try {
      if (!staff) throw new Error('スタッフ情報がありません');
      
      const supabase = createClient();
      const now = new Date();
      const todayIso = now.toISOString().split('T')[0];
      
      // 既存記録取得（直近の未退勤記録を確認するため、本日以降のデータに限定しない）
      const { data: allRecentRecords, error: recentRecordsError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .order('clock_in', { ascending: false }) // 最新の記録を最初に取得
        .limit(1); // 直近の1件のみ取得

      if (recentRecordsError) throw recentRecordsError;

      const latestRecord = allRecentRecords ? allRecentRecords[0] : null;

      // バリデーション
      if (type === '出勤') {
        if (latestRecord && !latestRecord.clock_out) {
          throw new Error('既に勤務中の記録があります。');
        }
        
        // 本日中に退勤済みの場合、再度出勤させない
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
        
        // 退勤時間が現在時刻より過去にならないようにチェック
        if (new Date(latestRecord.clock_in).getTime() > now.getTime()) {
            throw new Error('出勤時間より前の時刻に退勤することはできません。');
        }

        const { error } = await supabase
          .from('attendance')
          .update({ clock_out: now.toISOString() })
          .eq('id', latestRecord.id); // 最新の未退勤レコードを更新
          
        if (error) throw error;
      }
      
      // データ再取得してUIを更新
      await fetchData();
      setError(null); // エラーがあればクリア
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    }
  };

  // データ修復関数
  const fixData = async () => {
    if (!staff) return;
    
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      
      // 今日の記録を取得 (出勤日が今日以降、または退勤日が今日以降の未退勤記録)
      const { data: recordsToFix, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .or(`clock_in.gte.${today},clock_out.gte.${today}`)
        .order('clock_in', { ascending: true });

      if (fetchError) throw fetchError;
      
      if (recordsToFix && recordsToFix.length > 0) {
        // 未退勤の記録を全て取得
        const unclockedOutRecords = recordsToFix.filter(r => !r.clock_out);
        
        let idsToDelete: string[] = [];

        if (unclockedOutRecords.length > 1) {
            // 複数の未退勤記録がある場合、最新のもの以外を削除
            const latestUnclockedOut = unclockedOutRecords.pop(); // 最新の未退勤記録
            idsToDelete = unclockedOutRecords.map(r => r.id); // それ以外を削除対象に
        }

        // また、同じ日に複数回出退勤記録があり、その整合性が取れていない場合に備え、
        // 簡易的に最新の記録以外を削除するロジックを検討しても良いが、ここでは未退勤の重複に絞る
        // より複雑な整合性問題は手動または管理画面での対応が良い

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
        await fetchData(); // データ再取得
      } else {
          alert('修復対象となるデータがありません。');
      }
    } catch (err) {
      console.error('データ修復エラー:', err);
      setError('修復に失敗しました');
    }
  };

  if (!staff) return <div className={styles.loading}>読み込み中...</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{staff.name}さんの勤怠管理</h1>
        <Link href="/">トップへ戻る</Link>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          {error.includes('不整合') && (
            <button onClick={fixData} className={styles.fixButton}>
              データ修復（重複出勤記録の解消）
            </button>
          )}
        </div>
      )}

      <div className={styles.status}>
        <h2>現在のステータス</h2>
        {status.status ? (
          <p className={styles[status.status === '勤務中' ? 'working' : 'notWorking']}>
            {status.status}
          </p>
        ) : (
          <p className={styles.noStatus}>-</p>
        )}
      </div>

      {workTime && (
        <div className={styles.workTime}>
          <h2>本日の勤務時間</h2>
          <p>{workTime.name}さん</p>
          <p>勤務時間: {workTime.total}</p>
          <p>出勤: {workTime.clockIn}</p>
          <p>退勤: {workTime.clockOut}</p>
        </div>
      )}

      {monthlyTotal && (
        <div className={styles.monthlyTotal}>
          当月合計: {(() => {
            const totalMinutes = records.reduce((total, record) => {
              if (record.clockOut && record.originalClockIn && record.originalClockOut) {
                const time = calculateWorkTimeForPeriod(
                  record.originalClockIn,
                  record.originalClockOut,
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999)
                );
                const [hours, minutes] = time.split(':').map(Number);
                return total + hours * 60 + minutes;
              }
              return total;
            }, 0);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          })()}
        </div>
      )}

      <div className={styles.records}>
        <h2>{new Date().getMonth() + 1}月の記録</h2>
        {records.length > 0 ? (
          <>
            {records.map((record, i) => (
              <div key={i} className={styles.record}>
                <span className={styles.recordDate}>{record.date}</span>
                <span className={styles.recordTime}>
                  {record.clockIn} - {record.clockOut || '退勤未記録'}
                  {record.isCrossDay && (
                    <span className={styles.crossDayBadge}>日付跨ぎ</span>
                  )}
                  {record.clockOut && record.originalClockIn && record.originalClockOut && (
                    <span className={styles.calculatedWorkTime}>
                      勤務時間: {calculateWorkTime(
                        record.originalClockIn,
                        record.originalClockOut
                      )}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p>記録がありません</p>
        )}
      </div>

      <div className={styles.actionButtons}>
        <button
          className={styles.buttonPrimary}
          onClick={() => handleAttendance('出勤')}
          disabled={status.status === '勤務中' || isTodayCompleted}
        >
          出勤
        </button>
        <button
          className={styles.buttonDanger}
          onClick={() => handleAttendance('退勤')}
          disabled={status.status === '退勤済み' || !status.isWorking}
        >
          退勤
        </button>
      </div>

      {staff && (
        <div className={styles.testButtons}>
          <div className={styles.testPatterns}>
            <h3>テストパターン（本日分を上書き）</h3>
            {testPatterns.map(pattern => (
              <button 
                key={pattern.name}
                className={styles.buttonTest}
                onClick={() => insertAndValidateTestData(staff.id, pattern.name, createClient())}
              >
                {pattern.name}
                <span className={styles.patternDescription}>{pattern.description}</span>
              </button>
            ))}
          </div>
          <button 
            className={styles.buttonTest}
            onClick={() => deleteTestData(staff.id, createClient())}
          >
            テストデータ削除（本日分）
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 勤怠管理ページのルートコンポーネント
 * @returns {JSX.Element} Suspenseでラップされた勤怠管理画面
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}