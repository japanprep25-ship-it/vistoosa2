# FIX: Downloaded PDF has squeezed text and lines overlapping the text

## Problem
The Download button in the invoice preview popup now downloads the 4x6 invoice (good), but in the PDF the text is squeezed and sits on top of the lines, for example:
- the table header/row lines cut through the text ("ITEM", "Advance Paid", "WEIGHT"),
- "Barcode Code:" and "Handle With Care Pls" overlap the barcode and the icons.
The preview on screen looks fine, only the downloaded PDF is wrong. The cause is that `html2canvas` does not position text correctly.

## How to fix
1. Uninstall/stop using `html2canvas` for this. Install `html-to-image` (npm package) instead. Keep `jspdf`.
2. In `components/CourierLabel.jsx`, replace `import html2canvas from "html2canvas"` with:
   `import { toPng } from "html-to-image";`
3. Replace the whole `handleDownload` function with this exact code:
```jsx
const handleDownload = async () => {
  const el = labelBoxRef.current?.querySelector(".lbl-print");
  if (!el) return;
  setBusy(true);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const opts = {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      width: LABEL_W,
      height: LABEL_H,
      cacheBust: true,
      skipFonts: true,
      style: { transform: "none", margin: "0" },
    };
    await toPng(el, opts); // warm-up call (needed for iPhone/Safari)
    const dataUrl = await toPng(el, opts);
    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [4, 6] });
    pdf.addImage(dataUrl, "PNG", 0, 0, 4, 6);
    pdf.save(`Invoice-${order.id || "label"}.pdf`);
  } catch (e) {
    console.error(e);
    alert("Download hoyni. Abar try korun.");
  } finally {
    setBusy(false);
  }
};
```
4. In the same file's CSS, the label uses `font-family: Arial, Helvetica, sans-serif` and `font-weight: 700` for bold text. Do not change fonts or weights (no 800/900, no Google fonts), and do not let the app's global CSS override fonts inside `.lbl`.

## Do not
- Do not change the label design, sizes, spacing or print behaviour.
- Do not use the app's old invoice PDF generator.
- Do not touch my existing "download invoice" feature in other pages.

## After you finish
Tell me which packages you installed/removed and confirm the Download button now calls `handleDownload`.
