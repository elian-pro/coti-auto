/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // El endpoint /api/quote-direct lee prompts/cotizacion/system_prompt.md en
  // runtime via readFileSync. Next no detecta esa dependencia estáticamente,
  // así que la incluimos explícitamente en el trace del standalone build.
  outputFileTracingIncludes: {
    "/api/quote-direct": [
      "./prompts/cotizacion/system_prompt.md",
      "./prompts/evaluacion/system_prompt.md",
    ],
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
