import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // リクエストからデータを取得
    const { name, email, password } = await request.json();
    console.log(name, email, password);

    // 必須チェック
    if (!name || !password || !email) {
      return NextResponse.json(
        { error: "名前とパスワードが必要です" },
        { status: 400 },
      );
    }

    // Supabaseクライアントを作成
    const supabase = await createClient();

    // スタッフを追加
    const { data, error } = await supabase
      .from("staff")
      .insert({ name, email, password })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "アカウントの作成に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "アカウントの作成中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
