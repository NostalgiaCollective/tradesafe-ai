import "./globals.css";

export const metadata = {
  title: "TradeSafe AI | Ontario Observation Records for Contractors",
  description:
    "Record job observations and supporting evidence for Ontario electrical, plumbing and roofing work. Content pending qualified review; no compliance certification.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
