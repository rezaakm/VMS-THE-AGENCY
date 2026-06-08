import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGate } from "@/components/layout/AuthGate";
import { useEffect } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Enquiries from "@/pages/enquiries";
import EnquiryDetail from "@/pages/enquiry-detail";
import CostSheets from "@/pages/cost-sheets";
import CostSheetDetail from "@/pages/cost-sheet-detail";
import Quotations from "@/pages/quotations";
import QuotationDetail from "@/pages/quotation-detail";
import Vendors from "@/pages/vendors";
import Calculator from "@/pages/calculator";
import Assistant from "@/pages/assistant";
import ImportData from "@/pages/import";
import Contracts from "@/pages/contracts";
import PurchaseOrders from "@/pages/purchase-orders";
import Invoices from "@/pages/invoices";
import Evaluations from "@/pages/evaluations";
import Rfqs from "@/pages/rfqs";
import Reports from "@/pages/reports";
import QuoteWizard from "@/pages/quote-wizard";
import FinanceOverview from "@/pages/finance/overview";
import FinancePnl from "@/pages/finance/pnl";
import FinanceReceivables from "@/pages/finance/receivables";
import FinancePayables from "@/pages/finance/payables";
import FinanceBank from "@/pages/finance/bank";
import FinancePayroll from "@/pages/finance/payroll";
import FinanceCashOutlook from "@/pages/finance/cash-outlook";
import FinancePending from "@/pages/finance/pending";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Layout>
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
        <Route component={NotFound} />
      </Switch>
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
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate>
              <Router />
            </AuthGate>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
