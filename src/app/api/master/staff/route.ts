import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * スタッフ一覧を取得するAPIエンドポイント
 * @route GET /api/master/staff
 * @param {Request} request - HTTPリクエストオブジェクト
 * @returns {Promise<NextResponse>} スタッフ一覧を含むレスポンス
 * @throws {Error} データ取得中にエラーが発生した場合
 */
export async function GET(request: Request) {
  try {
    // クエリパラメータを取得（将来的なフィルタリング用）
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get("orderBy") || "name";
    const order = searchParams.get("order") as "asc" | "desc" || "asc";

    // Supabaseクライアントを作成
    const supabase = await createClient();

    // TODO: 将来的な権限チェック機能の準備
    // const { data: currentUser, error: authError } = await supabase.auth.getUser();
    // if (authError || !currentUser?.id) {
    //   return NextResponse.json(
    //     { error: "認証が必要です" },
    //     { status: 401 },
    //   );
    // }

    // スタッフ一覧を取得（必要なフィールドのみ）
    const { data: staffList, error: fetchError } = await supabase
      .from("staff")
      .select("id, name, email, is_master")
      .order(orderBy, { ascending: order === "asc" });

    if (fetchError) {
      console.error("Error fetching staff list:", fetchError);
      return NextResponse.json(
        { error: "スタッフ一覧の取得に失敗しました" },
        { status: 500 },
      );
    }

    // マスター権限を持つスタッフの数をカウント
    const masterCount = staffList?.filter((staff) => staff.is_master).length || 0;

    // レスポンスデータの整形
    return NextResponse.json({
      success: true,
      data: {
        staff: staffList || [],
        meta: {
          total: staffList?.length || 0,
          masterCount,
        },
      },
    });

  } catch (error) {
    console.error("Error in staff list API:", error);
    return NextResponse.json(
      { error: "スタッフ一覧の取得中にエラーが発生しました" },
      { status: 500 },
    );
  }
}

// 将来的な拡張のためのコード（現在は使用しない）
/*
interface StaffFilters {
  isMaster?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

function applyFilters(query: any, filters: StaffFilters) {
  if (filters.isMaster !== undefined) {
    query = query.eq("is_master", filters.isMaster);
  }
  if (filters.searchTerm) {
    query = query.ilike("name", `%${filters.searchTerm}%`);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.offset(filters.offset);
  }
  return query;
}
*/
