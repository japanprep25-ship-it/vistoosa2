# TASK: Replace the courier label print with a new 4x6 inch "INVOICE" label design

## Problem
Right now, when I click "Print Label", my app prints a plain-text page that only shows:
Order ID, Recipient, Address, Courier: undefined.
I want it replaced with a proper designed courier label (design code is given below as `CourierLabel.jsx`).

## What I want you to do

1. **Create the component**
   Create a new file `components/CourierLabel.jsx` and paste the full component code from the "COMPONENT CODE" section at the bottom of this file, exactly as it is.

2. **Install the packages**
   Add these npm packages (the component imports them): `jsbarcode`, `html2canvas`, `jspdf`.

3. **Replace the old print logic**
   Find the existing code that prints the courier label / sticker / invoice (the one that prints plain text with Order ID, Recipient, Address, Courier).
   Remove that old print layout completely. The invoice must NOT stay open on the page and must NOT take any space in the page layout.
   Instead, put only a small **"Print Label"** button (the component `CourierLabelButton`) where the old print button was.
   Behaviour I want:
   - The invoice is hidden by default. Only the button is visible.
   - When I tap the button, a full-screen preview popup opens showing the 4x6 invoice.
   - In the top-right corner of the popup there are **Print**, **Download** (PDF) and **✕ close** buttons. This is already built in the component, do not change it.
   - Print prints only the invoice (4x6 inch). Download saves a 4x6 inch PDF named `Invoice-<orderId>.pdf`.

   Use it like this:
   ```jsx
   import CourierLabelButton from "./components/CourierLabel";

   <CourierLabelButton
     buttonText="Print Label"
     order={{
       id: order.id,                       // e.g. VIS-982105
       date: order.date,                   // dd/mm/yyyy
       recipientName: order.customerName,  // use whatever my field is called
       phone: order.phone,
       address: order.address,
       courier: order.courier,
       consignmentId: order.consignmentId, // Pathao consignment ID
       weight: order.weight || "1 KG",
       products: order.items.map(i => ({
         name: i.productName,
         size: i.size,
         qty: i.quantity,
         price: i.unitPrice                // price per piece
       })),
       deliveryCharge: order.deliveryCharge, // courier/delivery charge
       discount: order.discount,             // optional
       advance: order.advance                // amount customer already paid (0 if none)
     }}
   />
   ```
   Use my real field names from the existing code, do not invent new ones. If my existing button has its own styling/classes, pass them with the `className` prop.
   Do NOT pass `cod` manually, the component calculates it automatically, in this order on the invoice:
   Subtotal = sum of (price x qty), then Delivery Charge, Discount, TOTAL = Subtotal + Delivery Charge - Discount, then Advance Paid, then DUE / COD (COLLECT) = Total - Advance (the remaining amount the courier collects).
   The invoice DETAILS section shows: each product (name, size, qty, unit price, line total), Subtotal, Courier/Delivery Charge, Discount (if any), TOTAL, Advance Paid, and the remaining DUE / COD amount to collect, then Weight and Courier. If there are more than 4 items it shows "+N more item(s)".
   Make sure the order form saves `deliveryCharge`, `discount` and `advance` (if my app does not have them yet, add these number fields to the order form, default 0), and that every order item stores its unit `price`.

4. **Fix `Courier: undefined` bug**
   The `courier` field is not being saved with the order, so it prints "undefined".
   - In the order create/edit form, add a required **Courier** dropdown with: Pathao, Steadfast, RedX, Paperfly, Other.
   - Save the selected value in the order object as `courier`.
   - Make sure existing orders without a courier show "—" instead of "undefined".

5. **Pathao Consignment ID**
   - When an order is sent to Pathao (booking/dispatch), the consignment ID returned by Pathao must be saved in the order as `consignmentId`.
   - If my app already stores it under another name, use that name in the mapping above.
   - The label shows the Consignment ID in a bordered box and the barcode encodes the consignment ID (if it is missing, the barcode falls back to the Order ID).
   - Print Label button should be enabled only after a consignment ID exists, or show a warning "Consignment ID missing" before printing.

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
Tell me which files you changed and where the "Print Label" button is.

---

# COMPONENT CODE (`components/CourierLabel.jsx`)

```jsx
import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";   // npm install jsbarcode
import html2canvas from "html2canvas"; // npm install html2canvas
import { jsPDF } from "jspdf";         // npm install jspdf

/*
  Usage (page e jayga nei, shudhu ekta button dekhabe):

  import CourierLabelButton from "./components/CourierLabel";

  <CourierLabelButton order={{
    id: "VIS-982105",
    date: "20/10/2026",
    recipientName: "Tanvir Hossain",
    phone: "01XXXXXXXXX",
    address: "GEC Circle, Nasirabad, Chattogram",
    courier: "Pathao",
    consignmentId: "DL123456789",   // Pathao consignment ID (na thakle Order ID barcode e jabe)
    products: [
      { name: "Polo T-Shirt", size: "L", qty: 2, price: 650 },  // price = per piece
      { name: "Panjabi", size: "M", qty: 1, price: 1200 }
    ],
    deliveryCharge: 120,   // courier charge
    discount: 100,         // optional
    advance: 500,          // agey ja pay korse (0 hole 0 dekhabe)
    weight: "1 KG"
    // COD auto calculate hoy: Total - Advance
  }} />

  Button tap korle invoice preview open hoy. Upore dan corner e Print ar Download (PDF) button thake.
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

.lbl-head { background: #000; color: #fff; text-align: center; font-weight: 800;
  font-size: 15px; letter-spacing: 1px; padding: 4px 0; border-radius: 5px; flex: none; }

.lbl-top { display: flex; justify-content: space-between; align-items: center;
  padding: 4px 2px; flex: none; }
.lbl-company { font-size: 18px; font-weight: 800; line-height: 1.05; }
.lbl-meta { font-size: 9.5px; line-height: 1.4; text-align: right; }

.lbl-ft { display: flex; border-top: 1px solid #000; border-bottom: 1px solid #000; flex: none; }
.lbl-ft > div { flex: 1; min-width: 0; padding: 4px 5px 5px; font-size: 10px; line-height: 1.3;
  overflow-wrap: anywhere; }
.lbl-ft > div + div { border-left: 1px solid #000; }
.lbl-ft h4 { margin: 0 0 3px; font-size: 9px; font-weight: 700; }
.lbl-to .nm { font-size: 12.5px; font-weight: 800; }

.lbl-details { padding: 4px 2px; font-size: 10px; border-bottom: 1px solid #000;
  line-height: 1.35; flex: none; }
.lbl-details h4 { margin: 0 0 2px; font-size: 9px; font-weight: 700; }
.lbl-items { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
.lbl-items th { font-size: 8px; text-align: right; font-weight: 700; padding: 0 0 1px 5px;
  border-bottom: 1px solid #000; }
.lbl-items th:first-child { text-align: left; padding-left: 0; }
.lbl-items td { padding: 1px 0; border-bottom: 1px dotted #999; font-size: 9.5px; }
.lbl-items td.r { text-align: right; padding-left: 5px; white-space: nowrap; }
.lbl-sum { margin-top: 2px; border-top: 1px solid #000; padding-top: 2px; }
.lbl-row { display: flex; justify-content: space-between; gap: 6px; }
.lbl-total { font-size: 11px; font-weight: 800; }
.lbl-due { border-top: 1.5px solid #000; margin-top: 2px; padding-top: 2px;
  font-size: 12px; font-weight: 800; align-items: center; }
.lbl-due .amt { font-size: 15px; }

.lbl-cn { margin: 4px 0 0; border: 1.5px solid #000; border-radius: 4px; padding: 3px 7px;
  display: flex; justify-content: space-between; align-items: center; font-size: 9px; flex: none; }
.lbl-cn b { font-size: 13px; letter-spacing: .5px; }

.lbl-bottom { display: flex; align-items: flex-end; gap: 8px; padding-top: 5px;
  margin-top: auto; flex: none; }
.lbl-bottom small { font-size: 8px; display: block; margin-bottom: 1px; }
.lbl-bc { flex: 1; min-width: 0; }
.lbl-bc svg { display: block; width: 100%; height: 40px; }
.lbl-icons { display: flex; gap: 3px; }
.lbl-icons span { width: 26px; height: 26px; background: #000; display: flex;
  align-items: center; justify-content: center; }
.lbl-icons svg { width: 17px; height: 17px; }
.lbl-foot { border-top: 1px solid #000; margin-top: 4px; padding-top: 3px;
  font-size: 8px; display: flex; justify-content: space-between; font-weight: 700; flex: none; }

@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  body * { visibility: hidden !important; }
  .lbl-print, .lbl-print * { visibility: visible !important; }
  .lbl-print { position: fixed; left: 0; top: 0; break-inside: avoid; page-break-inside: avoid; }
  .lbl-scale { transform: none !important; }
  .lbl-scale-box { width: auto !important; height: auto !important; box-shadow: none !important; }
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
/* Button + Preview popup (Print / Download corner e thakbe)           */
/* ------------------------------------------------------------------ */

const LABEL_W = 384; // 4in @ 96dpi
const LABEL_H = 576; // 6in @ 96dpi

const modalCss = `
.lbl-modal { position: fixed; inset: 0; z-index: 9999; background: rgba(15,15,15,.92);
  display: flex; flex-direction: column; }
.lbl-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; color: #fff; flex: none; }
.lbl-bar-title { font: 600 14px Arial, sans-serif; }
.lbl-bar-actions { display: flex; gap: 8px; }
.lbl-btn { border: 0; border-radius: 8px; padding: 8px 12px; font: 600 13px Arial, sans-serif;
  cursor: pointer; background: #fff; color: #000; }
.lbl-btn.dark { background: #333; color: #fff; }
.lbl-btn[disabled] { opacity: .6; cursor: default; }
.lbl-modal-body { flex: 1; overflow: auto; display: flex; justify-content: center;
  align-items: flex-start; padding: 8px 12px 24px; }
.lbl-scale-box { background: #fff; box-shadow: 0 6px 30px rgba(0,0,0,.5); flex: none; overflow: hidden; }
@media print { .lbl-modal { background: none !important; } }
`;

export default function CourierLabelButton({
  order = {},
  sender,
  buttonText = "Print Label",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(1);
  const labelBoxRef = useRef(null);

  // mobile e screen er width onujayi preview chhoto kora
  useEffect(() => {
    if (!open) return;
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / LABEL_W));
    fit();
    window.addEventListener("resize", fit);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    const el = labelBoxRef.current?.querySelector(".lbl-print");
    if (!el) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        backgroundColor: "#ffffff",
        width: LABEL_W,
        height: LABEL_H,
        useCORS: true,
        onclone: (doc) => {
          const w = doc.querySelector(".lbl-scale");
          if (w) w.style.transform = "none";
          doc.querySelectorAll(".lbl-print svg").forEach((svg) => {
            const r = svg.getBoundingClientRect();
            if (r.width && r.height) {
              svg.setAttribute("width", r.width);
              svg.setAttribute("height", r.height);
            }
          });
        },
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [4, 6] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 4, 6);
      pdf.save(`Invoice-${order.id || "label"}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Download hoyni. Abar try korun.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{modalCss}</style>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {buttonText}
      </button>

      {open && (
        <div className="lbl-modal" onClick={() => setOpen(false)}>
          <div className="lbl-bar" onClick={(e) => e.stopPropagation()}>
            <span className="lbl-bar-title">Invoice Preview</span>
            <div className="lbl-bar-actions">
              <button type="button" className="lbl-btn" onClick={handlePrint}>
                Print
              </button>
              <button type="button" className="lbl-btn" onClick={handleDownload} disabled={busy}>
                {busy ? "Please wait..." : "Download"}
              </button>
              <button type="button" className="lbl-btn dark" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
          </div>

          <div className="lbl-modal-body">
            <div
              ref={labelBoxRef}
              className="lbl-scale-box"
              style={{ width: LABEL_W * scale, height: LABEL_H * scale }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="lbl-scale"
                style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: LABEL_W, height: LABEL_H }}
              >
                <CourierLabel order={order} sender={sender} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```
