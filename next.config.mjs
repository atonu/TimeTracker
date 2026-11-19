/** @type {import('next').NextConfig} */
// "standalone" produces a small self-contained server for the Docker image.
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["mongodb", "web-push"],
  // Analytics goes through our own address, so fewer visits are lost to ad blockers.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  skipTrailingSlashRedirect: true,
};
export default nextConfig;
