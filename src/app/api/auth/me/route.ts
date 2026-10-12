import { getCurrentUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
