import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          borderRadius: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 38,
          gap: 14,
        }}
      >
        <div style={{ width: 104, height: 28, background: "#d6ff3d", borderRadius: 8 }} />
        <div style={{ width: 70, height: 28, background: "#d6ff3d", borderRadius: 8 }} />
        <div style={{ width: 104, height: 28, background: "#d6ff3d", borderRadius: 8 }} />
      </div>
    ),
    { ...size }
  );
}
