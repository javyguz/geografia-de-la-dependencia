import { preload } from "react-dom";
import { Explorer } from "@/components/explorer";
import { readInitial } from "@/lib/build-data";
import { LATER_FILES } from "@/lib/data";

export default function HomePage() {
  // The national view is rendered at build time, so its figures are in the HTML.
  // The geometry and the full list of places are requested with the HTML too, in
  // parallel with the code; "anonymous" matches what fetch() sends.
  for (const path of LATER_FILES)
    preload(`/data/${path}`, { as: "fetch", crossOrigin: "anonymous" });
  return <Explorer initial={readInitial()} />;
}
