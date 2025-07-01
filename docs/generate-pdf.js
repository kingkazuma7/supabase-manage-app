const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 必要なパッケージをインストール
function installDependencies() {
  console.log("📦 必要なパッケージをインストール中...");
  try {
    execSync("npm install --save-dev markdown-pdf", { stdio: "inherit" });
    console.log("✅ パッケージのインストールが完了しました");
  } catch (error) {
    console.error("❌ パッケージのインストールに失敗しました:", error.message);
    process.exit(1);
  }
}

// MarkdownをPDFに変換
function convertToPDF() {
  console.log("🔄 MarkdownをPDFに変換中...");

  const inputFile = path.join(__dirname, "勤怠管理アプリ技術仕様書.md");
  const outputFile = path.join(__dirname, "勤怠管理アプリ技術仕様書.pdf");

  if (!fs.existsSync(inputFile)) {
    console.error("❌ 入力ファイルが見つかりません:", inputFile);
    process.exit(1);
  }

  try {
    // markdown-pdfを使用して変換
    execSync(`npx markdown-pdf "${inputFile}" -o "${outputFile}"`, {
      stdio: "inherit",
      cwd: __dirname,
    });

    console.log("✅ PDFの生成が完了しました");
    console.log(`📄 出力ファイル: ${outputFile}`);

    // ファイルサイズを表示
    const stats = fs.statSync(outputFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 ファイルサイズ: ${fileSizeInMB} MB`);
  } catch (error) {
    console.error("❌ PDFの生成に失敗しました:", error.message);

    // 代替手段としてpandocを試す
    console.log("🔄 代替手段としてpandocを試行中...");
    try {
      execSync(
        `pandoc "${inputFile}" -o "${outputFile}" --pdf-engine=wkhtmltopdf`,
        {
          stdio: "inherit",
          cwd: __dirname,
        },
      );
      console.log("✅ pandocによるPDFの生成が完了しました");
    } catch (pandocError) {
      console.error("❌ pandocでも失敗しました:", pandocError.message);
      console.log("\n💡 手動での変換方法:");
      console.log("1. VSCode + Markdown PDF 拡張機能を使用");
      console.log("2. オンラインMarkdown to PDF変換ツールを使用");
      console.log("3. pandocをインストール: brew install pandoc");
    }
  }
}

// メイン実行
function main() {
  console.log("🚀 勤怠管理アプリ技術仕様書のPDF生成を開始します");
  console.log("================================================");

  // 依存関係のインストール
  installDependencies();

  // PDF変換
  convertToPDF();

  console.log("\n🎉 処理が完了しました！");
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { installDependencies, convertToPDF };
