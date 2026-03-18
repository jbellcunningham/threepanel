import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'app.es1creative.com',
    'localhost',
    '127.0.0.1',
    '192.168.200.204',
  ],
};

export default nextConfig;
