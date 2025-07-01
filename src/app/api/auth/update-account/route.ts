import { createClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    console.log("update-account");
    const { id, name, email } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        {
          error: "名前、メールアドレス、IDが必要です",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from("staff")
      .update({
        name: name,
        email: email,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating account:", updateError);
      return NextResponse.json(
        {
          error: "アカウントの更新に失敗しました",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "アカウントの更新に成功しました",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "アカウントの更新に失敗しました" },
      { status: 500 },
    );
  }
}
