'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import styles from './attendance.module.css'
import Link from 'next/link'
import { insertAndValidateTestData, deleteTestData } from './testData'

/**
 * スタッフ情報の型定義
 * @typedef {Object} Staff
 * @property {string} id - スタッフの一意のID
 * @property {string} name - スタッフの名前
 */
type Staff = {
  id: string
  name: string
}

/**
 * 出退勤記録の型定義
 * @typedef {Object} AttendanceRecord
 * @property {string} time - 記録時間（HH:mm形式）
 * @property {('出勤'|'退勤'|'休憩開始'|'休憩終了')} type - 記録の種類
 */
type AttendanceRecord = {
  time: string
  type: '出勤' | '退勤' | '休憩開始' | '休憩終了'
}

/**
 * 勤務時間の型定義
 * @typedef {Object} WorkTime
 * @property {string} total - 勤務時間の合計（例：8時間30分）
 * @property {string} name - スタッフの名前
 */
type WorkTime = {
  total: string
  name: string
}

/**
 * 出退勤ステータスの型定義
 * @typedef {Object} AttendanceStatus
 * @property {boolean} isWorking - 勤務中かどうか
 * @property {string | null} lastClockIn - 最後の出勤時間（ISO形式）
 * @property {string | null} lastClockOut - 最後の退勤時間（ISO形式）
 */
type AttendanceStatus = {
  isWorking: boolean
  lastClockIn: string | null
  lastClockOut: string | null
}

/**
 * 勤務時間を計算する関数
 * @param {string} clockIn - 出勤時間
 * @param {string} clockOut - 退勤時間
 * @returns {Array<{date: string, start: string, end: string, minutes: number}>} 日付ごとの勤務時間
 */
const calculateWorkTimeByDate = (clockIn: string, clockOut: string) => {
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const results = []

  // 日付が同じ場合
  if (start.toDateString() === end.toDateString()) {
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
    results.push({
      date: start.toISOString().split('T')[0],
      start: start.toISOString(),
      end: end.toISOString(),
      minutes
    })
  } else {
    // 日付を跨ぐ場合
    const midnight = new Date(start)
    midnight.setHours(24, 0, 0, 0)
    
    // 1日目の勤務時間
    const firstDayMinutes = Math.floor((midnight.getTime() - start.getTime()) / (1000 * 60))
    results.push({
      date: start.toISOString().split('T')[0],
      start: start.toISOString(),
      end: midnight.toISOString(),
      minutes: firstDayMinutes
    })

    // 2日目以降の勤務時間
    const nextDay = new Date(midnight)
    nextDay.setDate(nextDay.getDate() + 1)
    const lastDayMinutes = Math.floor((end.getTime() - nextDay.getTime()) / (1000 * 60))
    results.push({
      date: nextDay.toISOString().split('T')[0],
      start: nextDay.toISOString(),
      end: end.toISOString(),
      minutes: lastDayMinutes
    })
  }

  return results
}

/**
 * 月間の勤務時間を計算する関数
 * @param {Array<{clock_in: string, clock_out: string}>} records - 勤務記録
 * @returns {string} 合計勤務時間（HH:MM形式）
 */
const calculateMonthlyWorkTime = (records: { clock_in: string; clock_out: string }[]) => {
  let totalMinutes = 0
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  records.forEach(record => {
    const clockIn = new Date(record.clock_in)
    const clockOut = new Date(record.clock_out)

    // 今月の記録のみを計算
    if (clockIn >= firstDayOfMonth && clockIn <= lastDayOfMonth) {
      const workTimes = calculateWorkTimeByDate(record.clock_in, record.clock_out)
      workTimes.forEach(workTime => {
        totalMinutes += workTime.minutes
      })
    }
  })

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * 出退勤管理のメインコンポーネント
 * @returns {JSX.Element} 出退勤管理画面
 */
function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [workTime, setWorkTime] = useState<WorkTime | null>(null)
  const [status, setStatus] = useState<AttendanceStatus>({
    isWorking: false,
    lastClockIn: null,
    lastClockOut: null
  })

  /**
   * 初期データを取得する
   * @returns {Promise<void>}
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!staffId) return
      
      try {
        const supabase = createClient()
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single()

        const today = new Date().toISOString().split('T')[0]
        const { data: recordsData } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', staffId)
          .gte('clock_in', today)
          .order('clock_in', { ascending: true })

        setStaff(staffData)
        if (recordsData) {
          const formattedRecords = recordsData.map(record => ({
            time: new Date(record.clock_in).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }),
            type: record.clock_out ? ('退勤' as const) : ('出勤' as const)
          }))
          setRecords(formattedRecords)

          // 勤務時間の計算
          const completedRecords = recordsData.filter(record => record.clock_out)
          if (completedRecords.length > 0) {
            const totalWorkTime = calculateMonthlyWorkTime(completedRecords)
            setWorkTime({
              total: totalWorkTime,
              name: staffData.name
            })
          }

          // ステータスの更新
          const latestRecord = recordsData[recordsData.length - 1]
          setStatus({
            isWorking: latestRecord && !latestRecord.clock_out,
            lastClockIn: latestRecord?.clock_in || null,
            lastClockOut: latestRecord?.clock_out || null
          })
        }
      } catch (err) {
        console.error('初期データの取得に失敗:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [staffId])

  /**
   * 出退勤記録を処理する
   * @param {AttendanceRecord['type']} type - 記録の種類（出勤/退勤/休憩開始/休憩終了）
   * @returns {Promise<void>}
   */
  const handleAttendance = async (type: AttendanceRecord['type']) => {
    try {
      const now = new Date()
      const time = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      if (!staff) {
        throw new Error('スタッフ情報が見つかりません')
      }
      
      const supabase = createClient()
      
      // 本日の記録を取得
      const today = new Date().toISOString().split('T')[0]
      const { data: todayRecords, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: true })

      if (fetchError) {
        console.error('記録の取得に失敗:', fetchError)
        throw new Error('記録の取得に失敗しました')
      }

      // 記録の整合性チェック
      if (todayRecords) {
        const hasUnfinishedRecord = todayRecords.some(record => !record.clock_out)
        const hasFinishedRecord = todayRecords.some(record => record.clock_out)

        if (type === '出勤') {
          if (hasUnfinishedRecord) {
            throw new Error('既に出勤済みです')
          }
          if (hasFinishedRecord) {
            throw new Error('本日は既に退勤済みです')
          }
        } else if (type === '退勤') {
          if (!hasUnfinishedRecord) {
            throw new Error('出勤記録がありません')
          }
        }
      }

      if (type === '出勤') {
        const { error } = await supabase
          .from('attendance')
          .insert({
            staff_id: staff.id,
            clock_in: now.toISOString()
          })
          .select()
          
          if (error) {
            console.error('出勤記録の保存に失敗:', error)
            throw new Error(`出勤記録の保存に失敗しました: ${error.message}`)
          }

          // ステータスの更新
          setStatus({
            isWorking: true,
            lastClockIn: now.toISOString(),
            lastClockOut: null
          })

          // 出勤成功時のアラート
          alert(`${time}に出勤しました`)
      } else if (type === '退勤') {
        // 最新の未退勤記録を取得
        const { data: latestRecord, error: fetchLatestError } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', staff.id)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1)
          .single()

        if (fetchLatestError) {
          console.error('最新の記録取得に失敗:', fetchLatestError)
          throw new Error('最新の記録取得に失敗しました')
        }

        if (!latestRecord) {
          throw new Error('退勤対象の出勤記録が見つかりません')
        }

        const { error } = await supabase
          .from('attendance')
          .update({
            clock_out: now.toISOString()
          })
          .eq('id', latestRecord.id)
          .select()
          
          if (error) {
            console.error('退勤記録の更新に失敗:', error)
            throw new Error(`退勤記録の更新に失敗しました: ${error.message}`)
          }

          // ステータスの更新
          setStatus({
            isWorking: false,
            lastClockIn: latestRecord.clock_in,
            lastClockOut: now.toISOString()
          })

          // 勤務時間の計算
          const workTimes = calculateWorkTimeByDate(latestRecord.clock_in, now.toISOString())
          const totalMinutes = workTimes.reduce((sum, workTime) => sum + workTime.minutes, 0)
          const hours = Math.floor(totalMinutes / 60)
          const minutes = totalMinutes % 60
          const workTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

          // 退勤成功時のアラート
          alert(`${time}に退勤しました\n勤務時間: ${workTimeStr}`)

          // 月間勤務時間の計算
          const { data: monthlyRecords } = await supabase
            .from('attendance')
            .select('*')
            .eq('staff_id', staff.id)
            .not('clock_out', 'is', null)
            .order('clock_in', { ascending: true })

          if (monthlyRecords) {
            const monthlyWorkTime = calculateMonthlyWorkTime(monthlyRecords)
            setWorkTime({
              total: monthlyWorkTime,
              name: staff.name
            })
          }
      }

      // 記録の更新
      const { data: updatedRecords } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: true })

      if (updatedRecords) {
        const formattedRecords = updatedRecords.map(record => ({
          time: new Date(record.clock_in).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
          type: record.clock_out ? ('退勤' as const) : ('出勤' as const)
        }))
        setRecords(formattedRecords)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました')
      console.error('勤怠管理レコードの保存に失敗しました', error)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>スタッフ情報が見つかりません</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{staff.name}さんの出退勤</h1>
        <Link href="/" className={styles.backButton}>
          トップへ戻る
        </Link>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.status}>
        <h2 className={styles.subtitle}>現在のステータス</h2>
        {status.lastClockIn && (
          <>
            <p className={status.isWorking ? styles.working : styles.notWorking}>
              {status.isWorking ? '勤務中' : '退勤済み'}
            </p>
            <p className={styles.lastRecord}>
              最終{status.isWorking ? '出勤' : '退勤'}: {new Date(status.lastClockIn).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </p>
          </>
        )}
      </div>

      {workTime && (
        <div className={styles.workTime}>
          <h2 className={styles.subtitle}>本日の勤務時間</h2>
          <p>{workTime.name}さん: {workTime.total}</p>
        </div>
      )}

      <div className={styles.actionButtons}>
        <button 
          className={styles.buttonPrimary}
          onClick={() => handleAttendance('出勤')}
          disabled={status.isWorking}
        >
          出勤
        </button>
        <button 
          className={styles.buttonDanger}
          onClick={() => handleAttendance('退勤')}
          disabled={!status.isWorking}
        >
          退勤
        </button>
        <button 
          className={styles.buttonSecondary}
          onClick={() => handleAttendance('休憩開始')}
          disabled={!status.isWorking}
        >
          休憩開始
        </button>
        <button 
          className={styles.buttonSecondary}
          onClick={() => handleAttendance('休憩終了')}
          disabled={!status.isWorking}
        >
          休憩終了
        </button>
      </div>

      <div className={styles.recordList}>
        <h2 className={styles.subtitle}>本日の記録</h2>
        {records.length > 0 ? (
          records.map((record, index) => (
            <div key={index} className={styles.recordItem}>
              <span className={styles.recordTime}>{record.time}</span>
              <span className={styles.recordType}>{record.type}</span>
            </div>
          ))
        ) : (
          <div className={styles.recordItem}>
            <span className={styles.recordTime}>--:--</span>
            <span className={styles.recordType}>記録なし</span>
          </div>
        )}
      </div>

      {staff && (
        <div className={styles.testButtons}>
          <button 
            className={styles.buttonTest}
            onClick={() => insertAndValidateTestData(staff.id)}
          >
            テストデータ挿入
          </button>
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
 * 出退勤ページのルートコンポーネント
 * @returns {JSX.Element} Suspenseでラップされた出退勤管理画面
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<div className={styles.container}>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
} 