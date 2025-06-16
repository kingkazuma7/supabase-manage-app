import { createClient } from '../utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * テストデータのパターン定義
 */
export type TestPattern = {
  name: string
  description: string
  generate: () => Array<{clock_in: string, clock_out: string | null, expected_wage: number}>
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
 * 夜勤パターン（20:00-23:30）
 */
const nightPattern: TestPattern = {
  name: '夜勤',
  description: '20:00-23:30（3.5時間）',
  generate: () => {
    const today = new Date()
    return [{
      clock_in: new Date(today.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(23, 30, 0)).toISOString(),
      expected_wage: (2 * 1500) + (1.5 * 1875) // 20:00-22:00, 22:00-23:30
    }]
  }
}

/**
 * 日付跨ぎパターン（21:00-翌日2:30）
 */
const crossDayPattern: TestPattern = {
  name: '日付跨ぎ',
  description: '21:00-翌日2:30（5.5時間）',
  generate: () => {
    const today = new Date()
    const nextDay = new Date(today)
    nextDay.setDate(today.getDate() + 1)
    
    return [{
      clock_in: new Date(today.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
      expected_wage: (3 * 1875) + (2.5 * 2000) // 21:00-24:00, 24:00-02:30
    }]
  }
}

/**
 * 複数日パターン（3日分）
 */
const multiDayPattern: TestPattern = {
  name: '複数日',
  description: '3日分の勤務パターン',
  generate: () => {
    const today = new Date()
    const data = []
    
    // 1日目：通常勤務（今日）
    data.push({
      clock_in: new Date(today.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(today.setHours(18, 0, 0)).toISOString(),
      expected_wage: 9 * 1500
    })
    
    // 2日目：夜勤（明日）
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    data.push({
      clock_in: new Date(tomorrow.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(tomorrow.setHours(23, 30, 0)).toISOString(),
      expected_wage: (2 * 1500) + (1.5 * 1875)
    })
    
    // 3日目：日付跨ぎ（明後日）
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(tomorrow.getDate() + 1)
    const nextDay = new Date(dayAfterTomorrow)
    nextDay.setDate(dayAfterTomorrow.getDate() + 1)
    data.push({
      clock_in: new Date(dayAfterTomorrow.setHours(21, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 30, 0)).toISOString(),
      expected_wage: (3 * 1875) + (2.5 * 2000)
    })
    
    return data
  }
}

/**
 * 利用可能なテストパターン
 */
export const testPatterns: TestPattern[] = [
  normalPattern,
  nightPattern,
  crossDayPattern,
  multiDayPattern
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
          clock_out: record.clock_out
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