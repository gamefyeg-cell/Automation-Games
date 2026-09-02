import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Steam's header/capsule art comes from these CDN hosts (header_image
    // in the appdetails response) — next/image throws at runtime on any
    // host not explicitly allowed here.
    remotePatterns: [
      { protocol: "https", hostname: "*.steamstatic.com" },
      { protocol: "https", hostname: "*.akamaihd.net" },
      // PlayStation Store cover art (see src/lib/psstore) — media[].url in
      // the categoryGridRetrieve response is served from these hosts.
      { protocol: "https", hostname: "image.api.playstation.com" },
      { protocol: "https", hostname: "*.playstation.com" },
      { protocol: "https", hostname: "*.playstation.net" },
    ],
  },
};

export default nextConfig;
