import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. リクエストからデータを取得
    const { staffId, password } = await request.json();

    // 2. 必須チェック
    if (!staffId || !password) {
      return NextResponse.json(
        { error: "スタッフIDとパスワードが必要です" },
        { status: 400 },
      );
    }

    // 3. Supabaseクライアントを作成
    const supabase = await createClient();

    // 4. スタッフのパスワードを取得
    const { data: staff, error } = await supabase
      .from("staff")
      .select("password")
      .eq("id", staffId)
      .single();

    // 4. スタッフが見つからない場合
    if (error) {
      return NextResponse.json(
        { error: "スタッフが見つかりません" },
        { status: 404 },
      );
    }

    // 5. パスワードの検証
    if (staff.password !== password) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 401 },
      );
    }

    // 6. 認証成功時にtrueを返す
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error verifying password:", error);
    return NextResponse.json(
      { error: "認証中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
