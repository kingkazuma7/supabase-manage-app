import { createClient } from '../utils/supabase/client'

/**
 * テストデータを生成する関数
 * @param {number} days - 生成する日数
 * @returns {Array<{clock_in: string, clock_out: string | null}>} テストデータの配列
 */
export const generateTestData = (days: number) => {
  const data = []
  const today = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // 通常の出退勤パターン
    data.push({
      clock_in: new Date(date.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(date.setHours(18, 0, 0)).toISOString()
    })
    
    // 遅刻パターン
    data.push({
      clock_in: new Date(date.setHours(10, 30, 0)).toISOString(),
      clock_out: new Date(date.setHours(19, 30, 0)).toISOString()
    })
    
    // 早退パターン
    data.push({
      clock_in: new Date(date.setHours(9, 0, 0)).toISOString(),
      clock_out: new Date(date.setHours(15, 0, 0)).toISOString()
    })
    
    // 未退勤パターン
    data.push({
      clock_in: new Date(date.setHours(9, 0, 0)).toISOString(),
      clock_out: null
    })
  }
  
  return data
}

/**
 * テストデータをデータベースに挿入する関数
 * @param {string} staffId - スタッフID
 */
export const insertTestData = async (staffId: string) => {
  try {
    const supabase = createClient()
    const testData = generateTestData(7) // 7日分のテストデータを生成
    
    for (const record of testData) {
      const { error } = await supabase
        .from('attendance')
        .insert({
          staff_id: staffId,
          clock_in: record.clock_in,
          clock_out: record.clock_out
        })
      
      if (error) {
        console.error('テストデータの挿入に失敗:', error)
        throw error
      }
    }
    
    alert('テストデータの挿入が完了しました')
  } catch (error) {
    console.error('テストデータの挿入に失敗:', error)
    alert('テストデータの挿入に失敗しました')
  }
}

/**
 * テストデータを削除する関数
 * @param {string} staffId - スタッフID
 */
export const deleteTestData = async (staffId: string) => {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('staff_id', staffId)
    
    if (error) {
      console.error('テストデータの削除に失敗:', error)
      throw error
    }
    
    alert('テストデータの削除が完了しました')
  } catch (error) {
    console.error('テストデータの削除に失敗:', error)
    alert('テストデータの削除に失敗しました')
  }
} 