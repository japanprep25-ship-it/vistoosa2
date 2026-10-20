import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode"; // npm install jsbarcode

/*
  Usage:
  <CourierLabel order={{
    id: "VIS-982105",
    date: "20/10/2026",
    recipientName: "Tanvir Hossain",
    phone: "01XXXXXXXXX",
    address: "GEC Circle, Nasirabad, Chattogram",
    courier: "Pathao",           // undefined hole "—" dekhabe
    consignmentId: "DL123456789", // Pathao consignment ID (na thakle Order ID barcode e jabe)
    products: [
      { name: "Polo T-Shirt", size: "L", qty: 2, price: 650 },  // price = per piece
      { name: "Panjabi", size: "M", qty: 1, price: 1200 }
    ],
    deliveryCharge: 120,   // courier charge
    discount: 100,         // optional
    advance: 0,            // optional (agey ja pay korse)
    weight: "1 KG"
    // cod likhte hobe na, auto calculate hoy. Chaile cod: 1500 diye override kora jay
  }} />
  <button onClick={() => window.print()}>Print Label</button>
*/

const SENDER = {
  company: "VISTOOSA",
  name: "Vistoosa Male Fashion",
  address: "Your Shop Address",
  city: "Your City",
  phone: "01XXXXXXXXX",
};

const css = `
@page { size: 4in 6in; margin: 0; }
.lbl { width: 4in; height: 6in; box-sizing: border-box; padding: 0.18in;
  background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif;
  display: flex; flex-direction: column; }
.lbl * { box-sizing: border-box; }
.lbl-head { background: #000; color: #fff; text-align: center; font-weight: 800;
  font-size: 17px; letter-spacing: .5px; padding: 7px 0; border-radius: 6px; }
.lbl-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 2px; }
.lbl-company { font-size: 20px; font-weight: 800; line-height: 1.05; }
.lbl-meta { font-size: 10px; line-height: 1.5; text-align: right; }
.lbl-meta b { font-weight: 700; }
.lbl-ft { display: flex; border-top: 1px solid #000; border-bottom: 1px solid #000; }
.lbl-ft > div { flex: 1; padding: 6px 6px 8px; font-size: 11px; line-height: 1.35; }
.lbl-ft > div + div { border-left: 1px solid #000; }
.lbl-ft h4 { margin: 0 0 8px; font-size: 10px; font-weight: 700; }
.lbl-to .nm { font-size: 14px; font-weight: 800; }
.lbl-details { padding: 5px 2px; font-size: 10.5px; border-bottom: 1px solid #000; line-height: 1.45; }
.lbl-details h4 { margin: 0 0 3px; font-size: 10px; font-weight: 700; }
.lbl-items { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
.lbl-items td { padding: 1px 0; border-bottom: 1px dotted #999; font-size: 10px; }
.lbl-items th { font-size: 8.5px; text-align: right; font-weight: 700; padding: 0 0 2px 6px; border-bottom: 1px solid #000; }
.lbl-items th:first-child { text-align: left; padding-left: 0; }
.lbl-items td.r { text-align: right; padding-left: 6px; white-space: nowrap; }
.lbl-items td.n { font-weight: 400; white-space: normal; }
.lbl-sum { margin-top: 3px; border-top: 1px solid #000; padding-top: 3px; }
.lbl-total { font-size: 12px; font-weight: 800; }
.lbl-row { display: flex; justify-content: space-between; gap: 8px; }
.lbl-cod { font-size: 17px; font-weight: 800; }
.lbl-cn { margin: 6px 0 0; border: 1.5px solid #000; border-radius: 4px; padding: 4px 8px;
  display: flex; justify-content: space-between; align-items: center; font-size: 10px; }
.lbl-cn b { font-size: 14px; letter-spacing: .5px; }
.lbl-bottom { display: flex; justify-content: space-between; align-items: center;
  padding-top: 8px; margin-top: auto; gap: 8px; }
.lbl-bottom small { font-size: 9px; display: block; margin-bottom: 2px; }
.lbl-icons { display: flex; gap: 5px; }
.lbl-icons span { width: 34px; height: 34px; background: #000; display: flex;
  align-items: center; justify-content: center; }
.lbl-icons svg { width: 22px; height: 22px; }
.lbl-foot { border-top: 1px solid #000; margin-top: 8px; padding-top: 5px;
  font-size: 9px; display: flex; justify-content: space-between; font-weight: 700; }

@media print {
  body * { visibility: hidden !important; }
  .lbl-print, .lbl-print * { visibility: visible !important; }
  .lbl-print { position: fixed; left: 0; top: 0; }
}
@media screen {
  .lbl-print { border: 1px solid #ccc; margin: 16px auto; }
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

export default function CourierLabel({ order = {}, sender = SENDER }) {
  const barcodeRef = useRef(null);
  const id = order.id || "VIS-000000";
  const code = order.consignmentId || id; // barcode e Pathao consignment ID, na thakle Order ID
  const items = Array.isArray(order.products) ? order.products : [];
  const MAX_ITEMS = 4; // 4x6 jayga kom, tai beshi hole "+N more"
  const shown = items.slice(0, MAX_ITEMS);
  const extra = items.length - shown.length;

  const money = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
  const subtotal = order.subtotal ?? items.reduce((a, p) => a + Number(p.price || 0) * Number(p.qty || 1), 0);
  const delivery = Number(order.deliveryCharge || 0);
  const discount = Number(order.discount || 0);
  const advance = Number(order.advance || 0);
  const total = subtotal + delivery - discount;
  const due = order.cod ?? Math.max(total - advance, 0); // COD = customer ke ja dite hobe

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, code, {
          format: "CODE128", width: 1.6, height: 38,
          displayValue: true, fontSize: 10, margin: 0,
        });
      } catch (e) { console.error(e); }
    }
  }, [code]);

  return (
    <>
      <style>{css}</style>
      <div className="lbl lbl-print">
        <div className="lbl-head">SHIPPING POST</div>

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
                    <td className="n">{p.name}{p.size ? ` (${p.size})` : ""}</td>
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
            {discount > 0 && <div className="lbl-row"><span>Discount</span><span>- {money(discount)}</span></div>}
            <div className="lbl-row lbl-total"><span>TOTAL</span><span>{money(total)}</span></div>
            {advance > 0 && <div className="lbl-row"><span>Advance Paid</span><span>- {money(advance)}</span></div>}
            <div className="lbl-row" style={{ alignItems: "center" }}>
              <span><b>COD (COLLECT)</b></span>
              <span className="lbl-cod">{money(due)}</span>
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
          <div>
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
