import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * スタッフのマスター権限を更新するAPIエンドポイント
 * @route POST /api/master/update-permission
 * @param {Request} request - HTTPリクエストオブジェクト
 * @returns {Promise<NextResponse>} 更新結果を含むレスポンス
 * @throws {Error} 更新処理中にエラーが発生した場合
 */
export async function POST(request: Request) {
  try {
    // リクエストボディからデータを取得
    const { staffId, isMaster } = await request.json();

    // バリデーション
    if (staffId === undefined || isMaster === undefined) {
      return NextResponse.json(
        { error: "スタッフIDとマスター権限フラグが必要です" },
        { status: 400 },
      );
    }

    // Supabaseクライアントを作成
    const supabase = await createClient();

    // 更新対象のスタッフが存在するか確認
    const { data: existingStaff, error: fetchError } = await supabase
      .from("staff")
      .select("id, name, is_master")
      .eq("id", staffId)
      .single();

    if (fetchError || !existingStaff) {
      return NextResponse.json(
        { error: "指定されたスタッフが見つかりません" },
        { status: 404 },
      );
    }

    // 現在の状態と同じ場合は早期リターン
    if (existingStaff.is_master === isMaster) {
      return NextResponse.json(
        { message: "権限は既に希望の状態です" },
        { status: 200 },
      );
    }

    // マスター権限を更新
    const { error: updateError } = await supabase
      .from("staff")
      .update({ is_master: isMaster })
      .eq("id", staffId);

    if (updateError) {
      console.error("Error updating master permission:", updateError);
      return NextResponse.json(
        { error: "マスター権限の更新に失敗しました" },
        { status: 500 },
      );
    }

    // 成功レスポンス
    const action = isMaster ? "付与" : "取り消し";
    return NextResponse.json({
      success: true,
      message: `マスター権限を${action}しました`,
      data: {
        staffId,
        isMaster,
        staffName: existingStaff.name,
      },
    });

  } catch (error) {
    console.error("Error in update-permission API:", error);
    return NextResponse.json(
      { error: "マスター権限の更新中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
