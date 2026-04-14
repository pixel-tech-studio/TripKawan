import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await params;
  const size = parseInt(sizeParam) || 192;
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.48);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#14b8a6",
          borderRadius: radius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize,
            fontWeight: 800,
            letterSpacing: "-2px",
            fontFamily: "sans-serif",
          }}
        >
          T
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
