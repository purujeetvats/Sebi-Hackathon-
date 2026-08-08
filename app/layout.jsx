import "./styles.css";

export const metadata = {
  title: "NiveshOS — Every asset. One brain.",
  description:
    "Every demat account, mutual fund folio, bond and idle rupee — one intelligent, SEBI-aligned view.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
