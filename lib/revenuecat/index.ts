import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// Set these in Expo config / environment once you have RevenueCat project IDs
const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

export const ENTITLEMENT_BASE = 'base';
export const ENTITLEMENT_AI = 'ai_coach';

let _configured = false;

/**
 * Call once on app startup (after auth) to configure the SDK.
 * Pass the Supabase user ID so RevenueCat can match purchases server-side.
 */
export async function configureRevenueCat(userId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) {
    // RevenueCat keys not set yet — silently skip (dev mode)
    return;
  }

  if (_configured) {
    // Update app user ID if already configured (e.g. after sign-in)
    await Purchases.logIn(userId);
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.SILENT);
  Purchases.configure({ apiKey, appUserID: userId });
  _configured = true;
}

/** Returns current customer info. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!_configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** True if the user has an active AI Coach subscription. */
export async function hasAIEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return ENTITLEMENT_AI in info.entitlements.active;
}

/** True if the user has the base (lifetime) purchase. */
export async function hasBaseEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return ENTITLEMENT_BASE in info.entitlements.active;
}

/** Fetches available offerings from RevenueCat. */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!_configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

/** Purchase a package. Returns updated customer info on success. */
export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0]): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: unknown) {
    // User cancelled — not an error
    if ((e as { userCancelled?: boolean }).userCancelled) return null;
    throw e;
  }
}

/** Restore previous purchases (required for App Store). */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!_configured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch {
    return null;
  }
}

/** Sign out of RevenueCat (call on user sign-out). */
export async function signOutRevenueCat(): Promise<void> {
  if (!_configured) return;
  try {
    await Purchases.logOut();
  } catch {}
}
