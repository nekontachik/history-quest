import type { Metadata } from "next";
import Chronicle from "@/components/features/Chronicle";

export const metadata: Metadata = {
  title: "Chronicle — 1648",
  description:
    "You are a commoner in 1648 with a book that should not exist. Follow history, or bend it and watch the ink fade.",
};

export default function PlayPage() {
  return <Chronicle />;
}
