import React, { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGate } from "@/components/layout/AuthGate";
import { setBaseUrl } from "@workspace/api-client-react";
import { EntityScopeProvider } from "@/hooks/use-entity-scope";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";

const Enquiries = lazy(() => import("@/pages/enquiries"));
const EnquiryDetail = lazy(() => import("@/pages/enquiry-detail"));
const CostSheets = lazy(() => import("@/pages/cost-sheets"));
const CostSheetDetail = lazy(() => import("@/pages/cost-sheet-detail"));
const Quotations = lazy(() => import("@/pages/quotations"));
const QuotationDetail = lazy(() => import("@/pages/quotation-detail"));
const Vendors = lazy(() => import("@/pages/vendors"));
const Calculator = lazy(() => import("@/pages/calculator"));
const Assistant = lazy(() => import("@/pages/assistant"));
const ImportData = lazy(() => import("@/pages/import"));
const Contracts = lazy(() => import("@/pages/contracts"));
const PurchaseOrders = lazy(() => import("@/pages/purchase-orders"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Evaluations = lazy(() => import("@/pages/evaluations"));
const Rfqs = lazy(() => import("@/pages/rfqs"));
const Reports = lazy(() => import("@/pages/reports"));
const QuoteWizard = lazy(() => import("@/pages/quote-wizard"));
const FinanceOverview = lazy(() => import("@/pages/finance/overview"));
const FinancePnl = lazy(() => import("@/pages/finance/pnl"));
const FinanceReceivables = lazy(() => import("@/pages/finance/receivables"));
const FinancePayables = lazy(() => import("@/pages/finance/payables"));
const FinanceBank = lazy(() => import("@/pages/finance/bank"));
const FinancePayroll = lazy(() => import("@/pages/finance/payroll"));
const FinanceCashOutlook = lazy(() => import("@/pages/finance/cash-outlook"));
const FinancePending = lazy(() => import("@/pages/finance/pending"));
const Clients = lazy(() => import("@/pages/clients"));
const FitnessBay = lazy(() => import("@/pages/fitness-bay"));
const Pipeline = lazy(() => import("@/pages/pipeline-refactored"));
const SystemHealth = lazy(() => import("@/pages/system-health"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function PageSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageSpinner />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/enquiries" component={Enquiries} />
        <Route path="/enquiries/:id" component={EnquiryDetail} />
        <Route path="/cost-sheets" component={CostSheets} />
        <Route path="/cost-sheets/:id" component={CostSheetDetail} />
        <Route path="/quotations" component={Quotations} />
        <Route path="/quotations/:id" component={QuotationDetail} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/contracts" component={Contracts} />
        <Route path="/purchase-orders" component={PurchaseOrders} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/rfqs" component={Rfqs} />
        <Route path="/evaluations" component={Evaluations} />
        <Route path="/reports" component={Reports} />
        <Route path="/quote-wizard" component={QuoteWizard} />
        <Route path="/calculator" component={Calculator} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/import" component={ImportData} />
        <Route path="/finance" component={FinanceOverview} />
        <Route path="/finance/pnl" component={FinancePnl} />
        <Route path="/finance/receivables" component={FinanceReceivables} />
        <Route path="/finance/payables" component={FinancePayables} />
        <Route path="/finance/bank" component={FinanceBank} />
        <Route path="/finance/payroll" component={FinancePayroll} />
        <Route path="/finance/cash-outlook" component={FinanceCashOutlook} />
        <Route path="/finance/pending" component={FinancePending} />
        <Route path="/clients" component={Clients} />
        <Route path="/fitness-bay" component={FitnessBay} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/system-health" component={SystemHealth} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");

    // Set API base for the generated client (works for local + deployed)
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    setBaseUrl(apiBase);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EntityScopeProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthGate>
                <Router />
              </AuthGate>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </EntityScopeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
