import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * スタッフアカウントを削除するAPIエンドポイント
 * @async
 * @function DELETE
 * @param {Request} request - HTTPリクエストオブジェクト
 * @returns {Promise<NextResponse>} 削除結果を含むレスポンス
 * @throws {Error} 削除処理中にエラーが発生した場合
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");

    if (!staffId) {
      return NextResponse.json(
        { error: "スタッフIDが必要です" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.from("staff").delete().eq("id", staffId);

    if (error) {
      return NextResponse.json(
        { error: "アカウントの削除に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "アカウントの削除中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
