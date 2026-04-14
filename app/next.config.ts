import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
