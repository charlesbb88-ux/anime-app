"use client";

import type { CSSProperties } from "react";

export const checkerboardStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)," +
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,6px 6px",
};