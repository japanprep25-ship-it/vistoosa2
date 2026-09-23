import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  Plus,
  Trash2,
  Package,
  MapPin,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  User,
  Phone,
  Mail,
  Truck,
  Building2,
  Receipt,
  ScanLine,
} from 'lucide-react';
import { Order, OrderChannel, OrderItem, Product } from '../types';
import { ALL_DISTRICT_NAMES, detectDistrict } from '../utils/districtDetector';

interface ItemFormState {
  id: string;
  eanCode: string;
  productName: string;
  color: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  quantity: number;
  unitPrice: number;
  sku: string;
  matched: boolean;
  warning?: string;
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: Partial<Order>) => void;
  initialOrder: Order | null;
  products: Product[];
}

// Calculate standard delivery fee according to District and Channel
export function calculateDeliveryFee(district: string, channel: string): number {
  if (channel === 'Showroom') {
    return 0;
  }
  const norm = (district || '').trim().toLowerCase();
  if (norm === 'dhaka') {
    return 70;
  }
  if (norm === 'narayanganj' || norm === 'gazipur') {
    return 100;
  }
  return 130;
}

// Lookup product variant from barcode / SKU / EAN
export function lookupEanCode(
  eanCode: string,
  products: Product[]
): {
  productName: string;
  color: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  sku: string;
  unitPrice: number;
  matched: boolean;
} {
  if (!eanCode || !eanCode.trim()) {
    return {
      productName: '',
      color: 'Default',
      size: 'M',
      sku: '',
      unitPrice: 0,
      matched: false,
    };
  }

  const clean = eanCode.trim().toLowerCase();

  for (const prod of products || []) {
    if (prod.variants) {
      for (const variant of prod.variants) {
        if (
          (variant.barcode && variant.barcode.trim().toLowerCase() === clean) ||
          (variant.sku && variant.sku.trim().toLowerCase() === clean)
        ) {
          return {
            productName: prod.name,
            color: prod.color || 'Default',
            size: variant.size,
            sku: variant.sku || variant.barcode || eanCode,
            unitPrice: prod.retailPrice || 0,
            matched: true,
          };
        }
      }
    }

    if (prod.id && prod.id.trim().toLowerCase() === clean) {
      const v = (prod.variants && prod.variants[0]) || { size: 'M', sku: prod.id };
      return {
        productName: prod.name,
        color: prod.color || 'Default',
        size: v.size,
        sku: v.sku || prod.id,
        unitPrice: prod.retailPrice || 0,
        matched: true,
      };
    }
  }

  return {
    productName: '',
    color: 'Default',
    size: 'M',
    sku: eanCode,
    unitPrice: 0,
    matched: false,
  };
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  products,
}) => {
  const isEditing = !!initialOrder;

  // Form State
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [channel, setChannel] = useState<OrderChannel>('WhatsApp');
  const [deliveryFee, setDeliveryFee] = useState(70);
  const [isManualDeliveryFee, setIsManualDeliveryFee] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid'>(
    'Cash on Delivery'
  );
  const [notes, setNotes] = useState('');
  const [disablePathaoPickup, setDisablePathaoPickup] = useState(false);
  const [isAutoDistrictDetected, setIsAutoDistrictDetected] = useState(false);

  // Items State
  const [items, setItems] = useState<ItemFormState[]>([]);

  // Barcode Scanner Modal State
  const [scanningItemIndex, setScanningItemIndex] = useState<number | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Initialize Form Data when initialOrder or isOpen changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialOrder) {
      // Editing Existing Order
      setOrderId(initialOrder.id);
      setCustomerName(initialOrder.customerName || '');
      setEmail(initialOrder.email || '');
      setPhone(initialOrder.phone || '');
      setAddress(initialOrder.address || '');

      const existingDist =
        initialOrder.district ||
        detectDistrict(initialOrder.address || '', initialOrder.city || '').district ||
        'Dhaka';
      setDistrict(existingDist);
      setChannel(initialOrder.channel || 'WhatsApp');
      setDisablePathaoPickup(
        initialOrder.disablePathaoPickup !== undefined
          ? initialOrder.disablePathaoPickup
          : initialOrder.channel === 'Showroom'
      );
      setDeliveryFee(
        initialOrder.deliveryFee !== undefined
          ? initialOrder.deliveryFee
          : calculateDeliveryFee(existingDist, initialOrder.channel || 'WhatsApp')
      );
      setPaymentMethod(initialOrder.paymentMethod || 'Cash on Delivery');
      setNotes(initialOrder.notes || '');

      // Populate Items
      if (initialOrder.items && initialOrder.items.length > 0) {
        const loadedItems: ItemFormState[] = initialOrder.items.map((it, idx) => {
          const matchedInfo = lookupEanCode(it.sku || '', products);
          return {
            id: it.id || `item-${Date.now()}-${idx}`,
            eanCode: it.sku || '',
            productName: it.productName || matchedInfo.productName || '',
            color: it.color || matchedInfo.color || 'Default',
            size: it.size || matchedInfo.size || 'M',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || matchedInfo.unitPrice || 0,
            sku: it.sku || '',
            matched: matchedInfo.matched || !!it.productName,
          };
        });
        setItems(loadedItems);
      } else {
        setItems([createDefaultItem()]);
      }
    } else {
      // Creating New Order
      const newGeneratedId = `VIS-${Math.floor(100000 + Math.random() * 900000)}`;
      setOrderId(newGeneratedId);
      setCustomerName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setDistrict('Dhaka');
      setChannel('WhatsApp');
      setDisablePathaoPickup(false);
      setDeliveryFee(70);
      setIsManualDeliveryFee(false);
      setPaymentMethod('Cash on Delivery');
      setNotes('');
      setIsAutoDistrictDetected(false);

      // Default first item with first product if available
      const defaultProd = products[0];
      const defaultVariant = defaultProd?.variants?.[0];
      const defaultItem: ItemFormState = {
        id: `item-${Date.now()}-0`,
        eanCode: defaultVariant?.barcode || defaultVariant?.sku || defaultProd?.id || '',
        productName: defaultProd?.name || '',
        color: defaultProd?.color || 'Default',
        size: defaultVariant?.size || 'M',
        quantity: 1,
        unitPrice: defaultProd?.retailPrice || 1650,
        sku: defaultVariant?.sku || defaultProd?.id || '',
        matched: !!defaultProd,
      };
      setItems([defaultItem]);
    }
  }, [isOpen, initialOrder, products]);

  // Helper to create a blank item row
  function createDefaultItem(): ItemFormState {
    const defaultProd = products[0];
    const defaultVariant = defaultProd?.variants?.[0];
    return {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eanCode: defaultVariant?.barcode || defaultVariant?.sku || defaultProd?.id || '',
      productName: defaultProd?.name || '',
      color: defaultProd?.color || 'Default',
      size: defaultVariant?.size || 'M',
      quantity: 1,
      unitPrice: defaultProd?.retailPrice || 1650,
      sku: defaultVariant?.sku || defaultProd?.id || '',
      matched: !!defaultProd,
    };
  }

  // Address change triggers auto-district detection
  const handleAddressChange = (val: string) => {
    setAddress(val);
    if (!val || !val.trim()) return;

    const detected = detectDistrict(val, '');
    if (detected.district && ALL_DISTRICT_NAMES.includes(detected.district)) {
      setDistrict(detected.district);
      setIsAutoDistrictDetected(true);

      // Recalculate delivery fee automatically if not manually overridden
      if (!isManualDeliveryFee) {
        setDeliveryFee(calculateDeliveryFee(detected.district, channel));
      }
    }
  };

  // District change updates delivery fee automatically
  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    setIsAutoDistrictDetected(false);
    if (!isManualDeliveryFee) {
      setDeliveryFee(calculateDeliveryFee(newDist, channel));
    }
  };

  // Channel change updates delivery fee automatically (Showroom -> ৳0) & disables Pathao pickup for Showroom
  const handleChannelChange = (newChannel: OrderChannel) => {
    setChannel(newChannel);
    if (newChannel === 'Showroom') {
      setDisablePathaoPickup(true);
    }
    if (!isManualDeliveryFee) {
      setDeliveryFee(calculateDeliveryFee(district, newChannel));
    }
  };

  // EAN Code Input Change Handler for an Item Row
  const handleItemEanChange = (index: number, ean: string) => {
    setItems((prev) => {
      const next = [...prev];
      const lookup = lookupEanCode(ean, products);

      if (lookup.matched) {
        next[index] = {
          ...next[index],
          eanCode: ean,
          productName: lookup.productName,
          color: lookup.color,
          size: lookup.size,
          sku: lookup.sku,
          unitPrice: lookup.unitPrice,
          matched: true,
          warning: undefined,
        };
      } else {
        next[index] = {
          ...next[index],
          eanCode: ean,
          matched: false,
          warning: ean.trim() ? 'এই EAN কোডের প্রোডাক্ট খুঁজে পাওয়া যায়নি' : undefined,
        };
      }
      return next;
    });
  };

  // Item Field Update Handler
  const updateItemField = (index: number, field: keyof ItemFormState, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setItems((prev) => [...prev, createDefaultItem()]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate Total Amount
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1),
    0
  );
  const totalAmount = itemsSubtotal + (Number(deliveryFee) || 0);

  // Camera Scanner Modal Effect
  useEffect(() => {
    if (scanningItemIndex === null) return;

    const html5Qrcode = new Html5Qrcode('camera-scanner-viewport');
    scannerRef.current = html5Qrcode;

    html5Qrcode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 160 } },
        (decodedText) => {
          handleItemEanChange(scanningItemIndex, decodedText);
          stopScanner();
        },
        () => {
          // ignore scan errors during camera frame feed
        }
      )
      .catch((err) => {
        console.warn('Camera access error:', err);
      });

    return () => {
      stopScanner();
    };
  }, [scanningItemIndex]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .catch(() => {})
        .then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
    }
    setScanningItemIndex(null);
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map items to OrderItem type
    const orderItems: OrderItem[] = items.map((it, idx) => ({
      id: it.id || `item-${Date.now()}-${idx}`,
      productName: it.productName || 'Vistoosa Apparel Item',
      sku: it.sku || it.eanCode || `VIS-SKU-${idx + 1}`,
      color: it.color || 'Default',
      size: it.size,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
    }));

    // Determine City Zone based on District
    let cityZone: 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka' = 'Outside Dhaka';
    if (district === 'Dhaka') cityZone = 'Inside Dhaka';
    else if (district === 'Gazipur' || district === 'Narayanganj') cityZone = 'Sub-Dhaka';

    const orderData: Partial<Order> = {
      id: orderId,
      customerName: customerName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      address: address.trim(),
      district,
      city: cityZone,
      channel,
      items: orderItems,
      deliveryFee: Number(deliveryFee) || 0,
      totalAmount,
      paymentMethod,
      disablePathaoPickup,
      status: initialOrder ? initialOrder.status : 'Pending',
      notes: notes.trim(),
      createdAt: initialOrder ? initialOrder.createdAt : new Date().toISOString(),
    };

    onSave(orderData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative my-6 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {isEditing ? 'Edit Vistoosa Order' : 'Create New Vistoosa Order'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                  {orderId}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEditing
                  ? 'Update order details, customer info, and items'
                  : 'Auto-detect district, camera EAN barcode scanning, and auto delivery calculation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 pt-4 flex-1 text-xs">
          {/* SECTION 1: ORDER ID & CHANNEL ORIGIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
            <div>
              <label className="block text-zinc-400 mb-1 font-semibold flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>ORDER ID (অর্ডার আইডি)</span>
                <span className="text-[10px] text-zinc-500 font-normal">(Auto-generated)</span>
              </label>
              <input
                type="text"
                readOnly
                value={orderId}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-amber-400 font-mono font-bold text-xs focus:outline-none cursor-not-allowed select-all"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>CHANNEL ORIGIN (অর্ডার সোর্স)</span>
              </label>
              <select
                value={channel}
                onChange={(e) => handleChannelChange(e.target.value as OrderChannel)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white font-semibold focus:outline-none focus:border-amber-500 transition cursor-pointer"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Facebook">Facebook</option>
                <option value="Website">Website</option>
                <option value="Showroom">Showroom (৳0 Delivery Fee)</option>
                <option value="Instagram">Instagram</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* SECTION 2: CUSTOMER INFORMATION */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-3.5">
            <div className="flex items-center gap-2 font-bold text-zinc-200 text-xs uppercase tracking-wider pb-1 border-b border-zinc-800">
              <User className="w-4 h-4 text-amber-400" />
              <span>Customer Information (গ্রাহকের তথ্য)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Customer Name (নাম) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Asif Mahmud"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Phone Number (ফোন নাম্বার) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Email (ইমেইল - ঐচ্ছিক)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            {/* Address & District Auto-Detect */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-zinc-400 mb-1 font-medium flex items-center justify-between">
                  <span>Delivery Street Address (ঠিকানা) <span className="text-rose-400">*</span></span>
                  {isAutoDistrictDetected && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3" /> Auto-detected District
                    </span>
                  )}
                </label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="House 42, Road 11, Block D, Banani / Gazipur / Chattogram"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 resize-none font-medium"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>District (জেলা - 64 Districts)</span>
                </label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {ALL_DISTRICT_NAMES.map((dName) => (
                    <option key={dName} value={dName}>
                      {dName}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  💡 Type address above to auto-detect district.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: EAN CODE & PRODUCT ITEMS */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <div className="flex items-center gap-2 font-bold text-zinc-200 text-xs uppercase tracking-wider">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Product Items (প্রোডাক্ট আইটেম তালিকা)</span>
              </div>

              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    item.warning
                      ? 'bg-rose-950/20 border-rose-500/50'
                      : item.matched
                      ? 'bg-zinc-950/80 border-emerald-500/30'
                      : 'bg-zinc-950/60 border-zinc-800'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* EAN / Barcode Input with Camera Scanner */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                        EAN Code / Barcode #{idx + 1}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={item.eanCode}
                          onChange={(e) => handleItemEanChange(idx, e.target.value)}
                          placeholder="e.g. 8901234567890"
                          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setScanningItemIndex(idx)}
                          className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer shrink-0"
                          title="Scan Barcode via Camera"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Product Name */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                        Product Name (প্রোডাক্ট)
                      </label>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItemField(idx, 'productName', e.target.value)}
                        placeholder="Auto-filled product name"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Size */}
                    <div className="md:col-span-1">
                      <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                        Size
                      </label>
                      <select
                        value={item.size}
                        onChange={(e) => updateItemField(idx, 'size', e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-2 py-2 text-amber-400 font-bold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-1">
                      <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                        Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemField(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-2 py-2 text-white font-bold text-xs text-center focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Unit Price (৳) - PROPERLY SIZED AND VISIBLE */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-zinc-300 mb-1 font-semibold">
                        Unit Price (দাম ৳) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-emerald-400 font-bold text-xs pointer-events-none">৳</span>
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemField(idx, 'unitPrice', Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 pl-6 pr-2 py-2 text-emerald-400 font-mono font-extrabold text-xs focus:outline-none focus:border-emerald-500 focus:bg-zinc-950 transition"
                        />
                      </div>
                    </div>

                    {/* Item Subtotal Preview Badge */}
                    <div className="md:col-span-1 flex flex-col justify-end">
                      <div className="px-2 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-right">
                        <span className="text-[9px] text-zinc-500 block uppercase font-medium">Total</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          ৳{((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1)).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Delete Item Button */}
                    <div className="md:col-span-1 flex justify-end pb-0.5">
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Warning / Match Status Indicator */}
                  {item.warning ? (
                    <div className="mt-2 text-[11px] text-rose-300 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{item.warning}</span>
                    </div>
                  ) : item.matched ? (
                    <div className="mt-2 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Product matched: {item.productName} ({item.size})</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: PATHAO PICKUP OPTION & DELIVERY CHARGE & PAYMENT METHOD */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-4">
            {/* PATHAO PICKUP REQUEST OPTION TOGGLE */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Pathao Courier Pickup Request (পাঠাও পিকআপ রিকোয়েস্ট)</span>
                </span>
                <p className="text-[11px] text-zinc-400">
                  {disablePathaoPickup
                    ? '🔴 Disabled: এই অর্ডারের জন্য Pathao-তে পিকআপ রিকোয়েস্ট পাঠানো হবে না (Manual/In-Store Delivery)'
                    : '🟢 Enabled: অর্ডার Approve করলে পাঠাও কুরিয়ারে অটোমেটিক পিকআপ রিকোয়েস্ট যাবে'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDisablePathaoPickup((prev) => !prev)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  disablePathaoPickup
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${disablePathaoPickup ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span>{disablePathaoPickup ? 'Pickup Off (বন্ধ)' : 'Pickup On (চালু)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Delivery Charge */}
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Delivery Charge (৳)</span>
                  </span>
                  {isManualDeliveryFee && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualDeliveryFee(false);
                        setDeliveryFee(calculateDeliveryFee(district, channel));
                      }}
                      className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Reset Auto
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => {
                      setIsManualDeliveryFee(true);
                      setDeliveryFee(Math.max(0, parseInt(e.target.value, 10) || 0));
                    }}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {channel === 'Showroom'
                    ? 'Showroom channel = ৳0'
                    : district === 'Dhaka'
                    ? 'Dhaka = ৳70'
                    : district === 'Gazipur' || district === 'Narayanganj'
                    ? 'Gazipur/Narayanganj = ৳100'
                    : 'Other Districts = ৳130'}
                </p>
              </div>

            {/* Payment Method */}
            <div>
              <label className="block text-zinc-400 mb-1 font-semibold">
                Payment Method (পেমেন্ট পদ্ধতি)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Prepaid">Prepaid</option>
              </select>
            </div>

            {/* Order Notes */}
            <div>
              <label className="block text-zinc-400 mb-1 font-semibold">
                Special Instruction / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special delivery notes, urgent tag, etc."
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

          {/* SECTION 5: TOTAL AMOUNT SUMMARY CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-amber-500/30 flex items-center justify-between shadow-lg">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Total Order Calculation
              </span>
              <div className="text-xs text-zinc-300 font-mono">
                Subtotal: ৳{itemsSubtotal.toLocaleString()} + Delivery: ৳{deliveryFee}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                Total Payable Amount
              </span>
              <div className="text-xl font-bold text-amber-400 font-mono">
                ৳{totalAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Submit Actions Footer */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 font-bold text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Create & Save Order'}</span>
            </button>
          </div>
        </form>

        {/* Camera Barcode Scanner Modal Overlay */}
        {scanningItemIndex !== null && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <ScanLine className="w-5 h-5" />
                  <span>Scan EAN / Barcode</span>
                </div>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-black min-h-48 flex items-center justify-center">
                <div id="camera-scanner-viewport" className="w-full h-full" />
              </div>

              <p className="text-xs text-zinc-400">
                Point your camera at the barcode on the apparel tag or poly pack
              </p>

              <button
                type="button"
                onClick={stopScanner}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
