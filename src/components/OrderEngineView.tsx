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
  Trash2,
  ArrowLeft,
  AlertTriangle,
  CheckSquare,
  Square,
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
import { OrderFormModal } from './OrderFormModal';

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
  onSoftDeleteOrders?: (orderIds: string[]) => void;
  onRestoreOrders?: (orderIds: string[]) => void;
  onPermanentDeleteOrders?: (orderIds: string[]) => void;
}

export const OrderEngineView: React.FC<OrderEngineViewProps> = ({
  orders,
  products,
  onApproveOrder,
  onCancelOrder,
  onGoToDispatch,
  onCreateOrder,
  onUpdateOrder,
  onSoftDeleteOrders,
  onRestoreOrders,
  onPermanentDeleteOrders,
}) => {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<OrderFilterState>(initialFilterState);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Trash & Bulk selection state
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [engineViewMode, setEngineViewMode] = useState<'queue' | 'dashboard'>('queue');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSoftDeleteConfirmOpen, setIsSoftDeleteConfirmOpen] = useState(false);
  const [isPermanentDeleteConfirmOpen, setIsPermanentDeleteConfirmOpen] = useState(false);

  // Return sub-filter state
  const [returnSubFilter, setReturnSubFilter] = useState<'all' | 'Return' | 'Paid Return'>('all');

  // Dashboard view date range filter
  const [dashboardFromDate, setDashboardFromDate] = useState('');
  const [dashboardToDate, setDashboardToDate] = useState('');

  // Partition orders into Active (non-deleted) and Trashed (isDeleted: true)
  const activeOrders = useMemo(() => orders.filter((o) => !o.isDeleted), [orders]);
  const trashedOrders = useMemo(() => orders.filter((o) => o.isDeleted === true), [orders]);

  // Compute status counts for badge tabs
  const statusCounts = useMemo(() => {
    const list = activeOrders;
    return {
      all: list.length,
      pending: list.filter((o) => o.status === 'Pending').length,
      approved: list.filter((o) => o.status === 'Approved').length,
      dispatched: list.filter((o) => o.status === 'Dispatched').length,
      delivered: list.filter((o) => o.status === 'Delivered').length,
      returnTotal: list.filter(
        (o) =>
          o.status === 'Return' ||
          o.status === 'Paid Return' ||
          o.pathaoStatus === 'Return' ||
          o.pathaoStatus === 'Paid Return'
      ).length,
      returnStandard: list.filter(
        (o) =>
          (o.status === 'Return' || o.pathaoStatus === 'Return') &&
          o.status !== 'Paid Return' &&
          o.pathaoStatus !== 'Paid Return'
      ).length,
      returnPaid: list.filter((o) => o.status === 'Paid Return' || o.pathaoStatus === 'Paid Return').length,
    };
  }, [activeOrders]);

  // Handle opening Pathao tracking URL in new tab
  const handleOpenTrackingUrl = (order?: Order) => {
    if (!order) return;
    if (order.channel === 'Showroom') {
      alert('Showroom Direct Sale: In-store order — No courier tracking URL available.');
      return;
    }
    const trackingId = order.pathaoConsignmentId || order.pathaoTrackingId;
    if (trackingId) {
      window.open(`https://pathao.com/courier/tracking/?consignment_id=${trackingId}`, '_blank');
    } else {
      alert('No Pathao tracking ID found for this order.');
    }
  };

  // CSV Export & Import State
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<ParsedImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');

  // CSV Export Handler with Date Range Filter (Active orders only)
  const handleExportCsv = () => {
    let filtered = [...activeOrders];

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

  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
  };

  // Filter Active orders using the filter panel criteria and Return sub-filter
  const filteredActiveOrders = useMemo(() => {
    let list = filterOrders(activeOrders, filters, searchQuery);

    if (filters.statuses.includes('Return' as OrderStatus)) {
      if (returnSubFilter === 'Return') {
        list = list.filter(
          (o) =>
            (o.status === 'Return' || o.pathaoStatus === 'Return') &&
            o.status !== 'Paid Return' &&
            o.pathaoStatus !== 'Paid Return'
        );
      } else if (returnSubFilter === 'Paid Return') {
        list = list.filter(
          (o) => o.status === 'Paid Return' || o.pathaoStatus === 'Paid Return'
        );
      } else {
        list = list.filter(
          (o) =>
            o.status === 'Return' ||
            o.status === 'Paid Return' ||
            o.pathaoStatus === 'Return' ||
            o.pathaoStatus === 'Paid Return'
        );
      }
    }
    return list;
  }, [activeOrders, filters, searchQuery, returnSubFilter]);

  // Filter active orders for Order Engine Analytics Dashboard based on Date Range
  const dashboardFilteredOrders = useMemo(() => {
    let list = [...activeOrders];
    if (dashboardFromDate) {
      const fromTime = new Date(`${dashboardFromDate}T00:00:00`).getTime();
      list = list.filter((o) => new Date(o.createdAt || 0).getTime() >= fromTime);
    }
    if (dashboardToDate) {
      const toTime = new Date(`${dashboardToDate}T23:59:59`).getTime();
      list = list.filter((o) => new Date(o.createdAt || 0).getTime() <= toTime);
    }
    return list;
  }, [activeOrders, dashboardFromDate, dashboardToDate]);

  // Dashboard KPI metrics
  const dashboardMetrics = useMemo(() => {
    const list = dashboardFilteredOrders;
    const totalOrders = list.length;
    const deliveredCount = list.filter((o) => o.status === 'Delivered').length;
    const returnStandardCount = list.filter(
      (o) =>
        (o.status === 'Return' || o.pathaoStatus === 'Return') &&
        o.status !== 'Paid Return' &&
        o.pathaoStatus !== 'Paid Return'
    ).length;
    const returnPaidCount = list.filter(
      (o) => o.status === 'Paid Return' || o.pathaoStatus === 'Paid Return'
    ).length;
    const returnTotalCount = returnStandardCount + returnPaidCount;

    const pendingCount = list.filter((o) => o.status === 'Pending').length;
    const approvedCount = list.filter((o) => o.status === 'Approved').length;
    const dispatchedCount = list.filter((o) => o.status === 'Dispatched').length;
    const cancelledCount = list.filter((o) => o.status === 'Cancelled').length;

    const totalRevenue = list.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Channels breakdown
    const channelMap: { [ch in OrderChannel]?: { count: number; total: number } } = {};
    (['WhatsApp', 'Facebook', 'Instagram', 'Website', 'Showroom'] as OrderChannel[]).forEach((ch) => {
      channelMap[ch] = { count: 0, total: 0 };
    });

    list.forEach((o) => {
      if (channelMap[o.channel]) {
        channelMap[o.channel]!.count += 1;
        channelMap[o.channel]!.total += o.totalAmount || 0;
      }
    });

    return {
      totalOrders,
      deliveredCount,
      returnTotalCount,
      returnStandardCount,
      returnPaidCount,
      pendingCount,
      approvedCount,
      dispatchedCount,
      cancelledCount,
      totalRevenue,
      channelMap,
    };
  }, [dashboardFilteredOrders]);

  // Filter Trashed orders using search query
  const filteredTrashedOrders = useMemo(() => {
    if (!searchQuery.trim()) return trashedOrders;
    const q = searchQuery.toLowerCase().trim();
    return trashedOrders.filter((o) => {
      const firstItem = o.items && o.items[0];
      return (
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        (o.district && o.district.toLowerCase().includes(q)) ||
        (firstItem?.productName && firstItem.productName.toLowerCase().includes(q))
      );
    });
  }, [trashedOrders, searchQuery]);

  // Displayed orders depending on viewMode ('active' vs 'trash')
  const displayedOrders = viewMode === 'active' ? filteredActiveOrders : filteredTrashedOrders;

  // Selection state helpers
  const isAllSelected =
    displayedOrders.length > 0 &&
    displayedOrders.every((o) => selectedOrderIds.includes(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(displayedOrders.map((o) => o.id));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Soft Delete Action Handler
  const handleConfirmSoftDelete = () => {
    if (selectedOrderIds.length === 0) return;
    if (onSoftDeleteOrders) {
      onSoftDeleteOrders(selectedOrderIds);
    }
    setSelectedOrderIds([]);
    setIsSoftDeleteConfirmOpen(false);
  };

  // Restore Action Handler
  const handleConfirmRestore = () => {
    if (selectedOrderIds.length === 0) return;
    if (onRestoreOrders) {
      onRestoreOrders(selectedOrderIds);
    }
    setSelectedOrderIds([]);
  };

  // Permanent Delete Action Handler
  const handleConfirmPermanentDelete = () => {
    if (selectedOrderIds.length === 0) return;
    if (onPermanentDeleteOrders) {
      onPermanentDeleteOrders(selectedOrderIds);
    }
    setSelectedOrderIds([]);
    setIsPermanentDeleteConfirmOpen(false);
  };

  const activeFilterCount = countActiveFilters(filters);

  const getStatusBadge = (status: OrderStatus, order?: Order) => {
    const hasTracking = Boolean(order?.pathaoTrackingId || order?.pathaoConsignmentId);
    const clickHandler = order ? () => handleOpenTrackingUrl(order) : undefined;
    const titleText = hasTracking
      ? 'Click to open Pathao Courier Tracking URL in new tab'
      : order?.channel === 'Showroom'
      ? 'Showroom Direct Sale (In-store order — No courier tracking)'
      : undefined;

    switch (status) {
      case 'Pending':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 ${
              order ? 'cursor-pointer hover:bg-amber-500/25 transition' : ''
            }`}
          >
            <Clock className="w-3 h-3 text-amber-400" />
            Pending Review
          </span>
        );
      case 'Approved':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 ${
              order ? 'cursor-pointer hover:bg-blue-500/25 transition' : ''
            }`}
          >
            <Truck className="w-3 h-3 text-blue-400" />
            Approved • Ready for Packing
            {hasTracking && <ExternalLink className="w-2.5 h-2.5 text-blue-400 ml-0.5" />}
          </span>
        );
      case 'Dispatched':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 ${
              order ? 'cursor-pointer hover:bg-purple-500/25 transition' : ''
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Dispatched • In Transit
            {hasTracking && <ExternalLink className="w-2.5 h-2.5 text-purple-300 ml-0.5" />}
          </span>
        );
      case 'Delivered':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${
              order ? 'cursor-pointer hover:bg-emerald-500/25 transition' : ''
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Delivered
            {hasTracking && <ExternalLink className="w-2.5 h-2.5 text-emerald-300 ml-0.5" />}
          </span>
        );
      case 'Return':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 ${
              order ? 'cursor-pointer hover:bg-rose-500/25 transition' : ''
            }`}
          >
            <RotateCcw className="w-3 h-3 text-rose-400" />
            Return
            {hasTracking && <ExternalLink className="w-2.5 h-2.5 text-rose-300 ml-0.5" />}
          </span>
        );
      case 'Paid Return':
        return (
          <span
            onClick={clickHandler}
            title={titleText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 ${
              order ? 'cursor-pointer hover:bg-amber-500/30 transition' : ''
            }`}
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            Paid Return
            {hasTracking && <ExternalLink className="w-2.5 h-2.5 text-amber-300 ml-0.5" />}
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

        {/* Action Controls: Engine View Mode, CSV Import, Date-filtered Export, Trash, New Order */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Order Engine View Mode Switcher (Queue vs Dashboard) */}
          <div className="flex items-center p-1 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setEngineViewMode('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                engineViewMode === 'queue'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders Queue</span>
            </button>
            <button
              onClick={() => setEngineViewMode('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                engineViewMode === 'dashboard'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Trash Toggle Button */}
          <button
            onClick={() => {
              setViewMode((prev) => (prev === 'active' ? 'trash' : 'active'));
              setSelectedOrderIds([]);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              viewMode === 'trash'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/10'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
            title="View Trashed & Soft Deleted Orders"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>{viewMode === 'trash' ? 'Back to Orders' : 'Trash'}</span>
            {trashedOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-mono font-bold">
                {trashedOrders.length}
              </span>
            )}
          </button>

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
              title="Export filtered active orders to CSV"
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

      {/* Trash Mode Banner */}
      {viewMode === 'trash' && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Trash / Deleted Orders (ট্র্যাশ তালিকা)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {trashedOrders.length} items
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Soft-deleted orders reside here. You can Restore them to active orders or Delete them Permanently.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setViewMode('active');
              setSelectedOrderIds([]);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Orders (মূল লিস্টে ফিরুন)</span>
          </button>
        </div>
      )}

      {/* ENGINE VIEW MODE: DASHBOARD VS QUEUE */}
      {engineViewMode === 'dashboard' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Date Range Controls */}
          <div className="glass-panel rounded-3xl p-5 border border-amber-500/20 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Order Engine Analytics & Channel Dashboard</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select date range to filter total orders, delivery rate, returns, and channel breakdown.
                </p>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDashboardFromDate(today);
                    setDashboardToDate(today);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 font-medium transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setDashboardFromDate(weekAgo);
                    setDashboardToDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 font-medium transition cursor-pointer"
                >
                  This Week
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setDashboardFromDate(monthAgo);
                    setDashboardToDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 font-medium transition cursor-pointer"
                >
                  This Month
                </button>
                <button
                  onClick={() => {
                    setDashboardFromDate('');
                    setDashboardToDate('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
                >
                  All Time
                </button>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">From Date:</span>
                <input
                  type="date"
                  value={dashboardFromDate}
                  onChange={(e) => setDashboardFromDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">To Date:</span>
                <input
                  type="date"
                  value={dashboardToDate}
                  onChange={(e) => setDashboardToDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                />
              </div>
              <span className="text-xs text-amber-400 font-mono font-bold ml-auto">
                Showing {dashboardMetrics.totalOrders} order(s) in selected date range
              </span>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Orders */}
            <div className="glass-card rounded-2xl p-5 border-amber-500/30">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Total Orders (মোট অর্ডার)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-amber-400 font-mono">
                  {dashboardMetrics.totalOrders}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  ৳{dashboardMetrics.totalRevenue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Delivered Orders */}
            <div className="glass-card rounded-2xl p-5 border-emerald-500/30">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Delivered Orders (ডেলিভার্ড)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-emerald-400 font-mono">
                  {dashboardMetrics.deliveredCount}
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  {dashboardMetrics.totalOrders > 0
                    ? `${Math.round((dashboardMetrics.deliveredCount / dashboardMetrics.totalOrders) * 100)}% Success Rate`
                    : '0%'}
                </span>
              </div>
            </div>

            {/* Returns Total */}
            <div className="glass-card rounded-2xl p-5 border-rose-500/30">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                Returns (রিটার্ন মোট)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-rose-400 font-mono">
                  {dashboardMetrics.returnTotalCount}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Std: {dashboardMetrics.returnStandardCount} • Paid: {dashboardMetrics.returnPaidCount}
                </span>
              </div>
            </div>

            {/* Pending & In-Pipeline */}
            <div className="glass-card rounded-2xl p-5 border-blue-500/30">
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">
                In Pipeline (প্রসেসিং)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-300 font-mono">
                  {dashboardMetrics.pendingCount + dashboardMetrics.approvedCount + dashboardMetrics.dispatchedCount}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  P:{dashboardMetrics.pendingCount} | A:{dashboardMetrics.approvedCount} | D:{dashboardMetrics.dispatchedCount}
                </span>
              </div>
            </div>
          </div>

          {/* Channel Breakdown Card */}
          <div className="glass-panel rounded-3xl p-6 border-zinc-800 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Channel Wise Order Breakdown (চ্যানেল পারফরম্যান্স)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {(['WhatsApp', 'Facebook', 'Instagram', 'Website', 'Showroom'] as OrderChannel[]).map((channel) => {
                const data = dashboardMetrics.channelMap[channel] || { count: 0, total: 0 };
                const pct =
                  dashboardMetrics.totalOrders > 0
                    ? Math.round((data.count / dashboardMetrics.totalOrders) * 100)
                    : 0;

                return (
                  <div key={channel} className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getChannelColor(channel)}`}>
                        {channel}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">{pct}%</span>
                    </div>

                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-white font-mono">{data.count}</span>
                      <span className="text-xs text-zinc-400 font-mono">৳{data.total.toLocaleString()}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
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

          {/* Status Filter Tabs with Badge Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'All', label: 'All', count: statusCounts.all },
              { id: 'Pending', label: t('orders.pendingTab'), count: statusCounts.pending },
              { id: 'Approved', label: t('orders.approvedTab'), count: statusCounts.approved },
              { id: 'Dispatched', label: t('orders.dispatchedTab'), count: statusCounts.dispatched },
              { id: 'Delivered', label: t('orders.deliveredTab'), count: statusCounts.delivered },
              { id: 'Return', label: 'Return', count: statusCounts.returnTotal },
            ].map((tab) => {
              const isActive =
                tab.id === 'All'
                  ? filters.statuses.length === 0
                  : filters.statuses.includes(tab.id as OrderStatus);

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'All') {
                      setFilters((prev) => ({ ...prev, statuses: [] }));
                    } else {
                      setFilters((prev) => ({ ...prev, statuses: [tab.id as OrderStatus] }));
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm shadow-amber-500/20'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-zinc-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
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

        {/* Return Sub-Tabs Bar (Shown when Return status is selected) */}
        {filters.statuses.includes('Return' as OrderStatus) && (
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-xs animate-fade-in">
            <span className="text-[11px] font-bold text-rose-300 px-2 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              Return Category Filter:
            </span>
            <button
              onClick={() => setReturnSubFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                returnSubFilter === 'all'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              All Returns ({statusCounts.returnTotal})
            </button>
            <button
              onClick={() => setReturnSubFilter('Return')}
              className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                returnSubFilter === 'Return'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Standard Return ({statusCounts.returnStandard})
            </button>
            <button
              onClick={() => setReturnSubFilter('Paid Return')}
              className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                returnSubFilter === 'Paid Return'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Paid Return ({statusCounts.returnPaid})
            </button>
          </div>
        )}

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

        {/* Counter Readout & Selection Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-zinc-400 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-700 text-xs font-bold transition cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-zinc-500" />
              )}
              <span>Select All ({displayedOrders.length})</span>
            </button>
            <span className="font-mono">
              Showing <strong className="text-amber-400 font-bold">{displayedOrders.length}</strong> of{' '}
              {viewMode === 'active' ? activeOrders.length : trashedOrders.length} {viewMode === 'active' ? 'active' : 'trashed'} orders
            </span>
          </div>

          {activeFilterCount > 0 && viewMode === 'active' && (
            <span className="text-[11px] text-amber-400 font-sans font-semibold">
              ({activeFilterCount} active filter criteria)
            </span>
          )}
        </div>

        {/* Floating Bulk Action Bar when items are selected */}
        {selectedOrderIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xl shadow-amber-500/5 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs font-mono">
                {selectedOrderIds.length}
              </span>
              <span className="text-xs font-bold text-amber-200">
                {selectedOrderIds.length}টি অর্ডার সিলেক্ট করা হয়েছে
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {viewMode === 'active' ? (
                <button
                  onClick={() => setIsSoftDeleteConfirmOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 active:scale-95 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected ({selectedOrderIds.length})</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleConfirmRestore}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restore Selected ({selectedOrderIds.length})</span>
                  </button>
                  <button
                    onClick={() => setIsPermanentDeleteConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-700/20 active:scale-95 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently ({selectedOrderIds.length})</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedOrderIds([])}
                className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-3">
        {displayedOrders.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-3xl">
            <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-300">
              {viewMode === 'trash' ? 'Trash is empty (ট্র্যাশে কোনো অর্ডার নেই)' : 'No active orders found'}
            </p>
            <p className="text-xs text-zinc-500">
              {viewMode === 'trash'
                ? 'Soft-deleted orders will appear here for 30 days or until permanently removed.'
                : 'Try changing your search query or status filter'}
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => (
            <div
              key={order.id}
              className={`glass-card rounded-2xl p-4 transition-all duration-200 relative overflow-hidden ${
                selectedOrderIds.includes(order.id)
                  ? 'border-amber-500/60 bg-amber-500/5'
                  : 'hover:border-zinc-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Order Top Meta */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Select Row Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => handleToggleSelectOrder(order.id)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
                    />

                    <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {order.id}
                    </span>
                    {getStatusBadge(order.status, order)}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getChannelColor(
                        order.channel
                      )}`}
                    >
                      {order.channel}
                    </span>

                    {/* Dispatch Checklist Progress Badge */}
                    {(() => {
                      const totalCount = order.items?.length || 0;
                      const checkedCount =
                        order.items?.filter((i) => i.isDispatched || order.status === 'Dispatched').length || 0;
                      if (totalCount > 0) {
                        return (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                              checkedCount === totalCount
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            Checklist: {checkedCount}/{totalCount} verified
                          </span>
                        );
                      }
                      return null;
                    })()}

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

                  {/* Actions according to View Mode & Order State */}
                  <div className="flex items-center gap-2">
                    {viewMode === 'trash' ? (
                      <>
                        {order.deletedAt && (
                          <span className="text-[10px] text-rose-400 font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                            Deleted {new Date(order.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            if (onRestoreOrders) onRestoreOrders([order.id]);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                          title="Restore order back to active list"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrderIds([order.id]);
                            setIsPermanentDeleteConfirmOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                          title="Permanently remove order document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Permanently Delete</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {order.status === 'Pending' && (
                          <>
                            <button
                              id={`btn-edit-order-${order.id}`}
                              onClick={() => handleOpenEditModal(order)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-zinc-700 hover:border-amber-500/40 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                              title="Edit Customer Details, Phone, Address, Product, Size"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit</span>
                            </button>

                            <button
                              id={`btn-approve-order-${order.id}`}
                              onClick={() => onApproveOrder(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                              title="Trigger automated Pathao pickup and move to Approved"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Pathao Pickup</span>
                            </button>

                            <button
                              onClick={() => onCancelOrder(order.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-xs font-medium transition cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </>
                        )}

                        {order.status === 'Approved' && (
                          <button
                            id={`btn-dispatch-order-${order.id}`}
                            onClick={() => onGoToDispatch(order.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
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

                        {/* Direct Soft Delete Trash Icon */}
                        <button
                          onClick={() => {
                            setSelectedOrderIds([order.id]);
                            setIsSoftDeleteConfirmOpen(true);
                          }}
                          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Move Order to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

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
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {/* Shared Create Order Modal */}
      <OrderFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={(newOrderData) => {
          if (onCreateOrder) {
            onCreateOrder(newOrderData as Order);
          }
          setIsCreateModalOpen(false);
        }}
        initialOrder={null}
        products={products}
      />

      {/* Shared Edit Order Modal */}
      <OrderFormModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        onSave={(updatedOrderData) => {
          if (onUpdateOrder && editingOrder) {
            onUpdateOrder(updatedOrderData as Order);
          }
          setEditingOrder(null);
        }}
        initialOrder={editingOrder}
        products={products}
      />

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

      {/* Soft Delete Confirmation Modal */}
      {isSoftDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Move to Trash / ট্র্যাশে পাঠান</h3>
                <p className="text-xs text-zinc-400">Soft Delete Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
              আপনি কি নিশ্চিত এই <strong className="text-amber-400 font-bold">{selectedOrderIds.length}</strong> টি অর্ডার Trash-এ পাঠাতে চান? (পরবর্তীতে Trash থেকে রিস্টোর করা যাবে)
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsSoftDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                onClick={handleConfirmSoftDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 active:scale-95 transition cursor-pointer"
              >
                Move to Trash (ট্র্যাশে পাঠান)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Warning Confirmation Modal */}
      {isPermanentDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-rose-500/40 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-400">⚠️ Permanent Delete Warning</h3>
                <p className="text-xs text-zinc-400">স্থায়ীভাবে মুছে ফেলার সতর্কতা</p>
              </div>
            </div>

            <div className="text-xs text-zinc-200 leading-relaxed bg-rose-950/40 p-4 rounded-2xl border border-rose-500/30 space-y-2">
              <p className="font-bold text-rose-300">⚠️ এই অ্যাকশন Undo করা যাবে না!</p>
              <p>
                আপনি কি নিশ্চিত এই <strong className="text-amber-400 font-bold">{selectedOrderIds.length}</strong> টি অর্ডার সম্পূর্ণভাবে মুছে ফেলতে চান?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsPermanentDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                onClick={handleConfirmPermanentDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 active:scale-95 transition cursor-pointer"
              >
                Yes, Delete Permanently (হ্যাঁ, স্থায়ীভাবে মুছুন)
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
        totalOrdersCount={activeOrders.length}
        filteredOrdersCount={filteredActiveOrders.length}
      />
    </div>
  );
};
