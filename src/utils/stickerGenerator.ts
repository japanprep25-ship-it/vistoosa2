import { jsPDF } from 'jspdf';
import { Order } from '../types';

export function generateCourierSticker(orders: Order[]): void {
  // 4x6 inches = 101.6mm x 152.4mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [101.6, 152.4],
  });

  orders.forEach((order, index) => {
    if (index > 0) doc.addPage();
    
    // Simple mock layout for sticker
    doc.setFontSize(12);
    doc.text(`Order ID: ${order.id}`, 10, 20);
    doc.text(`Recipient: ${order.customerName}`, 10, 30);
    doc.text(`Address: ${order.address}`, 10, 40);
    doc.text(`Courier: ${order.courier}`, 10, 50);
    
    // Add QR code or barcode here if needed
  });

  doc.save('courier_stickers.pdf');
}
