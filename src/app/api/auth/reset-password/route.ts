import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // リクエストからデータを取得
    const { staffId } = await request.json();

    // 必須チェック
    if (!staffId) {
      return NextResponse.json(
        { error: "スタッフIDが必要です" },
        { status: 400 },
      );
    }

    // Supabaseクライアントを作成
    const supabase = await createClient();

    // パスワードをリセット
    const { error: updateError } = await supabase
      .from("staff")
      .update({
        password: "password123"
      })
      .eq("id", staffId);

    if (updateError) {
      console.error("Error resetting password:", updateError);
      return NextResponse.json(
        {
          error: "パスワードのリセットに失敗しました",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "パスワードのリセットに成功しました",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "パスワードのリセットに失敗しました" },
      { status: 500 },
    );
  }
} 