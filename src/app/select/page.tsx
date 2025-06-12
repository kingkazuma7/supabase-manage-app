// サーバー側の処理なので、サーバー側のSupabaseクライアントを使用
import { createClient } from '../utils/supabase/server'
import type { Database } from '@/types/database.types'

// このページをSSRにする（これがないと本番環境でこのページはSSGになる。その結果データベースを更新しても反映されなくなる。※supabaseとは関係なく、App Routerのお話）
export const revalidate = 0;

type Todo = Database['public']['Tables']['todos']['Row']

const Page = async () => {
  // Supabaseクライアントを作成
  const supabase = await createClient();

  // Todoのリストを取得
  const { data: todos, error } = await supabase
    .from('todos')
    .select()
    

  // エラーが発生した場合
  if (error) {
    return <div>Todoの取得でエラーが発生しました</div>
  }

  // todosがnullの場合の処理
  if (!todos) {
    return <div>Todoが見つかりませんでした</div>
  }
  
  
  return (
    <main>
      {todos.length > 0 ? (
        <ul>
          {todos.map((todo: Todo) => (
            <li key={todo.id}>{todo.text}</li>
          ))}
        </ul>
      ) : (
        <div>Todoがありません</div>
      )}
    </main>
  );
}

export default Page 