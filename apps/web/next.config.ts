import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages so Next.js can compile their TypeScript source
  transpilePackages: ["@scout/shared", "@scout/config"],
};

export default nextConfig;
