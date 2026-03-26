/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  turbopack: {
    root: "/Users/gaetanevina/IdeaProjects/Prompt-Chain-Tool",
  },
};

export default nextConfig;
