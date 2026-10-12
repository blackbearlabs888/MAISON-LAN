import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { quoteShippingRates } from "@/lib/orders";
import { z } from "zod";

const schema = z.object({
  province: z.string().min(2).max(80),
  subtotalCents: z.number().int().min(0),
});

// Public shipping quotes — reads DB rates; never trusts client prices.
export async function POST(req: NextRequest) {
  try {
    const { province, subtotalCents } = schema.parse(await req.json());
    const quotes = await quoteShippingRates(province, subtotalCents);
    if (quotes.length === 0) {
      return fail(
        "No shipping methods are configured for your region yet. Please contact customer care.",
        200
      );
    }
    return ok({ quotes });
  } catch (err) {
    return handleError(err);
  }
}
