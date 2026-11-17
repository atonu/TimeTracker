/** @type {import('next').NextConfig} */
// "standalone" produces a small self-contained server for the Docker image.
const nextConfig = { reactStrictMode: true, output: "standalone",
  serverExternalPackages: ["mongodb"],
};
export default nextConfig;
