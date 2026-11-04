import { Address, User } from '../types';

const STORAGE_KEY = 'vantrel_saved_addresses';

export const getSavedAddresses = (currentUser?: User | null): Address[] => {
  const addresses: Address[] = [];

  // 1. Load from logged-in user if available
  if (currentUser?.savedAddresses && currentUser.savedAddresses.length > 0) {
    addresses.push(...currentUser.savedAddresses);
  }

  // 2. Load from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: Address[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          // Avoid duplicate by matching phone and streetAddress
          const isDuplicate = addresses.some(
            (existing) =>
              existing.phone.trim() === item.phone.trim() &&
              existing.streetAddress.trim().toLowerCase() === item.streetAddress.trim().toLowerCase() &&
              existing.district.trim().toLowerCase() === item.district.trim().toLowerCase()
          );
          if (!isDuplicate) {
            addresses.push(item);
          }
        });
      }
    }
  } catch {
    // ignore parse errors
  }

  return addresses;
};

export const saveAddressLocally = (address: Address): Address[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: Address[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }

    // Check if already in list
    const filtered = list.filter(
      (item) =>
        !(
          item.phone.trim() === address.phone.trim() &&
          item.streetAddress.trim().toLowerCase() === address.streetAddress.trim().toLowerCase() &&
          item.district.trim().toLowerCase() === address.district.trim().toLowerCase()
        )
    );

    const updated = [address, ...filtered].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [address];
  }
};

export const removeAddressLocally = (address: Address): Address[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: Address[] = JSON.parse(raw);
    const updated = list.filter(
      (item) =>
        !(
          item.phone.trim() === address.phone.trim() &&
          item.streetAddress.trim().toLowerCase() === address.streetAddress.trim().toLowerCase()
        )
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};
