# TASK: Courier label / invoice printing: one preview popup for ALL print and download buttons

## Current problem (must be fixed)
- In my app, when I select an order (or many orders) and press **Print**, it directly downloads an old PDF that has only 3 lines (name, number, address). There is no preview, and my new designed invoice is not used.
- I want the new 4x6 inch "INVOICE" label (code is at the bottom of this file as `components/CourierLabel.jsx`) to be used everywhere.

## What I want you to do

1. **Create/replace the component**
   Create (or fully replace) `components/CourierLabel.jsx` with the exact code from the "COMPONENT CODE" section at the bottom of this file.

2. **Install the packages**
   `jsbarcode`, `html-to-image`, `jspdf` (do not use `html2canvas`; remove it if it is installed only for this).

3. **Replace ALL old print / download logic for courier labels**
   Search the whole app for every place where a courier label / sticker / invoice can be printed or downloaded, for example:
   - the single order "Print" / "Download PDF" button,
   - the order details / order list buttons,
   - the bulk action: select one or many orders (checkboxes) then press Print,
   - any function that generates the old 3-line sticker PDF (name, number, address) or the old plain-text label.
   Remove the old courier sticker PDF generator and make ALL of those buttons use the new flow below. (Keep my other normal A4 invoice features for other purposes untouched, only courier label/sticker printing is replaced.)

   **The new flow (very important):**
   - Pressing Print/Download must NEVER directly download or directly print anything.
   - It must first open the **preview popup** (`LabelPreviewModal`) showing the 4x6 invoice(s).
   - The popup has, in its top-right corner, the buttons **Print**, **Download** (PDF) and **✕ close**. The user chooses there. This is already built in the component, do not change it.
   - If the user selected many orders, the popup shows one 4x6 invoice per order (scrollable). **Print** prints all of them (one 4x6 page per order). **Download** saves ONE PDF with all of them (one 4x6 page per order).
   - A single order works the same way (popup with 1 invoice).

   Wire it like this:
   ```jsx
   import { LabelPreviewModal } from "./components/CourierLabel";

   // map my order to the label format (use my REAL field names from the existing code, do not invent new ones)
   const toLabelOrder = (o) => ({
     id: o.id,                          // e.g. VIS-982105
     date: o.date,                      // dd/mm/yyyy
     recipientName: o.customerName,
     phone: o.phone,
     address: o.address,
     courier: o.courier,
     consignmentId: o.consignmentId,    // Pathao consignment ID
     weight: o.weight || "1 KG",
     products: o.items.map(i => ({
       name: i.productName, size: i.size, qty: i.quantity, price: i.unitPrice  // price per piece
     })),
     deliveryCharge: o.deliveryCharge,
     discount: o.discount,              // optional
     advance: o.advance,                // already paid amount (0 if none)
   });

   const [previewOrders, setPreviewOrders] = useState(null);

   // Print button for one order:      setPreviewOrders([toLabelOrder(order)])
   // Print button for selected ones:  setPreviewOrders(selectedOrders.map(toLabelOrder))

   {previewOrders && (
     <LabelPreviewModal orders={previewOrders} onClose={() => setPreviewOrders(null)} />
   )}
   ```
   `CourierLabelButton` (default export) is a shortcut that renders a button + popup for one order, use it only if it is simpler.
   - Do NOT pass `cod` manually. The invoice calculates it automatically, in this order: Subtotal = sum of (price x qty), then Delivery Charge, Discount, TOTAL = Subtotal + Delivery Charge - Discount, then Advance Paid, then DUE / COD (COLLECT) = Total - Advance.
   - Make sure the order form saves `deliveryCharge`, `discount` and `advance` (add these number fields if missing, default 0), and every order item stores its unit `price`.
   - The Download button must use the component's own `handleDownload` (it captures exactly what is shown in the preview with `html-to-image` and puts it on 4x6 inch `jsPDF` pages). Never connect it to any old PDF generator.

4. **Fix `Courier: undefined` bug**
   The `courier` field is not being saved with the order, so it prints "undefined".
   - In the order create/edit form, add a required **Courier** dropdown with: Pathao, Steadfast, RedX, Paperfly, Other.
   - Save the selected value in the order object as `courier`.
   - Make sure existing orders without a courier show "—" instead of "undefined".

5. **Pathao Consignment ID**
   - When an order is sent to Pathao (booking/dispatch), the consignment ID returned by Pathao must be saved in the order as `consignmentId`.
   - If my app already stores it under another name, use that name in the mapping above.
   - The label shows the Consignment ID in a bordered box and the barcode encodes the consignment ID (if it is missing, the barcode falls back to the Order ID).
   - Before opening the preview, if the consignment ID is missing, show a warning "Consignment ID missing" (the user can still continue).

6. **Print settings (very important)**
   - Label size must be exactly **4 inch x 6 inch** (the component already has `@page { size: 4in 6in; margin: 0 }`).
   - The popup must work on mobile too (the preview shrinks to fit the screen width).
   - Everything (including the barcode and the "Handle With Care" icons at the bottom) must stay fully inside the 4x6 page. Nothing may be cut off or go outside the printed area. Do not increase font sizes, padding or heights in the component, they are already tuned to fit.
   - When printing, only the label should be printed, not the rest of the app UI.
   - Keep the design black and white (for thermal printers).
   - Do not change the label layout, spacing or fonts unless something is broken.

7. **Sender info**
   In `CourierLabel.jsx`, the `SENDER` object is already filled with my warehouse info:
   - company: VISTOOSA
   - name: Warehouse of Vistoosa
   - address: East Goran, Modina Mashjid, Khilgaon
   - city: Dhaka
   - phone: 01895600066
   Keep these exactly as they are. Only replace `www.yourcompanyname.com` in the footer with my website/page name if I have one in settings, otherwise remove that text.

## Do not
- Do not rewrite or redesign other parts of the app.
- Do not remove any existing features (orders, inventory, reports).
- Do not use any external image URLs. The label uses inline SVG icons only.

## After you finish
Tell me which files you changed, which buttons (single order print, selected orders print, etc.) now open the preview popup, and confirm the old 3-line sticker PDF is no longer used.

---

# COMPONENT CODE (`components/CourierLabel.jsx`)

```jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";   // npm install jsbarcode
import { toPng } from "html-to-image"; // npm install html-to-image
import { jsPDF } from "jspdf";         // npm install jspdf

/*
  Usage:

  import { LabelPreviewModal } from "./components/CourierLabel";

  // 1) order ke label format e map korar function (field name apnar app er moto)
  const toLabelOrder = (o) => ({
    id: o.id, date: o.date, recipientName: o.customerName, phone: o.phone,
    address: o.address, courier: o.courier, consignmentId: o.consignmentId,
    weight: o.weight || "1 KG",
    products: o.items.map(i => ({ name: i.productName, size: i.size, qty: i.quantity, price: i.unitPrice })),
    deliveryCharge: o.deliveryCharge, discount: o.discount, advance: o.advance,
  });

  // 2) Print button (single order ba checkbox diye select kora onek order) e:
  const [previewOrders, setPreviewOrders] = useState(null);
  onClick={() => setPreviewOrders(selectedOrders.map(toLabelOrder))}

  // 3) Page er shesh e:
  {previewOrders && (
    <LabelPreviewModal orders={previewOrders} onClose={() => setPreviewOrders(null)} />
  )}

  Print/Download button tap korle age preview popup open hoy (kono auto download/print hoy na).
  Popup er upore right corner e Print, Download (PDF), ✕ thake.
  Onek order select korle prottek order er jonno 1 ta kore 4x6 page hoy.
  Print = shob page print, Download = shob page niye 1 ta PDF.
*/

const SENDER = {
  company: "VISTOOSA",
  name: "Warehouse of Vistoosa",
  address: "East Goran, Modina Mashjid, Khilgaon",
  city: "Dhaka",
  phone: "01895600066",
};

const css = `
@page { size: 4in 6in; margin: 0; }

.lbl { width: 4in; height: 6in; box-sizing: border-box; padding: 0.12in;
  background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif;
  display: flex; flex-direction: column; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.lbl * { box-sizing: border-box; }

.lbl-head { background: #000; color: #fff; text-align: center; font-weight: 700;
  font-size: 15px; letter-spacing: 1px; padding: 4px 0; border-radius: 5px; flex: none; }

.lbl-top { display: flex; justify-content: space-between; align-items: center;
  padding: 6px 2px; flex: none; }
.lbl-company { font-size: 18px; font-weight: 700; line-height: 1.05; }
.lbl-meta { font-size: 9.5px; line-height: 1.4; text-align: right; }

.lbl-ft { display: flex; border-top: 1px solid #000; border-bottom: 1px solid #000; flex: none; }
.lbl-ft > div { flex: 1; min-width: 0; padding: 4px 5px 5px; font-size: 10px; line-height: 1.3;
  overflow-wrap: anywhere; }
.lbl-ft > div + div { border-left: 1px solid #000; }
.lbl-ft h4 { margin: 0 0 3px; font-size: 9px; font-weight: 700; }
.lbl-to .nm { font-size: 12.5px; font-weight: 700; }

.lbl-details { padding: 4px 2px; font-size: 10px; border-bottom: 1px solid #000;
  line-height: 1.35; flex: none; }
.lbl-details h4 { margin: 0 0 2px; font-size: 9px; font-weight: 700; }
.lbl-items { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
.lbl-items th { font-size: 8px; text-align: right; font-weight: 700; padding: 0 0 2px 5px;
  border-bottom: 1px solid #000; }
.lbl-items th:first-child { text-align: left; padding-left: 0; }
.lbl-items td { padding: 2px 0; border-bottom: 1px dotted #999; font-size: 9.5px; }
.lbl-items td.r { text-align: right; padding-left: 5px; white-space: nowrap; }
.lbl-sum { margin-top: 3px; border-top: 1px solid #000; padding-top: 3px; }
.lbl-sum .lbl-row { padding: 1px 0; line-height: 1.4; }
.lbl-row { display: flex; justify-content: space-between; gap: 6px; }
.lbl-total { font-size: 11px; font-weight: 700; }
.lbl-due { border-top: 1.5px solid #000; margin-top: 3px; padding-top: 3px;
  font-size: 12px; font-weight: 700; align-items: center; }
.lbl-due .amt { font-size: 15px; }

.lbl-cn { margin: 4px 0 0; border: 1.5px solid #000; border-radius: 4px; padding: 3px 7px;
  display: flex; justify-content: space-between; align-items: center; font-size: 9px; flex: none; }
.lbl-cn b { font-size: 13px; letter-spacing: .5px; }

.lbl-bottom { display: flex; align-items: flex-end; gap: 8px; padding-top: 5px;
  margin-top: auto; flex: none; }
.lbl-bottom small { font-size: 8px; display: block; margin-bottom: 3px; line-height: 1.2; }
.lbl-bc { flex: 1; min-width: 0; }
.lbl-bc svg { display: block; width: 100%; height: 40px; }
.lbl-icons { display: flex; gap: 3px; }
.lbl-icons span { width: 26px; height: 26px; background: #000; display: flex;
  align-items: center; justify-content: center; }
.lbl-icons svg { width: 17px; height: 17px; }
.lbl-foot { border-top: 1px solid #000; margin-top: 4px; padding-top: 3px;
  font-size: 8px; display: flex; justify-content: space-between; font-weight: 700; flex: none; }

.lbl-print-root { display: none; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > *:not(.lbl-print-root) { display: none !important; }
  .lbl-print-root { display: block !important; }
  .lbl-print-root .lbl { break-after: page; page-break-after: always; }
  .lbl-print-root .lbl:last-child { break-after: auto; page-break-after: auto; }
}
`;

const Icons = () => (
  <div className="lbl-icons">
    <span>{/* umbrella */}
      <svg viewBox="0 0 24 24" fill="#fff"><path d="M2 13a10 10 0 0 1 20 0z"/><rect x="11" y="13" width="2" height="6"/><path d="M11 19a2 2 0 0 1-4 0" stroke="#fff" strokeWidth="2" fill="none"/></svg>
    </span>
    <span>{/* recycle */}
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M20 3v5h-5" fill="#fff"/></svg>
    </span>
    <span>{/* fire */}
      <svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>
    </span>
    <span>{/* glass */}
      <svg viewBox="0 0 24 24" fill="#fff"><path d="M6 2h12l-1.5 9a4.5 4.5 0 0 1-3.5 3.8V20h3.5v2H7.5v-2H11v-5.2A4.5 4.5 0 0 1 7.5 11z"/></svg>
    </span>
  </div>
);

export function CourierLabel({ order = {}, sender = SENDER }) {
  const barcodeRef = useRef(null);
  const id = order.id || "VIS-000000";
  const code = order.consignmentId || id; // barcode e Pathao consignment ID, na thakle Order ID
  const items = Array.isArray(order.products) ? order.products : [];
  const MAX_ITEMS = 4; // 4x6 jayga kom, tai beshi hole "+N more"
  const shown = items.slice(0, MAX_ITEMS);
  const extra = items.length - shown.length;

  const money = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
  const subtotal =
    order.subtotal ??
    items.reduce((a, p) => a + Number(p.price || 0) * Number(p.qty || 1), 0);
  const delivery = Number(order.deliveryCharge || 0);
  const discount = Number(order.discount || 0);
  const advance = Number(order.advance || 0);
  const total = subtotal + delivery - discount;
  const due = order.cod ?? Math.max(total - advance, 0); // oboshishto = COD

  useEffect(() => {
    const el = barcodeRef.current;
    if (!el) return;
    try {
      JsBarcode(el, code, {
        format: "CODE128", width: 1.4, height: 40,
        displayValue: true, fontSize: 10, margin: 0,
      });
      // barcode ke jayga onujayi scale kora, jate printed area er bahire na jay
      const w = el.getAttribute("width");
      const h = el.getAttribute("height");
      if (w && h) {
        el.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
        el.removeAttribute("width");
        el.removeAttribute("height");
        el.setAttribute("preserveAspectRatio", "xMinYMid meet");
      }
    } catch (e) {
      console.error(e);
    }
  }, [code]);

  return (
    <>
      <style>{css}</style>
      <div className="lbl lbl-print">
        <div className="lbl-head">INVOICE</div>

        <div className="lbl-top">
          <div className="lbl-company">{sender.company}</div>
          <div className="lbl-meta">
            <div><b>Order No:</b> {id}</div>
            <div><b>Date:</b> {order.date || new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>

        <div className="lbl-ft">
          <div>
            <h4>FROM:</h4>
            {sender.name}<br />{sender.address}<br />{sender.city}<br />{sender.phone}
          </div>
          <div className="lbl-to">
            <h4>TO:</h4>
            <div className="nm">{order.recipientName || "—"}</div>
            {order.phone && <>{order.phone}<br /></>}
            {order.address || "—"}
          </div>
        </div>

        <div className="lbl-details">
          <h4>DETAILS</h4>
          {shown.length > 0 && (
            <table className="lbl-items">
              <thead>
                <tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>TOTAL</th></tr>
              </thead>
              <tbody>
                {shown.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}{p.size ? ` (${p.size})` : ""}</td>
                    <td className="r">{p.qty || 1}</td>
                    <td className="r">{money(p.price)}</td>
                    <td className="r"><b>{money(Number(p.price || 0) * Number(p.qty || 1))}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {extra > 0 && <div>+{extra} more item(s)</div>}

          <div className="lbl-sum">
            <div className="lbl-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="lbl-row"><span>Courier / Delivery Charge</span><span>+ {money(delivery)}</span></div>
            {discount > 0 && (
              <div className="lbl-row"><span>Discount</span><span>- {money(discount)}</span></div>
            )}
            <div className="lbl-row lbl-total"><span>TOTAL</span><span>{money(total)}</span></div>
            <div className="lbl-row"><span>Advance Paid</span><span>- {money(advance)}</span></div>
            <div className="lbl-row lbl-due">
              <span>DUE / COD (COLLECT)</span>
              <span className="amt">{money(due)}</span>
            </div>
          </div>

          <div className="lbl-row" style={{ marginTop: 3 }}>
            <span>WEIGHT: {order.weight || "—"}</span>
            <span>COURIER: {order.courier || "—"}</span>
          </div>
        </div>

        <div className="lbl-cn">
          <span>CONSIGNMENT ID</span>
          <b>{order.consignmentId || "—"}</b>
        </div>

        <div className="lbl-bottom">
          <div className="lbl-bc">
            <small>Barcode Code:</small>
            <svg ref={barcodeRef} />
          </div>
          <div>
            <small>Handle With Care Pls</small>
            <Icons />
          </div>
        </div>

        <div className="lbl-foot">
          <span>Approved #{id}</span>
          <span>www.yourcompanyname.com</span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preview popup (Print / Download corner e thakbe)                    */
/* ------------------------------------------------------------------ */

const LABEL_W = 384; // 4in @ 96dpi
const LABEL_H = 576; // 6in @ 96dpi

const modalCss = `
.lbl-modal { position: fixed; inset: 0; z-index: 99999; background: rgba(15,15,15,.92);
  display: flex; flex-direction: column; }
.lbl-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; color: #fff; flex: none; }
.lbl-bar-title { font: 600 14px Arial, sans-serif; }
.lbl-bar-actions { display: flex; gap: 8px; }
.lbl-btn { border: 0; border-radius: 8px; padding: 8px 12px; font: 600 13px Arial, sans-serif;
  cursor: pointer; background: #fff; color: #000; }
.lbl-btn.dark { background: #333; color: #fff; }
.lbl-btn[disabled] { opacity: .6; cursor: default; }
.lbl-modal-body { flex: 1; overflow: auto; display: flex; flex-direction: column;
  align-items: center; gap: 16px; padding: 8px 12px 28px; }
.lbl-scale-box { background: #fff; box-shadow: 0 6px 30px rgba(0,0,0,.5); flex: none; overflow: hidden; }
`;

export function LabelPreviewModal({ orders = [], sender, onClose }) {
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(1);
  const listRef = useRef(null);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / LABEL_W));
    fit();
    window.addEventListener("resize", fit);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handlePrint = () => window.print(); // print-root er shob label, prottek ta alada 4x6 page e

  // IMPORTANT: Download ei function-i use korbe. App er purono "invoice/sticker PDF" generator
  // ekhane call kora jabe na. Preview te ja dekha jay (4x6) hubohu seta-i PDF hobe.
  const handleDownload = async () => {
    const nodes = Array.from(listRef.current?.querySelectorAll(".lbl-print") || []);
    if (!nodes.length) return;
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
      await toPng(nodes[0], opts); // warm-up (iPhone/Safari)
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [4, 6] });
      for (let i = 0; i < nodes.length; i++) {
        const dataUrl = await toPng(nodes[i], opts);
        if (i > 0) pdf.addPage([4, 6], "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, 4, 6);
      }
      const name =
        orders.length === 1
          ? `Invoice-${orders[0].id || "label"}.pdf`
          : `Invoices-${orders.length}-orders.pdf`;
      pdf.save(name);
    } catch (e) {
      console.error(e);
      alert("Download hoyni. Abar try korun.");
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <>
      <style>{modalCss}</style>
      <div className="lbl-modal" onClick={onClose}>
        <div className="lbl-bar" onClick={(e) => e.stopPropagation()}>
          <span className="lbl-bar-title">
            Invoice Preview{orders.length > 1 ? ` (${orders.length} orders)` : ""}
          </span>
          <div className="lbl-bar-actions">
            <button type="button" className="lbl-btn" onClick={handlePrint}>Print</button>
            <button type="button" className="lbl-btn" onClick={handleDownload} disabled={busy}>
              {busy ? "Please wait..." : "Download"}
            </button>
            <button type="button" className="lbl-btn dark" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="lbl-modal-body" ref={listRef}>
          {orders.map((o, i) => (
            <div
              key={(o.id || "o") + i}
              className="lbl-scale-box"
              style={{ width: LABEL_W * scale, height: LABEL_H * scale }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="lbl-scale"
                style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: LABEL_W, height: LABEL_H }}
              >
                <CourierLabel order={o} sender={sender} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print-only copy: browser print e shudhu eta print hoy, prottek label 1 page */}
      <div className="lbl-print-root">
        {orders.map((o, i) => (
          <CourierLabel key={(o.id || "p") + i} order={o} sender={sender} />
        ))}
      </div>
    </>
  );

  return createPortal(modal, document.body);
}

/* Single order er jonno shortcut: button + popup ekshathe */
export default function CourierLabelButton({ order = {}, sender, buttonText = "Print Label", className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {buttonText}
      </button>
      {open && <LabelPreviewModal orders={[order]} sender={sender} onClose={() => setOpen(false)} />}
    </>
  );
}

```
