/** @type {import('next').NextConfig} */
// A build may be published on the primary domain after being built as a preview.
// Keep explicit project origins; never derive trust from request/forwarded headers.
const primaryOrigin = new URL(
  process.env.APP_ORIGIN ||
    process.env.URL ||
    "https://easytelemedicine.netlify.app",
).origin;
const trustedOrigins = [
  ...new Set([
    primaryOrigin,
    "https://easytelemedicine.netlify.app",
    ...(process.env.DEPLOY_PRIME_URL
      ? [new URL(process.env.DEPLOY_PRIME_URL).origin]
      : []),
    ...(process.env.DEPLOY_URL ? [new URL(process.env.DEPLOY_URL).origin] : []),
  ]),
];
const nextConfig = {
  env: {
    APP_ORIGIN: primaryOrigin,
    APP_TRUSTED_ORIGINS: trustedOrigins.join(","),
  },
  // Disable server-side indexing by search engines for all pages
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value:
              'camera=(self "https://*.whereby.com"), microphone=(self "https://*.whereby.com"), geolocation=()',
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.whereby.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.whereby.com wss://*.whereby.com",
              "frame-src https://*.whereby.com",
              "media-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // Ensure no robots.txt auto-generation that might expose paths
  experimental: {},
};

export default nextConfig;
