import { ImageResponse } from "next/og";

export const contentType = "image/png";

export const size = {
  width: 180,
  height: 180,
};

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f4efe5",
          borderRadius: 36,
          color: "#183153",
          display: "flex",
          fontSize: 72,
          fontStyle: "normal",
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <span>ALM</span>
        <div
          style={{
            background: "#d8a24a",
            borderRadius: 9999,
            height: 18,
            left: 90,
            position: "absolute",
            top: 18,
            width: 18,
          }}
        />
      </div>
    ),
    size,
  );
}
