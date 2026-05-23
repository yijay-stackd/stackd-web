import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "stackd · student talent";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf8f0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "0 96px",
          gap: 40,
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            background: "#0a0a0a",
            borderRadius: 36,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: 34,
            gap: 13,
          }}
        >
          <div style={{ width: 92, height: 25, background: "#d6ff3d", borderRadius: 7 }} />
          <div style={{ width: 62, height: 25, background: "#d6ff3d", borderRadius: 7 }} />
          <div style={{ width: 92, height: 25, background: "#d6ff3d", borderRadius: 7 }} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: "#0a0a0a",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Build a bio. Skip the application.
          </div>
          <div style={{ fontSize: 32, color: "#6b6760", letterSpacing: "-0.01em" }}>
            stackd · student talent
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
