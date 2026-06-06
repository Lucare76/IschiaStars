/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ischiastars.it"
      }
    ]
  },
  experimental: {
    // Dynamic admin pages must never show stale data from the router cache.
    webpackBuildWorker: false,
    staleTimes: { dynamic: 0, static: 180 }
  }
};

export default nextConfig;
