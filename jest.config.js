module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
    "^.+\\.(js|jsx)$": ["babel-jest", { presets: ["next/babel"] }],
  },
  moduleDirectories: ["node_modules", "src"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx|js|jsx)"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
};
