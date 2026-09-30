import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// This route used to delete every BROADCASTED approval so a header could show
// a made-up remainder. A broadcast record is the evidence; it is not adjusted
// from the browser, and a shielded balance is a viewing-key reading.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Balances are not adjusted here. A shielded balance is a viewing-key reading, and broadcast records are left as stored.",
    },
    { status: 410 }
  );
}
