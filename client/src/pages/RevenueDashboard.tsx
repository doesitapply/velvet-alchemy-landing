import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, DollarSign, TrendingUp, CheckCircle, Clock, XCircle } from "lucide-react";
import { getLoginUrl } from "@/const";
import AppHeader from "@/components/AppHeader";
import { Link } from "wouter";

export default function RevenueDashboard() {
  const { user, loading: authLoading } = useAuth();

  const { data: payments, isLoading } = trpc.payment.getAllPayments.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-serif italic">Authentication Required</h2>
          <Button asChild className="w-full">
            <a href={getLoginUrl()}>Login</a>
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-8">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  // Calculate revenue metrics
  const totalRevenue = payments?.reduce((sum: number, p: any) => {
    if (p.status === 'completed') {
      return sum + (p.amount / 100); // Convert cents to dollars
    }
    return sum;
  }, 0) || 0;

  const completedPayments = payments?.filter((p: any) => p.status === 'completed').length || 0;
  const pendingPayments = payments?.filter((p: any) => p.status === 'pending').length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'expired':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif italic mb-2">Revenue Dashboard</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Track your closed deals and total income
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-gold to-yellow-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-black" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-mono">TOTAL REVENUE</p>
                  <p className="text-3xl font-serif italic">${totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-mono">COMPLETED</p>
                  <p className="text-3xl font-serif italic">{completedPayments}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-mono">PENDING</p>
                  <p className="text-3xl font-serif italic">{pendingPayments}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Payments Table */}
          <Card className="p-6">
            <h2 className="text-xl font-serif italic mb-6">Payment History</h2>
            
            {!payments || payments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-mono text-sm">No payments yet</p>
                <p className="text-muted-foreground text-xs mt-2">
                  Start sending invoices to generate revenue
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">COMPANY</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">PACKAGE</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">AMOUNT</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">STATUS</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">DATE</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-muted-foreground">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment: any) => (
                      <tr key={payment.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium">{payment.companyName}</p>
                            <p className="text-xs text-muted-foreground">{payment.websiteUrl}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs px-2 py-1 rounded-sm font-mono bg-muted uppercase">
                            {payment.package_type}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-serif text-lg">
                            ${(payment.amount / 100).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(payment.status)}
                            <span className={`text-xs px-2 py-1 rounded-sm font-mono uppercase ${getStatusColor(payment.status)}`}>
                              {payment.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-muted-foreground">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Link href={`/leads/${payment.lead_id}`}>
                              View Lead
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Quick Stats */}
          {payments && payments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-sm font-mono text-muted-foreground mb-4">AVERAGE DEAL SIZE</h3>
                <p className="text-3xl font-serif italic">
                  ${completedPayments > 0 ? (totalRevenue / completedPayments).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-mono text-muted-foreground mb-4">CONVERSION RATE</h3>
                <p className="text-3xl font-serif italic">
                  {payments.length > 0 ? ((completedPayments / payments.length) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {completedPayments} completed out of {payments.length} invoices sent
                </p>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
