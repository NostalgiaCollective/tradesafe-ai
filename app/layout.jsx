import "./globals.css";

export const metadata = {
  title: "TradeSafe AI | Ontario Compliance Reports for Contractors",
  description:
    "Generate Ontario code-compliant safety and inspection reports for electrical, plumbing, and roofing contractors. ESA, OBC, and MOL compliance in minutes.",
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
