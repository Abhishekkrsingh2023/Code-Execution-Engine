import type { NextConfig } from "next";

const allowedOrigins = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
  ? process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : ["localhost:3001", "127.0.0.1:3001", "admin.bbit.io"];

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
