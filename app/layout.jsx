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
      <body>
        {children}
        {/* dotLottie web component (onboarding welcome animation) */}
        <script
          type="module"
          src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.4/dist/dotlottie-wc.js"
        />
      </body>
    </html>
  );
}
