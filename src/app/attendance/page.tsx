'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import styles from './attendance.module.css'
import Link from 'next/link'
import { insertAndValidateTestData, deleteTestData } from './testData'

// 型定義
type Staff = {
  id: string
  name: string
}

type AttendanceRecord = {
  time: string
  date: string
  type: '出勤' | '退勤' | '休憩開始' | '休憩終了'
}

type WorkTime = {
  total: string
  name: string
  clockIn: string
  clockOut: string
}

type AttendanceStatus = {
  isWorking: boolean
  lastClockIn: string | null
  lastClockOut: string | null
}

// 勤務時間計算関数
const calculateWorkTime = (clockIn: string, clockOut: string) => {
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// データ整合性チェック
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

function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [workTime, setWorkTime] = useState<WorkTime | null>(null)
  const [status, setStatus] = useState<AttendanceStatus>({
    isWorking: false,
    lastClockIn: null,
    lastClockOut: null
  })
  const [error, setError] = useState<string | null>(null)

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!staffId) return
      
      try {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]
        
        // スタッフデータ取得
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single()

        // 勤怠データ取得
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', staffId)
          .gte('clock_in', today)
          .order('clock_in', { ascending: true })

        setStaff(staffData)
        
        if (attendanceData) {
          // データ整形
          const formattedRecords = attendanceData.map(record => ({
            time: new Date(record.clock_in).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }),
            date: new Date(record.clock_in).toLocaleDateString('ja-JP'),
            type: record.clock_out ? ('退勤' as const) : ('出勤' as const)
          }))
          
          setRecords(formattedRecords)
          
          // 有効な勤務記録を抽出
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
              clockIn: new Date(firstRecord.clock_in).toLocaleString('ja-JP'),
              clockOut: new Date(firstRecord.clock_out).toLocaleString('ja-JP')
            })
          }
          
          // ステータス更新
          const lastRecord = attendanceData[attendanceData.length - 1]
          setStatus({
            isWorking: lastRecord && !lastRecord.clock_out,
            lastClockIn: lastRecord?.clock_in || null,
            lastClockOut: lastRecord?.clock_out || null
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
        if (existingRecords?.some(r => !r.clock_out)) {
          throw new Error('既に出勤済みです')
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
        const lastClockIn = existingRecords?.find(r => !r.clock_out)
        if (!lastClockIn) throw new Error('出勤記録がありません')
        
        const { error } = await supabase
          .from('attendance')
          .update({ clock_out: now.toISOString() })
          .eq('id', lastClockIn.id)
          
        if (error) throw error
        
        // 勤務時間計算
        const total = calculateWorkTime(lastClockIn.clock_in, now.toISOString())
        setWorkTime({
          total,
          name: staff.name,
          clockIn: new Date(lastClockIn.clock_in).toLocaleString('ja-JP'),
          clockOut: now.toLocaleString('ja-JP')
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
          time: new Date(record.clock_in).toLocaleTimeString('ja-JP'),
          date: new Date(record.clock_in).toLocaleDateString('ja-JP'),
          type: record.clock_out ? '退勤' : '出勤'
        })))
        
        setStatus({
          isWorking: updatedRecords.some(r => !r.clock_out),
          lastClockIn: updatedRecords[0]?.clock_in || null,
          lastClockOut: updatedRecords.find(r => r.clock_out)?.clock_out || null
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
        <p className={status.isWorking ? styles.working : styles.notWorking}>
          {status.isWorking ? '勤務中' : '退勤済み'}
        </p>
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
        <h2>本日の記録</h2>
        {records.length > 0 ? (
          records.map((record, i) => (
            <div key={i} className={styles.record}>
              <span>{record.date} {record.time}</span>
              <span className={record.type === '出勤' ? styles.clockIn : styles.clockOut}>
                {record.type}
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

export default function AttendancePage() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}