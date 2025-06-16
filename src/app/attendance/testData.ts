import { createClient } from '../utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 時間帯別給与計算を検証するためのテストデータ生成
 * @param {number} days - 生成する日数
 * @returns {Array<{clock_in: string, clock_out: string | null, expected_wage: number}>} テストデータの配列
 */
export const generateTestData = (days: number) => {
  const data: Array<{clock_in: string, clock_out: string | null, expected_wage: number}> = []
  const today = new Date()
  
  // 通常勤務パターン（10:00-19:00）
  const normalDate = new Date(today)
  normalDate.setDate(today.getDate() - 2) // 2日前
  data.push({
    clock_in: new Date(normalDate.setHours(10, 0, 0)).toISOString(),
    clock_out: new Date(normalDate.setHours(19, 0, 0)).toISOString(),
    expected_wage: (9 * 1500) // 10:00-19:00 (9h)
  })

  // 夜勤パターン（22時超え）
  const nightDate = new Date(today)
  nightDate.setDate(today.getDate() - 1) // 1日前
  data.push({
    clock_in: new Date(nightDate.setHours(20, 0, 0)).toISOString(),
    clock_out: new Date(nightDate.setHours(23, 30, 0)).toISOString(),
    expected_wage: (2 * 1500) + (1.5 * 1875) // 20:00-22:00, 22:00-23:30
  })

  // 日付跨ぎパターン（24時超え）
  const nextDay = new Date(today)
  nextDay.setDate(today.getDate() + 1) // 翌日
  data.push({
    clock_in: new Date(today.setHours(23, 0, 0)).toISOString(),
    clock_out: new Date(nextDay.setHours(2, 0, 0)).toISOString(),
    expected_wage: (1 * 1875) + (2 * 2000) // 23:00-24:00, 24:00-02:00
  })
  
  return data
}

/**
 * テストデータを挿入し検証結果を表示
 * @param {string} staffId - スタッフID
 */
export const insertAndValidateTestData = async (staffId: string) => {
  try {
    const supabase = createClient()
    const testData = generateTestData(3) // 3日分（3レコード）
    
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
    alert(`テスト完了\n成功: ${results.filter(r => r.passed).length}/${results.length}`)
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