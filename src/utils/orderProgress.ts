import { Order, OrderStatus } from '../types';

export interface ProgressMilestone {
  key: string;
  statuses: OrderStatus[];
  labelBn: string;
  labelEn: string;
  percent: number;
}

export const ORDER_PROGRESS_MILESTONES: ProgressMilestone[] = [
  {
    key: 'placed',
    statuses: ['Pending Customer Confirmation', 'Customer Confirmed', 'Awaiting Staff Approval'],
    labelBn: 'অর্ডার গ্রহণ',
    labelEn: 'Order Placed',
    percent: 15
  },
  {
    key: 'confirmed',
    statuses: ['Order Confirmed'],
    labelBn: 'অর্ডার কনফার্ম',
    labelEn: 'Confirmed',
    percent: 32
  },
  {
    key: 'processing',
    statuses: ['Processing'],
    labelBn: 'প্রসেসিং চলছে',
    labelEn: 'Processing',
    percent: 48
  },
  {
    key: 'packed',
    statuses: ['Packed'],
    labelBn: 'প্যাকিং সম্পন্ন',
    labelEn: 'Packed',
    percent: 64
  },
  {
    key: 'shipped',
    statuses: ['Shipped'],
    labelBn: 'কুরিয়ারে হস্তান্তর',
    labelEn: 'Shipped',
    percent: 80
  },
  {
    key: 'out_for_delivery',
    statuses: ['Out for Delivery'],
    labelBn: 'ডেলিভারির পথে',
    labelEn: 'Out for Delivery',
    percent: 92
  },
  {
    key: 'delivered',
    statuses: ['Delivered'],
    labelBn: 'ডেলিভারি সম্পন্ন',
    labelEn: 'Delivered',
    percent: 100
  }
];

export interface EvaluatedMilestone extends ProgressMilestone {
  state: 'completed' | 'current' | 'upcoming' | 'cancelled';
  timestamp?: string;
}

export interface OrderProgressInfo {
  percent: number;
  activeStepIndex: number;
  isCancelledOrException: boolean;
  isTerminal: boolean;
  isConfirmed: boolean;
  trackingCode: string;
  stageLabelBn: string;
  stageLabelEn: string;
  descriptionBn: string;
  latestNote: string;
  milestones: EvaluatedMilestone[];
}

export function getTrackingCode(order: Pick<Order, 'trackingNumber' | 'courierTrackingCode'> | null | undefined): string {
  if (!order) return '';
  return String(order.trackingNumber || order.courierTrackingCode || '').trim();
}

export function generateInternalTrackingId(orderNumber?: string): string {
  const numPart = String(orderNumber || '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(-5)
    .toUpperCase();
  const randPart = Math.floor(1000 + Math.random() * 9000);
  return numPart ? `VT-TRK-${numPart}-${randPart}` : `VT-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function buildCourierTrackingUrl(
  courierName?: Order['courierName'] | string,
  trackingCode?: string,
  customUrl?: string
): string | undefined {
  const trimmedCustom = String(customUrl || '').trim();
  if (trimmedCustom && /^https?:\/\//i.test(trimmedCustom)) {
    return trimmedCustom;
  }
  const code = String(trackingCode || '').trim();
  if (!code || code.toUpperCase().startsWith('VT-TRK-') || code.toUpperCase().startsWith('VT-PKG-')) {
    return undefined;
  }
  if (courierName === 'Steadfast') {
    return `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;
  }
  if (courierName === 'Pathao') {
    return `https://pathao.com/courier-tracking/?consignment_id=${encodeURIComponent(code)}`;
  }
  if (courierName === 'RedX') {
    return `https://redx.com.bd/track-global-parcel/?trackingId=${encodeURIComponent(code)}`;
  }
  if (courierName === 'Paperfly') {
    return `https://go.paperfly.com.bd/track/${encodeURIComponent(code)}`;
  }
  if (courierName === 'eCourier') {
    return `https://ecourier.com.bd/tracking/`;
  }
  return undefined;
}

export function getOrderProgressInfo(order: Order): OrderProgressInfo {
  const status = order.orderStatus;
  const trackingCode = getTrackingCode(order);

  const exceptionStatuses: OrderStatus[] = [
    'Cancelled',
    'Cancellation Requested',
    'Return Requested',
    'Returned',
    'Refund Pending',
    'Refunded',
    'Failed Delivery'
  ];
  const isCancelledOrException = exceptionStatuses.includes(status);
  const isTerminal =
    status === 'Delivered' ||
    status === 'Cancelled' ||
    status === 'Returned' ||
    status === 'Refunded';

  const activeStepIndex = ORDER_PROGRESS_MILESTONES.findIndex((m) =>
    m.statuses.includes(status)
  );

  const isConfirmed = activeStepIndex >= 1;

  let percent = 15;
  if (isCancelledOrException) {
    percent = 0;
  } else if (activeStepIndex >= 0) {
    percent = ORDER_PROGRESS_MILESTONES[activeStepIndex].percent;
  }

  let stageLabelBn = 'অর্ডার যাচাই করা হচ্ছে';
  let stageLabelEn: string = status;
  let descriptionBn =
    'আপনার অর্ডারটি গ্রহণ করা হয়েছে। কনফার্ম হওয়ার কিছুক্ষণের মধ্যেই ট্র্যাকিং আইডি যুক্ত হবে।';

  if (status === 'Pending Customer Confirmation' || status === 'Customer Confirmed' || status === 'Awaiting Staff Approval') {
    stageLabelBn = 'অর্ডার কনফার্মেশনের অপেক্ষায়';
    stageLabelEn = 'Pending Confirmation';
    descriptionBn =
      'আপনার অর্ডারটি সিস্টেমে জমা হয়েছে। কনফার্ম হওয়ার কিছুক্ষণের মধ্যেই আপনার ট্র্যাকিং আইডি ও পরবর্তী আপডেট এখানে দেখতে পাবেন।';
  } else if (status === 'Order Confirmed') {
    stageLabelBn = 'অর্ডার কনফার্ম হয়েছে';
    stageLabelEn = 'Order Confirmed';
    descriptionBn = trackingCode
      ? 'আপনার অর্ডার কনফার্ম হয়ে ট্র্যাকিং আইডি যুক্ত হয়েছে। ওয়্যারহাউসে প্যাকিং প্রস্তুতি চলছে।'
      : 'আপনার অর্ডারটি কনফার্ম করা হয়েছে। শীঘ্রই প্যাকিং ও কুরিয়ার ট্র্যাকিং আইডি যুক্ত হবে।';
  } else if (status === 'Processing') {
    stageLabelBn = 'ওয়্যারহাউসে প্রসেসিং চলছে';
    stageLabelEn = 'Processing at Warehouse';
    descriptionBn = 'আপনার অর্ডারকৃত পণ্যগুলোর কোয়ালিটি চেক ও প্রস্তুত করা হচ্ছে।';
  } else if (status === 'Packed') {
    stageLabelBn = 'প্যাকিং সম্পন্ন, ডিসপ্যাচের জন্য প্রস্তুত';
    stageLabelEn = 'Packed & Ready for Courier';
    descriptionBn = 'আপনার পার্সেলটি সুরক্ষিতভাবে প্যাক করা হয়েছে এবং কুরিয়ারে হ্যান্ডওভারের জন্য প্রস্তুত।';
  } else if (status === 'Shipped') {
    stageLabelBn = 'কুরিয়ারে হস্তান্তর করা হয়েছে';
    stageLabelEn = 'Handed Over to Courier';
    descriptionBn = trackingCode
      ? `আপনার পার্সেল ${order.courierName || 'কুরিয়ার'} এর মাধ্যমে পাঠানো হয়েছে (ট্র্যাকিং আইডি: ${trackingCode})।`
      : 'আপনার পার্সেলটি কুরিয়ার সার্ভিসে হস্তান্তর করা হয়েছে।';
  } else if (status === 'Out for Delivery') {
    stageLabelBn = 'ডেলিভারি ম্যান আপনার এলাকায় রওনা দিয়েছেন';
    stageLabelEn = 'Out for Delivery';
    descriptionBn = 'পার্সেলটি ডেলিভারির চূড়ান্ত ধাপে রয়েছে। ডেলিভারি ম্যান শীঘ্রই আপনার নম্বরে কল করবেন।';
  } else if (status === 'Delivered') {
    stageLabelBn = 'ডেলিভারি সফলভাবে সম্পন্ন হয়েছে';
    stageLabelEn = 'Delivered';
    descriptionBn = 'আপনার পার্সেলটি সফলভাবে ডেলিভারি করা হয়েছে। VANTREL OUTFIT-এর সাথে থাকার জন্য ধন্যবাদ!';
  } else if (status === 'Cancelled' || status === 'Cancellation Requested') {
    stageLabelBn = status === 'Cancelled' ? 'অর্ডার বাতিল করা হয়েছে' : 'বাতিলের অনুরোধ প্রক্রিয়াধীন';
    stageLabelEn = status;
    descriptionBn = order.cancellationReason
      ? `কারণ: ${order.cancellationReason}`
      : 'গ্রাহক বা অ্যাডমিনের অনুরোধে অর্ডারটি বাতিল করা হয়েছে।';
  } else if (status === 'Return Requested' || status === 'Returned') {
    stageLabelBn = status === 'Returned' ? 'পণ্য রিটার্ন সম্পন্ন' : 'রিটার্ন অনুরোধ প্রক্রিয়াধীন';
    stageLabelEn = status;
    descriptionBn = order.returnReason || 'পণ্য রিটার্ন সংক্রান্ত কার্যক্রম চলমান রয়েছে।';
  } else if (status === 'Failed Delivery') {
    stageLabelBn = 'ডেলিভারি চেষ্টা ব্যর্থ হয়েছে';
    stageLabelEn = 'Delivery Attempt Failed';
    descriptionBn = 'কুরিয়ার রাইডার যোগাযোগ করতে পারেননি; পুনরায় ডেলিভারির চেষ্টা করা হবে।';
  }

  const historyList = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const latestHistory = historyList.length > 0 ? historyList[historyList.length - 1] : undefined;
  const latestNote = String(order.currentLocationNote || latestHistory?.note || descriptionBn).trim();

  const milestones: EvaluatedMilestone[] = ORDER_PROGRESS_MILESTONES.map((m, idx) => {
    const matchedHistory = [...historyList]
      .reverse()
      .find((h) => m.statuses.includes(h.status));

    if (isCancelledOrException) {
      return {
        ...m,
        state: 'cancelled',
        timestamp: matchedHistory?.timestamp
      };
    }

    let state: EvaluatedMilestone['state'] = 'upcoming';
    if (activeStepIndex > idx || status === 'Delivered') {
      state = 'completed';
    } else if (activeStepIndex === idx) {
      state = 'current';
    }

    return {
      ...m,
      state,
      timestamp: matchedHistory?.timestamp
    };
  });

  return {
    percent,
    activeStepIndex,
    isCancelledOrException,
    isTerminal,
    isConfirmed,
    trackingCode,
    stageLabelBn,
    stageLabelEn,
    descriptionBn,
    latestNote,
    milestones
  };
}
