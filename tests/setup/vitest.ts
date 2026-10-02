import "@testing-library/jest-dom/vitest";

// Unit/contract tests inject mocked providers explicitly. Never inherit a real
// judge/helper credential or connect to the user's database during a unit run.
for (const name of [
  "NIM_API_KEY", "NVIDIA_NIM_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY",
  "LLM_API_KEY", "OPENAI_API_KEY", "CONGRESS_API_KEY", "DATABASE_URL", "DIRECT_URL",
]) {
  delete process.env[name];
}
