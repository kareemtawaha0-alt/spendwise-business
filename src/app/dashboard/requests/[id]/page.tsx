
import { Suspense } from "react";
import ExpenseRequestDetailsClient from "./expense-request-details-client";

export default function ExpenseRequestDetailsPage() {
  return (
    <Suspense fallback={<div>Loading request details...</div>}>
      <ExpenseRequestDetailsClient />
    </Suspense>
  );
}
