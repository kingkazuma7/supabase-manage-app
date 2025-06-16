'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
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
 */
type AttendanceRecord = {
  date: string;
  clockIn: string;
  clockOut: string | null;
  isCrossDay: boolean;
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
 * @property {string | null} lastClockIn - 最終出勤時間
 * @property {string | null} lastClockOut - 最終退勤時間
 * @property {'勤務中' | '退勤済み' | null} status - 勤怠ステータス
 */
type AttendanceStatus = {
  isWorking: boolean
  lastClockIn: string | null
  lastClockOut: string | null
  status: '勤務中' | '退勤済み' | null
}

/**
 * 勤務時間を計算する
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @returns {string} 勤務時間（HH:mm形式）
 */
const calculateWorkTime = (clockIn: string, clockOut: string) => {
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  
  // 日付跨ぎの場合
  if (start.toDateString() !== end.toDateString()) {
    // 出勤日の24時までの時間
    const midnight = new Date(start)
    midnight.setHours(24, 0, 0, 0)
    const day1Minutes = Math.floor((midnight.getTime() - start.getTime()) / (1000 * 60))
    
    // 退勤日の0時からの時間
    const day2Start = new Date(end)
    day2Start.setHours(0, 0, 0, 0)
    const day2Minutes = Math.floor((end.getTime() - day2Start.getTime()) / (1000 * 60))
    
    // 合計時間（24時間を超える場合も正しく計算）
    const totalMinutes = day1Minutes + day2Minutes
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }
  
  // 同じ日の場合は通常計算
  const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * 勤怠記録の整合性をチェックする
 * @param {Array<{clock_in: string; clock_out: string | null}>} records - 勤怠記録の配列
 * @returns {boolean} 整合性が取れている場合はtrue
 */
const validateRecords = (records: { clock_in: string; clock_out: string | null }[]) => {
  if (records.length === 0) return true
  
  // 出勤→退勤の順序チェック
  let lastType: 'in' | 'out' | null = null
  for (const record of records) {
    if (!record.clock_out && lastType === 'in') return false
    lastType = record.clock_out ? 'out' : 'in'
  }
  
  return true
}

/**
 * 勤怠管理のメインコンポーネント
 * @returns {JSX.Element} 勤怠管理画面
 */
function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [workTime, setWorkTime] = useState<WorkTime | null>(null)
  const [status, setStatus] = useState<AttendanceStatus>({
    isWorking: false,
    lastClockIn: null,
    lastClockOut: null,
    status: null
  })
  const [error, setError] = useState<string | null>(null)
  const [isTodayCompleted, setIsTodayCompleted] = useState(false)

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!staffId) return
      
      try {
        const supabase = createClient()
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        
        // スタッフデータ取得
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single()

        // 勤怠データ取得（月間 + 前月の日付跨ぎ記録）
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', staffId)
          .or(`clock_in.gte.${firstDayOfMonth.toISOString()},and(clock_in.lt.${firstDayOfMonth.toISOString()},clock_out.gte.${firstDayOfMonth.toISOString()})`)
          .lte('clock_in', lastDayOfMonth.toISOString())
          .order('clock_in', { ascending: true })

        setStaff(staffData)
        
        if (attendanceData) {
          // 本日の出退勤完了チェック
          const today = new Date().toISOString().split('T')[0]
          const todayCompleted = attendanceData.some(record => 
            new Date(record.clock_in).toISOString().split('T')[0] === today && record.clock_out
          )
          setIsTodayCompleted(todayCompleted)
          
          // データ整形
          const formattedRecords = attendanceData.reduce<AttendanceRecord[]>((acc, record) => {
            const date = new Date(record.clock_in).toLocaleDateString('ja-JP');
            const time = new Date(record.clock_in).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).slice(0, 5);

            const isCrossDay = record.clock_out 
              ? new Date(record.clock_in).toDateString() !== new Date(record.clock_out).toDateString()
              : false;

            const existingRecordIndex = acc.findIndex(r => r.date === date);
            if (existingRecordIndex !== -1) {
              if (record.clock_out) {
                acc[existingRecordIndex].clockOut = new Date(record.clock_out).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }).slice(0, 5);
                acc[existingRecordIndex].isCrossDay = isCrossDay;
                acc[existingRecordIndex].originalClockOut = record.clock_out;
              }
            } else {
              acc.push({
                date,
                clockIn: time,
                clockOut: record.clock_out 
                  ? new Date(record.clock_out).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }).slice(0, 5)
                  : null,
                isCrossDay,
                originalClockIn: record.clock_in,
                originalClockOut: record.clock_out
              });
            }
            return acc;
          }, []);
          
          setRecords(formattedRecords);
          // 有効な勤務記録を抽出（月をまたぐ記録も含む）
          const validRecords = attendanceData.filter(record => 
            record.clock_in && record.clock_out
          )
          
          if (validRecords.length > 0) {
            const firstRecord = validRecords[0]
            const total = calculateWorkTime(
              firstRecord.clock_in, 
              firstRecord.clock_out
            )
            
            setWorkTime({
              total,
              name: staffData.name,
              clockIn: new Date(firstRecord.clock_in).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }).slice(0, 5),
              clockOut: new Date(firstRecord.clock_out).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }).slice(0, 5)
            })
          }
          
          // ステータス更新
          const lastRecord = attendanceData[attendanceData.length - 1]
          setStatus({
            isWorking: lastRecord && !lastRecord.clock_out,
            lastClockIn: lastRecord?.clock_in || null,
            lastClockOut: lastRecord?.clock_out || null,
            status: lastRecord 
              ? (lastRecord.clock_out ? '退勤済み' : '勤務中')
              : null
          })
          
          // 整合性チェック
          if (!validateRecords(attendanceData)) {
            setError('記録に不整合があります。管理者に連絡してください。')
          }
        }
      } catch (err) {
        console.error('データ取得エラー:', err)
        setError('データの取得に失敗しました')
      }
    }
    
    fetchData()
  }, [staffId])

  // 出退勤処理
  const handleAttendance = async (type: '出勤' | '退勤') => {
    try {
      if (!staff) throw new Error('スタッフ情報がありません')
      
      const supabase = createClient()
      const now = new Date()
      const today = new Date().toISOString().split('T')[0]
      
      // 既存記録取得
      const { data: existingRecords } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: true })
      
      // バリデーション
      if (type === '出勤') {
        // 本日の出勤記録をチェック
        const todayClockIn = existingRecords?.find(r => 
          new Date(r.clock_in).toISOString().split('T')[0] === today
        )
        
        if (todayClockIn) {
          throw new Error('本日は既に出勤済みです')
        }
        
        const { error } = await supabase
          .from('attendance')
          .insert({
            staff_id: staff.id,
            clock_in: now.toISOString()
          })
          
        if (error) throw error
      } 
      else if (type === '退勤') {
        // 本日の出勤記録をチェック
        const todayClockIn = existingRecords?.find(r => 
          new Date(r.clock_in).toISOString().split('T')[0] === today && !r.clock_out
        )
        
        if (!todayClockIn) {
          throw new Error('本日の出勤記録がありません')
        }
        
        // 本日の退勤記録をチェック
        const todayClockOut = existingRecords?.find(r => 
          new Date(r.clock_in).toISOString().split('T')[0] === today && r.clock_out
        )
        
        if (todayClockOut) {
          throw new Error('本日は既に退勤済みです')
        }
        
        const { error } = await supabase
          .from('attendance')
          .update({ clock_out: now.toISOString() })
          .eq('id', todayClockIn.id)
          
        if (error) throw error
        
        // 勤務時間計算
        const total = calculateWorkTime(todayClockIn.clock_in, now.toISOString())
        setWorkTime({
          total,
          name: staff.name,
          clockIn: new Date(todayClockIn.clock_in).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).slice(0, 5),
          clockOut: now.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).slice(0, 5)
        })
      }
      
      // データ再取得
      const { data: updatedRecords } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: true })
      
      if (updatedRecords) {
        setRecords(updatedRecords.map(record => ({
          date: new Date(record.clock_in).toLocaleDateString('ja-JP'),
          clockIn: new Date(record.clock_in).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).slice(0, 5),
          clockOut: record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).slice(0, 5) : null,
          isCrossDay: record.clock_out 
            ? new Date(record.clock_in).toDateString() !== new Date(record.clock_out).toDateString()
            : false
        })))
        
        setStatus({
          isWorking: updatedRecords.some(r => !r.clock_out),
          lastClockIn: updatedRecords[0]?.clock_in || null,
          lastClockOut: updatedRecords.find(r => r.clock_out)?.clock_out || null,
          status: updatedRecords.some(r => !r.clock_out) ? '勤務中' : '退勤済み'
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  // データ修復関数
  const fixData = async () => {
    if (!staff) return
    
    try {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]
      
      // 不正な記録を削除
      const { data: records } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: true })
      
      if (records && records.length > 2) {
        const validIds = [
          records[0].id, 
          records.find(r => r.clock_out)?.id
        ].filter(Boolean)
        
        await supabase
          .from('attendance')
          .delete()
          .not('id', 'in', `(${validIds.join(',')})`)
          .eq('staff_id', staff.id)
          
        alert('データを修復しました')
        window.location.reload()
      }
    } catch (err) {
      setError('修復に失敗しました')
    }
  }

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
              データ修復
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

      <div className={styles.records}>
        <h2>{new Date().getMonth() + 1}月の記録</h2>
        {records.length > 0 ? (
          records.map((record, i) => (
            <div key={i} className={styles.record}>
              <span className={styles.recordDate}>{record.date}</span>
              <span className={styles.recordTime}>
                {record.clockIn} - {record.clockOut || '退勤未記録'}
                {record.isCrossDay && (
                  <span className={styles.crossDayBadge}>日付跨ぎ</span>
                )}
                {record.clockOut && record.originalClockIn && record.originalClockOut && (
                  <span className={styles.workTime}>
                    勤務時間: {calculateWorkTime(
                      record.originalClockIn,
                      record.originalClockOut
                    )}
                  </span>
                )}
              </span>
            </div>
          ))
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
          disabled={status.status === '退勤済み' || isTodayCompleted || !status.lastClockIn}
        >
          退勤
        </button>
      </div>

      {staff && (
        <div className={styles.testButtons}>
          <div className={styles.testPatterns}>
            <h3>テストパターン</h3>
            {testPatterns.map(pattern => (
              <button 
                key={pattern.name}
                className={styles.buttonTest}
                onClick={() => insertAndValidateTestData(staff.id, pattern.name)}
              >
                {pattern.name}
                <span className={styles.patternDescription}>{pattern.description}</span>
              </button>
            ))}
          </div>
          <button 
            className={styles.buttonTest}
            onClick={() => deleteTestData(staff.id)}
          >
            テストデータ削除
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