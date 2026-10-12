import { NextRequest } from "next/server";
import { getStoreSettings, saveStoreSettings } from "@/lib/store-settings";
import { settingsUpdateSchema } from "@/lib/validators";
import { audit } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("settings");
    const settings = await getStoreSettings();
    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const staff = await requireStaff("settings");
    const input = settingsUpdateSchema.parse(await req.json());
    const settings = await saveStoreSettings(input);
    await audit(staff, "SETTINGS_UPDATE", "StoreSetting", "global", {
      keys: Object.keys(input),
    });
    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}
