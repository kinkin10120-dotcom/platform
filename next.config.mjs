/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: "/handypm", destination: "/handyworks", permanent: true }];
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  webpack(config) {
    // WASM 파일을 asset으로 처리 (occt-import-js)
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
