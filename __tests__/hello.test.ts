// __tests__/hello.test.ts

describe("Hello World テスト", () => {
  it("1 + 1 は 2 になる", () => {
    expect(1 + 1).toBe(2);
  });

  it("Hello World 文字列が正しい", () => {
    const message = "Hello World";
    expect(message).toBe("Hello World");
  });
});
