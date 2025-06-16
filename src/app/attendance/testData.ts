import { createClient } from '../utils/supabase/client'

/**
 * 時間帯別給与計算を検証するためのテストデータ生成
 * @param {number} days - 生成する日数
 * @returns {Array<{clock_in: string, clock_out: string | null}>} テストデータの配列
 */
export const generateTestData = (days: number) => {
  const data = []
  const today = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // 基本パターン（通常勤務）
    data.push({
      clock_in: new Date(date.setHours(10, 0, 0)).toISOString(),
      clock_out: new Date(date.setHours(22, 0, 0)).toISOString(),
      expected_wage: (12 * 1500) // 10:00-22:00 (12h)
    })
    
    // 夜勤パターン（22時超え）
    data.push({
      clock_in: new Date(date.setHours(20, 0, 0)).toISOString(),
      clock_out: new Date(new Date(date).setHours(23, 30, 0)).toISOString(),
      expected_wage: (2 * 1500) + (1.5 * 1875) // 20:00-22:00, 22:00-23:30
    })
    
    // 日付跨ぎパターン（24時超え）
    const nextDay = new Date(date)
    nextDay.setDate(date.getDate() + 1)
    data.push({
      clock_in: new Date(date.setHours(23, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(2, 0, 0)).toISOString(),
      expected_wage: (1 * 1875) + (2 * 2000) // 23:00-24:00, 24:00-02:00
    })
    
    // 長時間勤務（複数時間帯跨ぎ）
    data.push({
      clock_in: new Date(date.setHours(15, 0, 0)).toISOString(),
      clock_out: new Date(nextDay.setHours(3, 0, 0)).toISOString(),
      expected_wage: (7 * 1500) + (2 * 1875) + (3 * 2000) // 15:00-22:00, 22:00-24:00, 24:00-03:00
    })
    
    // 未退勤パターン
    if (i === 0) { // 当日のみ
      data.push({
        clock_in: new Date(date.setHours(9, 0, 0)).toISOString(),
        clock_out: null,
        expected_wage: 0
      })
    }
  }
  
  return data
}

/**
 * テストデータを挿入し検証結果を表示
 * @param {string} staffId - スタッフID
 */
export const insertAndValidateTestData = async (staffId: string) => {
  try {
    const supabase = createClient()
    const testData = generateTestData(3) // 3日分（12レコード）
    
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
const calculateWage = async (supabase: any, recordId: string) => {
  const { data } = await supabase
    .from('attendance')
    .select('clock_in, clock_out')
    .eq('id', recordId)
    .single()
  
  if (!data.clock_out) return 0
  
  const clockIn = new Date(data.clock_in)
  const clockOut = new Date(data.clock_out)
  let total = 0
  let current = new Date(clockIn)
  
  while (current < clockOut) {
    const hour = current.getHours()
    let rate = hour >= 22 ? 1875 : 1500
    if (current.getDate() !== clockIn.getDate()) rate = 2000 // 日付跨ぎ
    
    total += rate
    current.setHours(current.getHours() + 1)
  }
  
  return total
}

// テストデータ削除関数（元のまま）
export const deleteTestData = async (staffId: string) => {
  /* 既存の実装をそのまま使用 */
}