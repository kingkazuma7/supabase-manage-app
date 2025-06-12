'use server'

import { createClient } from '../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * データ挿入
 * @param formData - フォームデータ
 */
export async function insertData(formData: FormData) {
  try {
    // Supabaseクライアントを作成
    const supabase = await createClient()

    // フォームから入力値を取得
    const inputs = {
      text: formData.get('text') as string,
    }

    if (!inputs.text) {
      throw new Error('テキストが入力されていません')
    }

    // データ挿入
    const { error } = await supabase
      .from('todos')
      .insert({ text: inputs.text })

    // エラーが発生した場合
    if (error) {
      console.error('Error inserting data:', error)
      throw error
    }

    // キャッシュを再検証
    revalidatePath('/')
    // 一覧ページにリダイレクト
    redirect('/')
  } catch (error) {
    console.error('Error in insertData:', error)
    throw error
  }
} 