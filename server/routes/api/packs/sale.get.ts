import { defineHandler } from "nitro";
import { getSystemSettings } from "../../../utils/system-settings";

export default defineHandler(async () => {
  const settings = await getSystemSettings();

  return {
    active: settings.packSaleActive,
    discountPercent: settings.packSaleDiscountPercent,
    bannerText: settings.packSaleBannerText,
    endsAt: settings.packSaleEndsAt,
  };
});