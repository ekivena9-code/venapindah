import React, { Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { ViewType } from "./types";
import { darkenColor, hexToHsl, lightenColor } from "./constants";
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import GlobalSearch from "./layouts/GlobalSearch";
import BottomNavBar from "./layouts/BottomNavBar";
import ErrorBoundary from "./shared/ui/ErrorBoundary";
import Login from "./pages/auth/LoginPage";

import { useSimplifiedData } from "./contexts/SimplifiedDataContext";
import { useAuth } from "./hooks/useAuth";
import { useAuxiliaryData } from "./hooks/useAuxiliaryData";
import { useAppRouting } from "./hooks/useAppRouting";
import { persistQueryCache } from "./lib/queryCachePersistence";

import PublicRoutes, { isPublicRoutePath } from "./routes/PublicRoutes";
import AuthenticatedRoutes from "./routes/AuthenticatedRoutes";

function App() {
  const queryClient = useQueryClient();
  // ─── Authentication & Session ───────────────────────────────────────────
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.currentUser?.id) return;
    return persistQueryCache(queryClient, auth.currentUser.id);
  }, [auth.isAuthenticated, auth.currentUser?.id, queryClient]);

  // ─── Global Shared Data Context ─────────────────────────────────────────
  const data = useSimplifiedData();

  // ─── Auxiliary Application Data & Notifications ─────────────────────────
  const auxData = useAuxiliaryData({
    appDataClientFeedback: data.clientFeedback || [],
    appDataLoadedClientFeedback: !data.loading.clientFeedback,
    setClientFeedback: data.setClientFeedback, // Use the setter from simplified context
  });

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const accentColor = auxData.profile.brandColor;
    const variables = [
      "--color-accent",
      "--color-accent-hover",
      "--color-accent-light",
      "--color-accent-dark",
      "--color-accent-hsl",
      "--public-accent",
      "--public-accent-hover",
      "--public-accent-hsl",
    ];

    if (!accentColor || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      variables.forEach(variable => rootStyle.removeProperty(variable));
      return;
    }

    const hoverColor = darkenColor(accentColor, 10);
    const lightColor = lightenColor(accentColor, 88);
    const darkColor = darkenColor(accentColor, 20);
    const accentHsl = hexToHsl(accentColor);

    rootStyle.setProperty("--color-accent", accentColor);
    rootStyle.setProperty("--color-accent-hover", hoverColor);
    rootStyle.setProperty("--color-accent-light", lightColor);
    rootStyle.setProperty("--color-accent-dark", darkColor);
    rootStyle.setProperty("--color-accent-hsl", accentHsl);
    rootStyle.setProperty("--public-accent", accentColor);
    rootStyle.setProperty("--public-accent-hover", hoverColor);
    rootStyle.setProperty("--public-accent-hsl", accentHsl);
  }, [auxData.profile.brandColor]);

  // ─── Application Routing & Navigation ───────────────────────────────────
  const routing = useAppRouting({
    isAuthenticated: auth.isAuthenticated,
    profile: auxData.profile,
    teamPaymentsLoaded: auxData.teamPaymentsLoaded,
    setTeamProjectPayments: auxData.setTeamProjectPayments,
    setTeamPaymentsLoaded: auxData.setTeamPaymentsLoaded,
    onMarkNotificationRead: auxData.handleMarkAsRead,
    appDataLoader: {
      loadTotals: data.refetchDashboardStats,
      loadClientFeedback: data.refetchClientFeedback,
    },
  });

  // ─── Public & External Route Dispatcher ─────────────────────────────────
  if (isPublicRoutePath(routing.route)) {
    return (
      <ErrorBoundary key={routing.route} resetKey={routing.route}>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-brand-bg text-brand-text-secondary">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin" />
                <span className="text-sm font-medium">Memuat Halaman...</span>
              </div>
            </div>
          }
        >
          <PublicRoutes
            route={routing.route}
            isAuthenticated={auth.isAuthenticated}
            users={auth.users}
            handleLoginSuccess={auth.handleLoginSuccess}
            profile={auxData.profile}
            showNotification={auxData.showNotification}
            addNotification={auxData.addNotification}
            clients={data.clients}
            projects={data.projects}
            teamMembers={data.teamMembers}
            transactions={data.transactions}
            cards={data.cards}
            leads={data.leads}
            pockets={data.pockets}
            promoCodes={auxData.promoCodes}
            packages={data.packages}
            addOns={data.addOns}
            clientFeedback={data.clientFeedback}
            notifications={auxData.notifications}
            teamProjectPayments={auxData.teamProjectPayments}
            teamPaymentRecords={auxData.teamPaymentRecords}
            setClients={data.setClients}
            setProjects={data.setProjects}
            setTransactions={data.setTransactions}
            setCards={data.setCards}
            setLeads={data.setLeads}
            setPockets={data.setPockets}
            setPromoCodes={auxData.setPromoCodes}
            setClientFeedback={data.setClientFeedback}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // ─── Fallback Authentication Gate ───────────────────────────────────────
  if (!auth.isAuthenticated) {
    return <Login onLoginSuccess={auth.handleLoginSuccess} users={auth.users} />;
  }

  // ─── Authenticated Application Shell ────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-brand-bg text-brand-text-primary">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={routing.activeView}
        setActiveView={(view) => routing.handleNavigation(view)}
        isOpen={routing.isSidebarOpen}
        setIsOpen={routing.setIsSidebarOpen}
        currentUser={auth.currentUser}
        profile={auxData.profile}
      />

      <div className="min-w-0 flex-1 flex flex-col xl:pl-64 overflow-hidden">
        {/* Top Header */}
        <Header
          pageTitle={routing.activeView}
          toggleSidebar={() => routing.setIsSidebarOpen(!routing.isSidebarOpen)}
          setIsSearchOpen={routing.setIsSearchOpen}
          notifications={auxData.notifications}
          handleNavigation={routing.handleNavigation}
          handleMarkAllAsRead={auxData.handleMarkAllAsRead}
          currentUser={auth.currentUser}
          profile={auxData.profile}
          handleLogout={auth.handleLogout}
        />

        {/* Main Content Area */}
        <main
          className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 xl:pb-8 overflow-y-auto"
          style={{
            paddingBottom: "calc(5rem + var(--safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="animate-fade-in">
            <ErrorBoundary
              key={routing.activeView}
              resetKey={routing.activeView}
              fallback={(error, resetError) => (
                <div className="flex items-center justify-center min-h-[360px] p-4 sm:p-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-[#EAEFF4] p-6 sm:p-8 max-w-md w-full text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#FDEDE8] border border-[#FA896B]/20 flex items-center justify-center text-[#FA896B]">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#2A3547] mb-1">
                      Kendala Memuat Halaman
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5A6A85] mb-6 leading-relaxed">
                      Terjadi kendala saat memuat konten ini. Halaman lain tetap dapat diakses normal langsung lewat menu navigasi tanpa reload.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                      <button
                        type="button"
                        onClick={resetError}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#5D87FF] hover:bg-[#4570EA] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Buka Ulang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetError?.();
                          routing.handleNavigation(ViewType.DASHBOARD);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#ECF2FF] hover:bg-[#DCE7FF] text-[#5D87FF] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Ke Dashboard</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            >
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center py-24">
                    <div className="relative flex justify-center items-center">
                      <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
                      <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
                    </div>
                  </div>
                }
              >
                <AuthenticatedRoutes
                  activeView={routing.activeView}
                  hasPermission={auth.hasPermission}
                  handleNavigation={routing.handleNavigation}
                  onBackToDashboard={() =>
                    React.startTransition(() => routing.handleNavigation(ViewType.DASHBOARD))
                  }
                  currentUser={auth.currentUser}
                  users={auth.users}
                  setUsers={auth.setUsers}
                  clients={data.clients || []}
                  projects={data.projects || []}
                  teamMembers={data.teamMembers || []}
                  transactions={data.transactions || []}
                  leads={data.leads || []}
                  cards={data.cards || []}
                  pockets={data.pockets || []}
                  packages={data.packages || []}
                  addOns={data.addOns || []}
                  clientFeedback={data.clientFeedback || []}
                  setClients={data.setClients}
                  setProjects={data.setProjects}
                  setTeamMembers={data.setTeamMembers}
                  setTransactions={data.setTransactions}
                  setLeads={data.setLeads}
                  setCards={data.setCards}
                  setPockets={data.setPockets}
                  setPackages={data.setPackages}
                  setAddOns={data.setAddOns}
                  setClientFeedback={data.setClientFeedback}
                  totals={data.totals || {
                    projects: 0,
                    activeProjects: 0,
                    clients: 0,
                    activeClients: 0,
                    leads: 0,
                    discussionLeads: 0,
                    followUpLeads: 0,
                    teamMembers: 0,
                    transactions: 0,
                    revenue: 0,
                    expense: 0,
                  }}
                  appData={{
                    totals: data.totals || {
                      projects: 0,
                      activeProjects: 0,
                      clients: 0,
                      activeClients: 0,
                      leads: 0,
                      discussionLeads: 0,
                      followUpLeads: 0,
                      teamMembers: 0,
                      transactions: 0,
                      revenue: 0,
                      expense: 0,
                    },
                    loading: {
                      clients: data.loading.clients,
                      projects: data.loading.projects,
                      teamMembers: data.loading.teamMembers,
                      transactions: data.loading.transactions,
                    },
                    loaded: {
                      clients: !data.loading.clients,
                      projects: !data.loading.projects,
                      teamMembers: !data.loading.teamMembers,
                      transactions: !data.loading.transactions,
                    },
                    loadTotals: data.refetchDashboardStats,
                    loadClientFeedback: data.refetchClientFeedback,
                    loadClients: data.refetchClients,
                    loadProjects: data.refetchProjects,
                    loadTeamMembers: data.refetchTeamMembers,
                    loadTransactions: data.refetchTransactions,
                  }}
                  profile={auxData.profile}
                  setProfile={auxData.setProfile}
                  handleSetProfile={auxData.handleSetProfile}
                  notifications={auxData.notifications}
                  promoCodes={auxData.promoCodes}
                  setPromoCodes={auxData.setPromoCodes}
                  contracts={auxData.contracts}
                  setContracts={auxData.setContracts}
                  teamProjectPayments={auxData.teamProjectPayments}
                  setTeamProjectPayments={auxData.setTeamProjectPayments}
                  teamPaymentRecords={auxData.teamPaymentRecords}
                  setTeamPaymentRecords={auxData.setTeamPaymentRecords}
                  initialAction={routing.initialAction}
                  setInitialAction={routing.setInitialAction}
                  showNotification={auxData.showNotification}
                  addNotification={auxData.addNotification}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Global Notification Toast */}
      {auxData.notification && (
        <div
          className="
              fixed top-4 right-4 
              sm:top-6 sm:right-6
              bg-brand-accent 
              text-white 
              py-3 px-4 sm:py-4 sm:px-6
              rounded-xl 
              shadow-2xl 
              z-50 
              animate-fade-in-out
              backdrop-blur-sm
              border border-brand-accent-hover/20
              max-w-sm
              break-words
          "
          style={{
            top: "calc(1rem + var(--safe-area-inset-top, 0px))",
            right: "calc(1rem + var(--safe-area-inset-right, 0px))",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse-soft" />
            <span className="font-medium text-sm sm:text-base">
              {auxData.notification}
            </span>
          </div>
        </div>
      )}

      {/* Global Search Dialog */}
      <GlobalSearch
        isOpen={routing.isSearchOpen}
        onClose={() => routing.setIsSearchOpen(false)}
        clients={data.clients}
        projects={data.projects}
        teamMembers={data.teamMembers}
        handleNavigation={routing.handleNavigation}
      />

      {/* Mobile Bottom Navigation */}
      <BottomNavBar
        activeView={routing.activeView}
        handleNavigation={routing.handleNavigation}
      />
    </div>
  );
}

export default App;
