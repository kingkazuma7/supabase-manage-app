'use server'

import { createClient } from '../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * データ挿入
 * @param formData - フォームデータ
 */
export async function insertData(formData: FormData) {
  // Supabaseクライアントを作成
  const supabase = await createClient()

  // フォームから入力値を取得
  const inputs = {
    text: formData.get('text') as string,
  }

  // データ挿入
  const { error } = await supabase
    .from('todos')                  // todosテーブルに
    .insert({ text: inputs.text })  // 入力されたテキストを挿入

  // エラーが発生した場合
  if (error) {
    console.error('Error inserting data:', error)
    redirect('/error')
  }

  // キャッシュを再検証
  revalidatePath('/')
  // 一覧ページにリダイレクト
  redirect('/')
} 