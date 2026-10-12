import { destroySession } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";

export async function POST() {
  try {
    await destroySession();
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
