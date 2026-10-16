import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// PDF resources are served locally, never from a third-party CDN.
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  const source = new URL(
    `../node_modules/pdfjs-dist/${name}/`,
    import.meta.url,
  );
  const target = new URL(`../public/pdfjs/${name}/`, import.meta.url);
  await mkdir(fileURLToPath(target), { recursive: true });
  await cp(fileURLToPath(source), fileURLToPath(target), { recursive: true });
}
