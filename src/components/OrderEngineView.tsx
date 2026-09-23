import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ExternalLink,
  MessageSquare,
  Phone,
  Layers,
  ChevronRight,
  Filter,
  Sparkles,
  Bot,
  X,
  Image as ImageIcon,
  Edit2,
  Package,
  MapPin,
  RotateCcw,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Info,
  FileCheck,
  Check,
  FileText,
} from 'lucide-react';
import { Order, OrderStatus, OrderChannel, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ALL_DISTRICT_NAMES, detectDistrict } from '../utils/districtDetector';
import {
  OrderFilterPanel,
  OrderFilterState,
  initialFilterState,
  filterOrders,
  countActiveFilters,
} from './OrderFilterPanel';

export interface ParsedImportRow {
  rowNumber: number;
  customerName: string;
  product: string;
  productSize: string;
  eanCode: string;
  quantity: string;
  price: string;
  email: string;
  phone: string;
  status: string;
  orderDate: string;
  isValid: boolean;
  errors: string[];
}

interface OrderEngineViewProps {
  orders: Order[];
  products: Product[];
  onApproveOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onGoToDispatch: (orderId: string) => void;
  onCreateOrder: (newOrder: Partial<Order>) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
}

export const OrderEngineView: React.FC<OrderEngineViewProps> = ({
  orders,
  products,
  onApproveOrder,
  onCancelOrder,
  onGoToDispatch,
  onCreateOrder,
  onUpdateOrder,
}) => {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<OrderFilterState>(initialFilterState);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // CSV Export & Import State
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<ParsedImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');

  // CSV Export Handler with Date Range Filter
  const handleExportCsv = () => {
    let filtered = [...orders];

    if (exportFromDate) {
      const fromTime = new Date(`${exportFromDate}T00:00:00`).getTime();
      filtered = filtered.filter((o) => {
        const orderTime = new Date(o.createdAt || 0).getTime();
        return orderTime >= fromTime;
      });
    }

    if (exportToDate) {
      const toTime = new Date(`${exportToDate}T23:59:59`).getTime();
      filtered = filtered.filter((o) => {
        const orderTime = new Date(o.createdAt || 0).getTime();
        return orderTime <= toTime;
      });
    }

    const headers = [
      'Order ID',
      'Customer Name',
      'Email',
      'Phone',
      'Product',
      'Product Size',
      'EAN Code',
      'Quantity',
      'Price',
      'Status',
      'Order Date',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];

    filtered.forEach((o) => {
      const firstItem = o.items && o.items[0];
      const orderDateStr = o.createdAt
        ? new Date(o.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const row = [
        escapeCsv(o.id || ''),
        escapeCsv(o.customerName || ''),
        escapeCsv(o.email || ''),
        escapeCsv(o.phone || ''),
        escapeCsv(firstItem?.productName || ''),
        escapeCsv(firstItem?.size || ''),
        escapeCsv(firstItem?.sku || ''),
        firstItem?.quantity || 1,
        o.totalAmount || (firstItem?.unitPrice || 0) * (firstItem?.quantity || 1),
        escapeCsv(o.status || 'Pending'),
        escapeCsv(orderDateStr),
      ];

      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const fileNameFrom = exportFromDate || 'all';
    const fileNameTo = exportToDate || 'all';
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${fileNameFrom}_to_${fileNameTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Sample Template Download Handler
  const handleDownloadSampleTemplate = () => {
    const headers = [
      'Customer Name',
      'Product',
      'Product Size',
      'EAN Code',
      'Quantity',
      'Price',
      'Email',
      'Phone',
      'Status',
      'Order Date',
    ];

    const sampleRows = [
      [
        '"Rahim Ahmed"',
        '"Supima Cotton Polo"',
        '"L"',
        '"8901234567890"',
        '2',
        '1650',
        '"rahim@example.com"',
        '"01711000000"',
        '"Pending"',
        '"2026-09-23"',
      ].join(','),
      [
        '"Karim Chowdhury"',
        '"Slim Fit Denim"',
        '"M"',
        '"8901234567891"',
        '1',
        '2200',
        '""', // Optional email empty
        '"01812000000"',
        '"Approved"',
        '"2026-09-23"',
      ].join(','),
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'orders_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Parser & Validator
  const parseAndValidateCsvContent = (text: string): ParsedImportRow[] => {
    const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseCsvLine(lines[0]);
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const findHeaderIndex = (possibleNames: string[]) => {
      return headers.findIndex((h) =>
        possibleNames.some((name) => h === name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
    };

    const nameIdx = findHeaderIndex(['Customer Name', 'customername', 'customer_name', 'name']);
    const prodIdx = findHeaderIndex(['Product', 'productname', 'product_name', 'item']);
    const sizeIdx = findHeaderIndex(['Product Size', 'productsize', 'product_size', 'size']);
    const eanIdx = findHeaderIndex(['EAN Code', 'eancode', 'ean_code', 'ean', 'barcode', 'sku']);
    const qtyIdx = findHeaderIndex(['Quantity', 'qty', 'quantity']);
    const priceIdx = findHeaderIndex(['Price', 'unitprice', 'price', 'amount', 'totalamount']);
    const emailIdx = findHeaderIndex(['Email', 'email', 'customeremail']);
    const phoneIdx = findHeaderIndex(['Phone', 'phone', 'mobile', 'customerphone']);
    const statusIdx = findHeaderIndex(['Status', 'orderstatus', 'status']);
    const dateIdx = findHeaderIndex(['Order Date', 'orderdate', 'createdat', 'date']);

    const parsedRows: ParsedImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowValues = parseCsvLine(lines[i]);
      if (rowValues.length === 0 || rowValues.every((v) => !v)) continue;

      const customerName = nameIdx >= 0 ? rowValues[nameIdx] || '' : '';
      const product = prodIdx >= 0 ? rowValues[prodIdx] || '' : '';
      const productSize = sizeIdx >= 0 ? rowValues[sizeIdx] || '' : '';
      const eanCode = eanIdx >= 0 ? rowValues[eanIdx] || '' : '';
      const quantity = qtyIdx >= 0 ? rowValues[qtyIdx] || '' : '';
      const price = priceIdx >= 0 ? rowValues[priceIdx] || '' : '';
      const email = emailIdx >= 0 ? rowValues[emailIdx] || '' : '';
      const phone = phoneIdx >= 0 ? rowValues[phoneIdx] || '' : '';
      const status = statusIdx >= 0 ? rowValues[statusIdx] || '' : '';
      const orderDate = dateIdx >= 0 ? rowValues[dateIdx] || '' : '';

      const errors: string[] = [];

      // Validation logic for required fields
      if (!customerName) errors.push('Customer Name is required');
      if (!product) errors.push('Product is required');
      if (!productSize) errors.push('Product Size is required');

      const cleanEan = eanCode.replace(/\s+/g, '');
      if (!cleanEan) {
        errors.push('EAN Code is required');
      } else if (!/^\d+$/.test(cleanEan)) {
        errors.push('EAN Code must contain numbers only');
      }

      if (!quantity) {
        errors.push('Quantity is required');
      } else if (isNaN(Number(quantity)) || Number(quantity) <= 0) {
        errors.push('Quantity must be a positive number');
      }

      if (!price) {
        errors.push('Price is required');
      } else if (isNaN(Number(price)) || Number(price) < 0) {
        errors.push('Price must be a valid number');
      }

      // Email and Phone are OPTIONAL — no error if empty!

      parsedRows.push({
        rowNumber: i,
        customerName,
        product,
        productSize,
        eanCode,
        quantity,
        price,
        email,
        phone,
        status,
        orderDate,
        isValid: errors.length === 0,
        errors,
      });
    }

    return parsedRows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const parsed = parseAndValidateCsvContent(content);
      setParsedImportRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Confirm Import & Save Valid Orders to Firestore
  const handleConfirmImport = async () => {
    const validRows = parsedImportRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    const importedOrders: Order[] = [];

    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx];
      const qty = Number(row.quantity);
      const unitPrice = Number(row.price);

      let formattedStatus: OrderStatus = 'Pending';
      if (row.status) {
        const s = row.status.trim().toLowerCase();
        if (s.includes('approve') || s.includes('shipped')) formattedStatus = 'Approved';
        else if (s.includes('dispatch') || s.includes('transit')) formattedStatus = 'Dispatched';
        else if (s.includes('deliver')) formattedStatus = 'Delivered';
        else if (s.includes('cancel')) formattedStatus = 'Cancelled';
      }

      let dateVal = new Date().toISOString();
      if (row.orderDate && !isNaN(new Date(row.orderDate).getTime())) {
        dateVal = new Date(row.orderDate).toISOString();
      }

      const orderObj: Order = {
        id: `VIS-CSV-${Math.floor(100000 + Math.random() * 900000)}`,
        customerName: row.customerName,
        email: row.email || undefined,
        phone: row.phone || '',
        address: 'Imported via CSV',
        city: 'Inside Dhaka',
        channel: 'Website',
        items: [
          {
            id: `item-csv-${Date.now()}-${idx}`,
            productName: row.product,
            sku: row.eanCode,
            color: 'Default',
            size: row.productSize as any,
            quantity: qty,
            unitPrice: unitPrice,
          },
        ],
        totalAmount: unitPrice * qty,
        deliveryFee: 0,
        paymentMethod: 'Cash on Delivery',
        status: formattedStatus,
        createdAt: dateVal,
        notes: 'Imported via CSV File Upload',
      };

      importedOrders.push(orderObj);
      onCreateOrder(orderObj);
    }

    // Save directly to Firestore backend
    try {
      const authToken = localStorage.getItem('vistoosa_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      await fetch('/api/orders/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: importedOrders }),
      });
    } catch (err) {
      console.warn('Backend CSV import API sync fallback:', err);
    }

    setIsImporting(false);
    setIsImportModalOpen(false);
    setParsedImportRows([]);
    setUploadFileName('');
    setImportSuccessMsg(`Successfully imported ${validRows.length} order(s) into Firestore!`);
    setTimeout(() => setImportSuccessMsg(''), 6000);
  };

  // Edit Order Form State
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: 'Inside Dhaka' as 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka',
    district: '',
    pathaoCityId: undefined as number | undefined,
    channel: 'WhatsApp' as OrderChannel,
    productId: '',
    customProductName: '',
    size: 'M' as 'S' | 'M' | 'L' | 'XL' | 'XXL',
    quantity: 1,
    unitPrice: 1650,
    paymentMethod: 'Cash on Delivery' as 'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid',
    notes: '',
  });

  const handleOpenEditModal = (order: Order) => {
    const firstItem = order.items && order.items[0];
    const matchedProduct = products.find(
      (p) =>
        p.id === firstItem?.sku ||
        p.name.toLowerCase() === (firstItem?.productName || '').toLowerCase()
    );

    const autoDist = order.district || detectDistrict(order.address || '', order.city || '').district || '';

    setEditingOrder(order);
    setEditFormData({
      customerName: order.customerName || '',
      phone: order.phone || '',
      address: order.address || '',
      city: order.city || 'Inside Dhaka',
      district: autoDist,
      pathaoCityId: order.pathaoCityId,
      channel: order.channel || 'WhatsApp',
      productId: matchedProduct?.id || (products[0]?.id || ''),
      customProductName: firstItem?.productName || '',
      size: (firstItem?.size as any) || 'M',
      quantity: firstItem?.quantity || 1,
      unitPrice: firstItem?.unitPrice || 1650,
      paymentMethod: order.paymentMethod || 'Cash on Delivery',
      notes: order.notes || '',
    });
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const matchedProduct = products.find((p) => p.id === editFormData.productId);
    const resolvedProductName =
      editFormData.customProductName.trim() ||
      (matchedProduct ? matchedProduct.name : 'Vistoosa Garment');

    const matchedVariant = matchedProduct?.variants?.find((v) => v.size === editFormData.size);
    const resolvedSku =
      matchedVariant?.sku ||
      (editingOrder.items[0]?.sku
        ? `${editingOrder.items[0].sku.split('-')[0]}-${editFormData.size}`
        : `VIS-${editFormData.size}`);

    const unitPrice =
      editFormData.unitPrice > 0
        ? editFormData.unitPrice
        : matchedProduct?.retailPrice || 1650;

    const deliveryFee =
      editFormData.city === 'Inside Dhaka'
        ? 60
        : editFormData.city === 'Sub-Dhaka'
        ? 100
        : 150;

    const subtotal = unitPrice * editFormData.quantity;
    const totalAmount = subtotal + deliveryFee;

    const resolvedDistrict = editFormData.district || detectDistrict(editFormData.address, editFormData.city).district || undefined;

    const updatedOrder: Order = {
      ...editingOrder,
      customerName: editFormData.customerName.trim(),
      phone: editFormData.phone.trim(),
      address: editFormData.address.trim(),
      city: editFormData.city,
      district: resolvedDistrict,
      channel: editFormData.channel,
      items: [
        {
          id: editingOrder.items[0]?.id || `item-${editingOrder.id}-1`,
          productName: resolvedProductName,
          sku: resolvedSku,
          color: matchedProduct?.color || editingOrder.items[0]?.color || 'Midnight Navy',
          size: editFormData.size,
          quantity: editFormData.quantity,
          unitPrice,
        },
        // Preserve any secondary items if exist
        ...((editingOrder.items || []).slice(1)),
      ],
      totalAmount,
      deliveryFee,
      paymentMethod: editFormData.paymentMethod,
      notes: editFormData.notes.trim(),
    };

    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
    setEditingOrder(null);
  };

  // New Order Form state
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: 'Inside Dhaka' as 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka',
    district: '',
    channel: 'WhatsApp' as OrderChannel,
    productId: products[0]?.id || '',
    size: 'L' as 'S' | 'M' | 'L' | 'XL' | 'XXL',
    quantity: 1,
    paymentMethod: 'Cash on Delivery' as 'Cash on Delivery' | 'bKash' | 'Nagad',
    notes: '',
  });

  const filteredOrders = useMemo(
    () => filterOrders(orders, filters, searchQuery),
    [orders, filters, searchQuery]
  );

  const activeFilterCount = countActiveFilters(filters);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            Pending Review
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Truck className="w-3 h-3 text-blue-400" />
            Approved • Ready for Packing
          </span>
        );
      case 'Dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Dispatched • In Transit
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Delivered
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <XCircle className="w-3 h-3 text-zinc-500" />
            Cancelled
          </span>
        );
    }
  };

  const getChannelColor = (channel: OrderChannel) => {
    switch (channel) {
      case 'WhatsApp':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'Facebook':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'Instagram':
        return 'text-pink-400 border-pink-500/30 bg-pink-500/10';
      case 'Website':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'Showroom':
        return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = (products || []).find((p) => p.id === formData.productId) || (products && products[0]);
    if (!product) return;
    const variant = (product.variants || []).find((v) => v.size === formData.size) || (product.variants && product.variants[0]);
    if (!variant) return;
    const deliveryFee = formData.city === 'Inside Dhaka' ? 60 : formData.city === 'Sub-Dhaka' ? 100 : 150;
    const subtotal = product.retailPrice * formData.quantity;

    const distInfo = detectDistrict(formData.address, formData.city);
    const resolvedDistrict = formData.district || distInfo.district || undefined;

    const newOrder: Order = {
      id: `VIS-${Math.floor(2050 + Math.random() * 900)}`,
      customerName: formData.customerName,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      district: resolvedDistrict,
      channel: formData.channel,
      items: [
        {
          id: `item-${Date.now()}`,
          productName: product.name,
          sku: variant.sku,
          color: product.color,
          size: formData.size,
          quantity: formData.quantity,
          unitPrice: product.retailPrice,
        },
      ],
      totalAmount: subtotal + deliveryFee,
      deliveryFee,
      paymentMethod: formData.paymentMethod,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      notes: formData.notes,
    };

    onCreateOrder(newOrder);
    setIsCreateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {importSuccessMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-fade-in shadow-lg shadow-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importSuccessMsg}</span>
        </div>
      )}

      {/* Header & Metric Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {t('orders.title')}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
              Auto Pathao Webhook
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('orders.subtitle')}
          </p>
        </div>

        {/* Action Controls: CSV Import, Date-filtered Export, New Order */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Import from CSV Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Import from CSV</span>
          </button>

          {/* Export to CSV Date Range Group */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs">
            <div className="flex items-center gap-1 px-1.5 py-1">
              <span className="text-[11px] text-zinc-400 font-medium">From:</span>
              <input
                type="date"
                value={exportFromDate}
                onChange={(e) => setExportFromDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1">
              <span className="text-[11px] text-zinc-400 font-medium">To:</span>
              <input
                type="date"
                value={exportToDate}
                onChange={(e) => setExportToDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
              title="Export filtered orders to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to CSV</span>
            </button>
          </div>

          {/* New Manual Order Button */}
          <button
            id="btn-create-new-order"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Manual Order</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-2.5">
        <div className="glass-panel rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('orders.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full pb-1 md:pb-0 scrollbar-none">
            {(['All', 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'] as const).map(
              (st) => {
                let label = st;
                if (st === 'Pending') label = t('orders.pendingTab') as any;
                else if (st === 'Approved') label = t('orders.approvedTab') as any;
                else if (st === 'Dispatched') label = t('orders.dispatchedTab') as any;
                else if (st === 'Delivered') label = t('orders.deliveredTab') as any;
                else if (st === 'Cancelled') label = t('orders.cancelledTab') as any;

                const isActive =
                  st === 'All'
                    ? filters.statuses.length === 0
                    : filters.statuses.includes(st as OrderStatus);

                return (
                  <button
                    key={st}
                    onClick={() => {
                      if (st === 'All') {
                        setFilters((prev) => ({ ...prev, statuses: [] }));
                      } else {
                        setFilters((prev) => ({ ...prev, statuses: [st as OrderStatus] }));
                      }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm shadow-amber-500/20'
                        : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* Channel Select & Filter Panel Button */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <select
              value={
                filters.channels.length === 0
                  ? 'All'
                  : filters.channels.length === 1
                  ? filters.channels[0]
                  : 'Multiple'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'All') {
                  setFilters((prev) => ({ ...prev, channels: [] }));
                } else if (val !== 'Multiple') {
                  setFilters((prev) => ({ ...prev, channels: [val as OrderChannel] }));
                }
              }}
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="All">All Channels</option>
              {filters.channels.length > 1 && (
                <option value="Multiple">Multiple Channels ({filters.channels.length})</option>
              )}
              <option value="WhatsApp">WhatsApp</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="Website">Website</option>
              <option value="Showroom">Showroom</option>
            </select>

            {/* Excel Filter Panel Funnel Button */}
            <button
              id="btn-open-excel-filter-panel"
              onClick={() => setIsFilterPanelOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
              title="Open Excel Advanced Filter Panel"
            >
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-zinc-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-400" />
              Active Filters:
            </span>

            {/* Status Chips */}
            {filters.statuses.map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
              >
                Status: {st}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, statuses: f.statuses.filter((s) => s !== st) }))
                  }
                  className="hover:text-amber-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* District Chips */}
            {filters.districts.map((dist) => (
              <span
                key={dist}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >
                District: {dist}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, districts: f.districts.filter((d) => d !== dist) }))
                  }
                  className="hover:text-emerald-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Channel Chips */}
            {filters.channels.map((ch) => (
              <span
                key={ch}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30"
              >
                Channel: {ch}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, channels: f.channels.filter((c) => c !== ch) }))
                  }
                  className="hover:text-blue-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Payment Chips */}
            {filters.paymentMethods.map((pm) => (
              <span
                key={pm}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30"
              >
                Payment: {pm}
                <button
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      paymentMethods: f.paymentMethods.filter((p) => p !== pm),
                    }))
                  }
                  className="hover:text-purple-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Date Range Chip */}
            {(filters.fromDate || filters.toDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                Date: {filters.fromDate || 'Start'} to {filters.toDate || 'End'}
                <button
                  onClick={() => setFilters((f) => ({ ...f, fromDate: '', toDate: '' }))}
                  className="hover:text-sky-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Amount Range Chip */}
            {(filters.minAmount || filters.maxAmount) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                Amount: ৳{filters.minAmount || '0'} - ৳{filters.maxAmount || '∞'}
                <button
                  onClick={() => setFilters((f) => ({ ...f, minAmount: '', maxAmount: '' }))}
                  className="hover:text-emerald-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Pathao Status Chips */}
            {filters.pathaoStatuses.map((ps) => (
              <span
                key={ps}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
              >
                Pathao: {ps}
                <button
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      pathaoStatuses: f.pathaoStatuses.filter((p) => p !== ps),
                    }))
                  }
                  className="hover:text-amber-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Product Chips */}
            {filters.products.map((prod) => (
              <span
                key={prod}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 truncate max-w-xs"
              >
                Item: {prod}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, products: f.products.filter((p) => p !== prod) }))
                  }
                  className="hover:text-cyan-100 cursor-pointer ml-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Size Chips */}
            {filters.sizes.map((sz) => (
              <span
                key={sz}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono"
              >
                Size: {sz}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, sizes: f.sizes.filter((s) => s !== sz) }))
                  }
                  className="hover:text-orange-100 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Clear All Button */}
            <button
              onClick={() => setFilters(initialFilterState)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer ml-auto px-2 py-0.5"
            >
              <RotateCcw className="w-3 h-3" />
              Clear All
            </button>
          </div>
        )}

        {/* Counter Readout */}
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
          <span>
            Showing <strong className="text-amber-400 font-bold">{filteredOrders.length}</strong> of{' '}
            {orders.length} orders
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[11px] text-amber-400 font-sans font-semibold">
              ({activeFilterCount} active filter criteria)
            </span>
          )}
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-3xl">
            <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No orders found</p>
            <p className="text-xs text-zinc-500">Try changing your search query or status filter</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="glass-card rounded-2xl p-4 transition-all duration-200 hover:border-zinc-700 relative overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Order Top Meta */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {order.id}
                    </span>
                    {getStatusBadge(order.status)}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getChannelColor(
                        order.channel
                      )}`}
                    >
                      {order.channel}
                    </span>

                    {/* Meta / Inbound Source Tag */}
                    {order.source && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-300 font-medium">
                        {order.source === 'messenger'
                          ? 'Messenger DM'
                          : order.source === 'instagram'
                          ? 'Instagram DM'
                          : order.source === 'whatsapp'
                          ? 'WhatsApp Chat'
                          : order.source}
                      </span>
                    )}

                    {/* AI Verified Badge */}
                    {order.confidence === 'complete' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                        AI Verified
                      </span>
                    )}

                    {/* View Chat Transcript Button */}
                    {order.rawConversation && order.rawConversation.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedChatOrder(order)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold flex items-center gap-1 transition"
                      >
                        <MessageSquare className="w-2.5 h-2.5" />
                        <span>Chat Transcript ({order.rawConversation.length})</span>
                      </button>
                    )}

                    <span className="text-[10px] text-zinc-500">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2 pt-1">
                    <h4 className="text-sm font-bold text-zinc-100">{order.customerName}</h4>
                    <span className="text-xs font-mono text-zinc-400">{order.phone}</span>
                    <span className="text-xs text-zinc-400">• {order.address}</span>
                    {(() => {
                      const distName = order.district || detectDistrict(order.address || '', order.city || '').district;
                      return distName ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                          <MapPin className="w-2.5 h-2.5 text-amber-400" />
                          <span>District: {distName}</span>
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Order Items */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {order.productImageUrl && (
                      <a
                        href={order.productImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-7 h-7 rounded-lg overflow-hidden border border-zinc-700 hover:border-amber-500 transition shrink-0"
                        title="View image sent by customer"
                      >
                        <img
                          src={order.productImageUrl}
                          alt="Customer product photo"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    )}
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-1.5 text-xs bg-zinc-900/80 px-2.5 py-1 rounded-xl border border-zinc-800"
                      >
                        <span className="font-medium text-zinc-200">{item.productName}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                          {item.size}
                        </span>
                        {item.overriddenFromSize && (
                          <span className="text-[9px] text-amber-400 font-mono">
                            (override from {item.overriddenFromSize})
                          </span>
                        )}
                        <span className="text-zinc-500 text-[11px]">x{item.quantity}</span>
                        <span className="text-zinc-300 font-mono text-[11px]">
                          ৳{(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Pathao Tracking, Financials & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800/60">
                  {/* Financial Total */}
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-zinc-100 font-mono">
                      ৳{order.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {order.paymentMethod} (Incl. Delivery ৳{order.deliveryFee})
                    </p>
                    {order.pathaoTrackingId && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 mt-1">
                        <Truck className="w-3 h-3" />
                        <span>{order.pathaoTrackingId}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions according to Order State */}
                  <div className="flex items-center gap-2">
                    {order.status === 'Pending' && (
                      <>
                        <button
                          id={`btn-edit-order-${order.id}`}
                          onClick={() => handleOpenEditModal(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-zinc-700 hover:border-amber-500/40 text-xs font-semibold shadow-sm transition active:scale-95"
                          title="Edit Customer Details, Phone, Address, Product, Size"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          id={`btn-approve-order-${order.id}`}
                          onClick={() => onApproveOrder(order.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95"
                          title="Trigger automated Pathao pickup and move to Approved"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Pathao Pickup</span>
                        </button>

                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-xs font-medium transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}

                    {order.status === 'Approved' && (
                      <button
                        id={`btn-dispatch-order-${order.id}`}
                        onClick={() => onGoToDispatch(order.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Pack & Scan Barcode</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {order.status === 'Dispatched' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs">
                        <Truck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Pathao Pickup En Route</span>
                      </div>
                    )}

                    {/* Direct WhatsApp Call / Message */}
                    <a
                      href={`https://wa.me/880${order.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                        `Assalamu Alaikum ${order.customerName}, this is Vistoosa Haute Couture regarding your order #${order.id}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 hover:bg-zinc-800 transition"
                      title="WhatsApp Customer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={`tel:${order.phone}`}
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition"
                      title="Direct Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Create New Vistoosa Order</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Asif Mahmud"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Delivery Street Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="House, Road, Area, Dhaka"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">District (জেলা - 64 Districts)</label>
                  <select
                    value={formData.district || detectDistrict(formData.address, formData.city).district || ''}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Auto Detect District --</option>
                    {ALL_DISTRICT_NAMES.map((dName) => (
                      <option key={dName} value={dName}>
                        {dName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">City / Region Zone</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="Inside Dhaka">Inside Dhaka (৳60)</option>
                    <option value="Sub-Dhaka">Sub-Dhaka (৳100)</option>
                    <option value="Outside Dhaka">Outside Dhaka (৳150)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Channel Origin</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Website">Website</option>
                    <option value="Showroom">Showroom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">Product</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (৳{p.retailPrice})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Size</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                >
                  Create & Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pending Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Edit Pending Order</span>
                    <span className="font-mono text-xs text-amber-400">#{editingOrder.id}</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Modify customer details, delivery location, size, or product name
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Customer Name (নাম)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    placeholder="e.g. Asif Mahmud"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Phone Number (নাম্বার)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Delivery Address (অ্যাড্রেস)</label>
                <textarea
                  required
                  rows={2}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="House, Road, Area / Thana, District"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">District (জেলা - 64 Districts)</label>
                  <select
                    value={editFormData.district || detectDistrict(editFormData.address, editFormData.city).district || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500 text-xs"
                  >
                    <option value="">-- Auto Detect District --</option>
                    {ALL_DISTRICT_NAMES.map((dName) => (
                      <option key={dName} value={dName}>
                        {dName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">City / Delivery Zone</label>
                  <select
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Inside Dhaka">Inside Dhaka (৳60)</option>
                    <option value="Sub-Dhaka">Sub-Dhaka (৳100)</option>
                    <option value="Outside Dhaka">Outside Dhaka (৳150)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Channel Origin</label>
                  <select
                    value={editFormData.channel}
                    onChange={(e) => setEditFormData({ ...editFormData, channel: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Website">Website</option>
                    <option value="Showroom">Showroom</option>
                  </select>
                </div>
              </div>

              {/* Product selection and Custom Product Name */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    Product & Size Details (প্রোডাক্ট ও সাইজ)
                  </span>
                  <span className="text-[10px] text-zinc-500">Edit item specifications</span>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Catalog Product (প্রোডাক্ট নির্বাচন)</label>
                  <select
                    value={editFormData.productId}
                    onChange={(e) => {
                      const selProd = products.find((p) => p.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        productId: e.target.value,
                        customProductName: selProd ? selProd.name : editFormData.customProductName,
                        unitPrice: selProd ? selProd.retailPrice : editFormData.unitPrice,
                      });
                    }}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ৳{p.retailPrice}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">
                    Product Title (প্রোডাক্ট নেম) <span className="text-[10px] text-zinc-500">(editable)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.customProductName}
                    onChange={(e) => setEditFormData({ ...editFormData, customProductName: e.target.value })}
                    placeholder="e.g. Supima Pique Polo or Custom Item"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Size (সাইজ)</label>
                    <select
                      value={editFormData.size}
                      onChange={(e) => setEditFormData({ ...editFormData, size: e.target.value as any })}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    >
                      <option value="S">S (36-38")</option>
                      <option value="M">M (38-40")</option>
                      <option value="L">L (40-42")</option>
                      <option value="XL">XL (42-44")</option>
                      <option value="XXL">XXL (44-46")</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Quantity (পরিমাণ)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editFormData.quantity}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Unit Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.unitPrice}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          unitPrice: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Payment Method</label>
                  <select
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Total Preview</label>
                  <div className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-amber-400 font-mono font-bold">
                    ৳{((editFormData.unitPrice * editFormData.quantity) + (editFormData.city === 'Inside Dhaka' ? 60 : editFormData.city === 'Sub-Dhaka' ? 100 : 150)).toLocaleString()}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">
                      (৳{editFormData.city === 'Inside Dhaka' ? 60 : editFormData.city === 'Sub-Dhaka' ? 100 : 150} delivery)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Order Notes / Instructions</label>
                <input
                  type="text"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Special courier delivery instruction, urgent tag, etc."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-edit-order"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 font-bold text-zinc-950 shadow-md shadow-amber-500/20 active:scale-95 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Transcript Modal for Meta / Social Orders */}
      {selectedChatOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Chat Transcript & AI Parsing</span>
                    <span className="font-mono text-xs text-amber-400">#{selectedChatOrder.id}</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedChatOrder.customerName} • {selectedChatOrder.channel} ({selectedChatOrder.source || 'chat'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChatOrder(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Extraction Summary Banner */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-zinc-300">
                  AI Confidence:{' '}
                  <strong className="text-emerald-400 uppercase font-mono">
                    {selectedChatOrder.confidence || 'complete'}
                  </strong>
                </span>
              </div>
              {selectedChatOrder.missingFields && selectedChatOrder.missingFields.length > 0 ? (
                <span className="text-amber-400 text-[11px]">
                  Missing: {selectedChatOrder.missingFields.join(', ')}
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium">All details captured</span>
              )}
            </div>

            {/* Photo attachment if available */}
            {selectedChatOrder.productImageUrl && (
              <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-3">
                <img
                  src={selectedChatOrder.productImageUrl}
                  alt="Customer attachment"
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-zinc-200">Customer Sent Product Image</p>
                  <a
                    href={selectedChatOrder.productImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline text-[11px] inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>Open full photo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {selectedChatOrder.rawConversation && selectedChatOrder.rawConversation.length > 0 ? (
                selectedChatOrder.rawConversation.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      msg.sender === 'customer' || msg.sender === 'user' ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">
                        {msg.sender === 'customer' || msg.sender === 'user'
                          ? selectedChatOrder.customerName || 'Customer'
                          : 'Vistoosa Fashion AI'}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed whitespace-pre-line ${
                        msg.sender === 'customer' || msg.sender === 'user'
                          ? 'bg-zinc-900 text-zinc-200 border border-zinc-800'
                          : 'bg-purple-950/50 text-purple-200 border border-purple-800/40'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No transcript recorded for this order.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedChatOrder(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Import Orders from CSV
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Upload a CSV file to import orders directly into Firestore
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedImportRows([]);
                  setUploadFileName('');
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Bengali Instructions Guide Box */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Info className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>CSV কলামের নির্দেশিকা (CSV Column Instructions):</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSampleTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample Template</span>
                  </button>
                </div>

                <p className="font-medium text-amber-100">
                  CSV ফাইলে এই কলামগুলো থাকতে হবে (একই বানানে, প্রথম row-এ header হিসেবে):
                </p>

                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-2 text-[11px] text-amber-200/90 leading-relaxed font-mono">
                  <li><strong className="text-emerald-400">• Customer Name</strong> (আবশ্যক)</li>
                  <li><strong className="text-emerald-400">• Product</strong> (আবশ্যক)</li>
                  <li><strong className="text-emerald-400">• Product Size</strong> (আবশ্যক — যেমন S/M/L/XL)</li>
                  <li><strong className="text-emerald-400">• EAN Code</strong> (আবশ্যক — প্রোডাক্ট বারকোড, শুধু সংখ্যা)</li>
                  <li><strong className="text-emerald-400">• Quantity</strong> (আবশ্যক, সংখ্যা হতে হবে)</li>
                  <li><strong className="text-emerald-400">• Price</strong> (আবশ্যক, সংখ্যা হতে হবে)</li>
                  <li><strong className="text-zinc-300">• Email</strong> (ঐচ্ছিক — ফাঁকা রাখলে সমস্যা নেই)</li>
                  <li><strong className="text-zinc-300">• Phone</strong> (ঐচ্ছিক — ফাঁকা রাখলে সমস্যা নেই)</li>
                  <li><strong className="text-zinc-300">• Status</strong> (ঐচ্ছিক — Pending/Approved/etc., না দিলে Pending)</li>
                  <li><strong className="text-zinc-300">• Order Date</strong> (ঐচ্ছিক — YYYY-MM-DD, না দিলে আজকের তারিখ)</li>
                </ul>

                <p className="text-[11px] text-amber-300/80 italic pt-1 border-t border-amber-500/20">
                  💡 Order ID দেওয়ার দরকার নেই, এটা সিস্টেম নিজে তৈরি করবে।
                </p>
              </div>

              {/* File Upload Dropzone */}
              <div className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 rounded-2xl p-6 text-center transition bg-zinc-900/40 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-2xl bg-zinc-800/80 text-amber-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-amber-400 hover:underline">Click to browse</span>
                    <span className="text-zinc-400"> or drag and drop your CSV file here</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Supports standard UTF-8 encoded .CSV files</p>
                  {uploadFileName && (
                    <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {uploadFileName}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              {parsedImportRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        Import Preview Table ({parsedImportRows.length} Rows Parsed)
                      </h4>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        {parsedImportRows.filter((r) => r.isValid).length} Valid
                      </span>
                      {parsedImportRows.filter((r) => !r.isValid).length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                          {parsedImportRows.filter((r) => !r.isValid).length} Invalid
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-zinc-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-zinc-900/90 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Customer Name</th>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Size</th>
                          <th className="px-3 py-2">EAN Code</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Errors / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 bg-zinc-950 font-mono text-[11px]">
                        {parsedImportRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.isValid
                                ? 'hover:bg-zinc-900/50'
                                : 'bg-rose-950/20 border-l-2 border-l-rose-500 hover:bg-rose-950/30'
                            }
                          >
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                  <Check className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                                  <AlertCircle className="w-3.5 h-3.5" /> Error
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-sans font-medium text-white">{row.customerName || '—'}</td>
                            <td className="px-3 py-2 font-sans text-zinc-200">{row.product || '—'}</td>
                            <td className="px-3 py-2 text-amber-300 font-bold">{row.productSize || '—'}</td>
                            <td className="px-3 py-2 text-zinc-300">{row.eanCode || '—'}</td>
                            <td className="px-3 py-2 text-zinc-100">{row.quantity || '—'}</td>
                            <td className="px-3 py-2 text-emerald-300">৳{row.price || '0'}</td>
                            <td className="px-3 py-2 text-zinc-400 font-sans">{row.email || '—'}</td>
                            <td className="px-3 py-2 text-zinc-400">{row.phone || '—'}</td>
                            <td className="px-3 py-2 font-sans text-[10px]">
                              {row.isValid ? (
                                <span className="text-zinc-500">Ready to import</span>
                              ) : (
                                <span className="text-rose-300 font-semibold">{row.errors.join(', ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedImportRows([]);
                  setUploadFileName('');
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isImporting || parsedImportRows.filter((r) => r.isValid).length === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>
                      Import {parsedImportRows.filter((r) => r.isValid).length} Valid Order(s)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Advanced Filter Panel Drawer */}
      <OrderFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        orders={orders}
        filters={filters}
        onUpdateFilters={setFilters}
        onClearAll={() => setFilters(initialFilterState)}
        totalOrdersCount={orders.length}
        filteredOrdersCount={filteredOrders.length}
      />
    </div>
  );
};
