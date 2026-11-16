/** @type {import('next').NextConfig} */
// "standalone" produces a small self-contained server for the Docker image.
const nextConfig = { reactStrictMode: true, output: "standalone" };
export default nextConfig;
