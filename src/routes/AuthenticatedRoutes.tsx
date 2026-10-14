import React, { Suspense } from "react";
import { lazyWithRetry as lazy } from "./lazyWithRetry";
import {
  ViewType,
  Client,
  Project,
  TeamMember,
  Transaction,
  Package,
  AddOn,
  TeamProjectPayment,
  Profile,
  FinancialPocket,
  TeamPaymentRecord,
  Lead,
  User,
  Card,
  ClientFeedback,
  NavigationAction,
  Notification,
  PromoCode,
  Contract,
  PaymentStatus,
  TransactionType,
} from "../types";
import AccessDenied from "../shared/ui/AccessDenied";
import { DataLoadingWrapper, LoadingState } from "../shared/ui/LoadingState";
import { DataPengantinHub } from "../pages/pengantin/DataPengantinHub";
import { updateProject as updateProjectInDb } from "../services/projects";
import {
  createTransaction,
  updateCardBalance,
  updateTransaction as updateTransactionInDb,
} from "../services/transactions";

// Lazy-load route components to enable real code-splitting
const Dashboard = lazy(() => import("../pages/dashboard/DashboardPage"));
const Leads = lazy(() =>
  import("../pages/leads/LeadsPage").then((m) => ({ default: m.Leads })),
);
const Booking = lazy(() => import("../pages/booking/BookingPage"));
const Clients = lazy(() => import("../pages/clients/ClientsPage"));
const Freelancers = lazy(() =>
  import("../pages/team/TeamPage").then((m) => ({ default: m.Freelancers })),
);
const Finance = lazy(() => import("../pages/finance/FinancePage"));
const Packages = lazy(() => import("../features/packages/Packages"));
const Settings = lazy(() => import("../pages/settings/SettingsPage"));
const CalendarView = lazy(() =>
  import("../features/projects/components/CalendarView").then((m) => ({
    default: m.CalendarView,
  })),
);
const VendorProfileAdmin = lazy(() => import("../pages/admin/VendorProfilePage"));
const BioLinksAdmin = lazy(() => import("../pages/admin/BioLinksPage"));
const ClientReports = lazy(() => import("../features/clients/components/ClientKPI"));
const PromoCodes = lazy(() => import("../features/promo/PromoCodes"));
const Contracts = lazy(() =>
  import("../pages/contracts/ContractsPage").then((m) => ({ default: m.default })),
);
const GalleryUpload = lazy(() => import("../features/public/components/GalleryUpload"));
const InvoicePage = lazy(() => import("../pages/finance/InvoicePage"));
const ExcelMigrationPage = lazy(() =>
  import("../pages/migration/ExcelMigrationPage").then((m) => ({ default: m.ExcelMigrationPage }))
);

export interface AuthenticatedRoutesProps {
  activeView: ViewType;
  hasPermission: (view: ViewType) => boolean;
  handleNavigation: (
    view: ViewType,
    action?: NavigationAction,
    notificationId?: string,
  ) => void;
  onBackToDashboard: () => void;
  // Auth
  currentUser: User | null;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  // Global Data
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  teamMembers: TeamMember[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  pockets: FinancialPocket[];
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
  packages: Package[];
  setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
  addOns: AddOn[];
  setAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
  clientFeedback: ClientFeedback[];
  setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
  totals: any;
  appData: any;
  // Auxiliary Data
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  handleSetProfile: (value: React.SetStateAction<Profile>) => void;
  notifications: Notification[];
  promoCodes: PromoCode[];
  setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  teamPaymentRecords: TeamPaymentRecord[];
  setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
  // UI & Actions
  initialAction: NavigationAction | null;
  setInitialAction: React.Dispatch<React.SetStateAction<NavigationAction | null>>;
  showNotification: (message: string, duration?: number) => void;
  addNotification: (
    newNotificationData: Omit<Notification, "id" | "timestamp" | "isRead">,
  ) => Promise<void>;
}

export const AuthenticatedRoutes: React.FC<AuthenticatedRoutesProps> = ({
  activeView,
  hasPermission,
  handleNavigation,
  onBackToDashboard,
  currentUser,
  users,
  setUsers,
  clients,
  setClients,
  projects,
  setProjects,
  teamMembers,
  setTeamMembers,
  transactions,
  setTransactions,
  leads,
  setLeads,
  cards,
  setCards,
  pockets,
  setPockets,
  packages,
  setPackages,
  addOns,
  setAddOns,
  clientFeedback,
  setClientFeedback,
  totals,
  appData,
  profile,
  setProfile,
  handleSetProfile,
  promoCodes,
  setPromoCodes,
  contracts,
  setContracts,
  teamProjectPayments,
  setTeamProjectPayments,
  teamPaymentRecords,
  setTeamPaymentRecords,
  initialAction,
  setInitialAction,
  showNotification,
  addNotification,
}) => {
  if (!hasPermission(activeView)) {
    return <AccessDenied onBackToDashboard={onBackToDashboard} />;
  }

  switch (activeView) {
    case ViewType.DASHBOARD:
      return (
        <Dashboard
          projects={projects}
          clients={clients}
          transactions={transactions}
          teamMembers={teamMembers}
          cards={cards}
          pockets={pockets}
          handleNavigation={handleNavigation}
          leads={leads}
          teamProjectPayments={teamProjectPayments}
          packages={packages}
          clientFeedback={clientFeedback}
          currentUser={currentUser}
          projectStatusConfig={profile?.projectStatusConfig ?? []}
          profile={profile}
          totals={totals ?? {
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
        />
      );

    case ViewType["Calon Pengantin"]:
      return (
        <Leads
          leads={leads}
          setLeads={setLeads}
          clients={clients}
          setClients={setClients}
          projects={projects}
          setProjects={setProjects}
          packages={packages}
          addOns={addOns}
          transactions={transactions}
          setTransactions={setTransactions}
          userProfile={profile}
          setProfile={handleSetProfile}
          showNotification={showNotification}
          cards={cards}
          setCards={setCards}
          pockets={pockets}
          setPockets={setPockets}
          promoCodes={promoCodes}
          setPromoCodes={setPromoCodes}
          handleNavigation={handleNavigation}
          totals={totals ?? {
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
        />
      );

    case ViewType.BOOKING:
      return (
        <Suspense fallback={<LoadingState />}>
          <Booking
            leads={leads}
            clients={clients}
            projects={projects}
            setProjects={setProjects}
            packages={packages}
            userProfile={profile}
            setProfile={setProfile}
            handleNavigation={handleNavigation}
            showNotification={showNotification}
          />
        </Suspense>
      );

    case ViewType.CLIENTS:
      return (
        <DataLoadingWrapper
          loading={appData?.loading?.clients}
          loaded={appData?.loaded?.clients ?? true}
          loadingMessage="Memuat data pengantin..."
          onRetry={appData?.loadClients}
        >
          <DataPengantinHub
            activeView={activeView}
            handleNavigation={handleNavigation}
            clients={clients}
            setClients={setClients}
            projects={projects}
            setProjects={setProjects}
            teamProjectPayments={teamProjectPayments}
            setTeamProjectPayments={setTeamProjectPayments}
            leads={leads}
            teamMembers={teamMembers}
            transactions={transactions}
            setTransactions={setTransactions}
            packages={packages}
            setPackages={setPackages}
            addOns={addOns}
            setAddOns={setAddOns}
            clientFeedback={clientFeedback}
            setClientFeedback={setClientFeedback}
            profile={profile}
            showNotification={showNotification}
            addNotification={addNotification}
            cards={cards}
            setCards={setCards}
            pockets={pockets}
            setPockets={setPockets}
            promoCodes={promoCodes}
            setPromoCodes={setPromoCodes}
            contracts={contracts}
            setContracts={setContracts}
            appData={appData}
            initialAction={initialAction}
            setInitialAction={setInitialAction}
            onSignInvoice={async (pId, sig) => {
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === pId ? { ...p, invoiceSignature: sig } : p,
                ),
              );
              try {
                await updateProjectInDb(pId, {
                  invoiceSignature: sig,
                } as any);
              } catch (e) {
                console.warn("[App] Failed to persist invoice signature:", e);
              }
            }}
            onSignTransaction={async (tId, sig) => {
              setTransactions((prev) =>
                prev.map((t) =>
                  t.id === tId ? { ...t, vendorSignature: sig } : t,
                ),
              );
              try {
                await updateTransactionInDb(tId, {
                  vendorSignature: sig,
                } as any);
              } catch (e) {
                console.warn(
                  "[App] Failed to persist transaction signature:",
                  e,
                );
              }
            }}
            onRecordPayment={async (
              projectId: string,
              amount: number,
              destinationCardId: string,
            ) => {
              try {
                const today = new Date().toISOString().split("T")[0];
                const proj = projects.find((p) => p.id === projectId);
                if (!proj) return;
                const tx = await createTransaction({
                  date: today,
                  description: `Pembayaran Acara Pernikahan ${proj.projectName}`,
                  amount,
                  type: TransactionType.INCOME,
                  projectId,
                  category: "Pelunasan Acara Pernikahan",
                  method: "Transfer Bank",
                  cardId: destinationCardId,
                } as any);
                if (destinationCardId) {
                  try {
                    await updateCardBalance(destinationCardId, amount);
                  } catch (error) {
                    console.error(
                      "[Payment] Failed to update card balance:",
                      error,
                    );
                  }
                  setCards((prev) =>
                    prev.map((c) =>
                      c.id === destinationCardId
                        ? { ...c, balance: (c.balance || 0) + amount }
                        : c,
                    ),
                  );
                }
                const newAmountPaid = (proj.amountPaid || 0) + amount;
                let newPaymentStatus = PaymentStatus.BELUM_BAYAR as any;
                if (newAmountPaid >= proj.totalCost)
                  newPaymentStatus = PaymentStatus.LUNAS;
                else if (newAmountPaid > 0)
                  newPaymentStatus = PaymentStatus.DP_TERBAYAR;
                setProjects((prev) =>
                  prev.map((p) =>
                    p.id === projectId
                      ? {
                          ...p,
                          amountPaid: newAmountPaid,
                          paymentStatus: newPaymentStatus,
                        }
                      : p,
                  ),
                );
                try {
                  await updateProjectInDb(projectId, {
                    amountPaid: newAmountPaid,
                    paymentStatus: newPaymentStatus,
                  } as any);
                } catch (error) {
                  console.error(
                    "[Payment] Failed to update project in database:",
                    error,
                  );
                }
                setTransactions((prev) => {
                  const exists = prev.some(t => t.id === tx.id);
                  const list = exists ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev];
                  return list.sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );
                });
                showNotification("Pembayaran berhasil dicatat.");
              } catch (e) {
                console.warn("[Clients] Failed to record payment:", e);
                showNotification("Gagal mencatat pembayaran. Coba lagi.");
              }
            }}
          />
        </DataLoadingWrapper>
      );

    case ViewType.TEAM:
      return (
        <DataLoadingWrapper
          loading={appData?.loading?.teamMembers}
          loaded={appData?.loaded?.teamMembers ?? true}
          loadingMessage="Memuat data tim..."
          onRetry={appData?.loadTeamMembers}
        >
          <Freelancers
            teamMembers={teamMembers}
            setTeamMembers={setTeamMembers}
            teamProjectPayments={teamProjectPayments}
            setTeamProjectPayments={setTeamProjectPayments}
            teamPaymentRecords={teamPaymentRecords}
            setTeamPaymentRecords={setTeamPaymentRecords}
            transactions={transactions}
            setTransactions={setTransactions}
            userProfile={profile}
            showNotification={showNotification}
            initialAction={initialAction}
            setInitialAction={setInitialAction}
            projects={projects}
            setProjects={setProjects}
            pockets={pockets}
            setPockets={setPockets}
            cards={cards}
            setCards={setCards}
            onSignPaymentRecord={(rId, sig) =>
              setTeamPaymentRecords((prev) =>
                prev.map((r) =>
                  r.id === rId ? { ...r, vendorSignature: sig } : r,
                ),
              )
            }
            totals={totals ?? {
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
          />
        </DataLoadingWrapper>
      );

    case ViewType.FINANCE:
      return (
        <DataLoadingWrapper
          loading={appData?.loading?.transactions}
          loaded={appData?.loaded?.transactions ?? true}
          loadingMessage="Memuat data transaksi..."
          onRetry={appData?.loadTransactions}
        >
          <Finance
            transactions={transactions}
            setTransactions={setTransactions}
            pockets={pockets}
            setPockets={setPockets}
            projects={projects}
            setProjects={setProjects}
            profile={profile}
            cards={cards}
            setCards={setCards}
            teamMembers={teamMembers}
          />
        </DataLoadingWrapper>
      );

    case ViewType.PACKAGES:
      return (
        <Suspense fallback={<LoadingState />}>
          <Packages
            packages={packages}
            setPackages={setPackages}
            addOns={addOns}
            setAddOns={setAddOns}
            projects={projects}
            profile={profile}
            setProfile={handleSetProfile}
            showNotification={showNotification}
            initialAction={initialAction}
            setInitialAction={setInitialAction}
          />
        </Suspense>
      );

    case ViewType.SETTINGS:
      return (
        <Settings
          profile={profile}
          setProfile={handleSetProfile}
          transactions={transactions}
          projects={projects}
          packages={packages}
          setPackages={setPackages}
          users={users}
          setUsers={setUsers}
          currentUser={currentUser}
        />
      );

    case ViewType.VENDOR_PROFILE:
      return <VendorProfileAdmin />;

    case ViewType.BIO_LINKS:
      return <BioLinksAdmin />;

    case ViewType.CALENDAR:
      return (
        <CalendarView
          projects={projects}
          setProjects={setProjects}
          teamMembers={teamMembers}
          profile={profile}
          clients={clients}
          handleNavigation={handleNavigation}
          currentUser={currentUser}
        />
      );

    case ViewType.CLIENT_REPORTS:
      return (
        <ClientReports
          clients={clients}
          leads={leads}
          projects={projects}
          feedback={clientFeedback}
          setFeedback={setClientFeedback}
          showNotification={showNotification}
          handleNavigation={handleNavigation}
          teamMembers={teamMembers}
          packages={packages}
          teamProjectPayments={teamProjectPayments}
          teamPaymentRecords={teamPaymentRecords}
          transactions={transactions}
        />
      );

    case ViewType.PROMO_CODES:
      return (
        <PromoCodes
          promoCodes={promoCodes}
          setPromoCodes={setPromoCodes}
          projects={projects}
          showNotification={showNotification}
        />
      );

    case ViewType.GALLERY:
      return (
        <GalleryUpload
          userProfile={profile}
          showNotification={showNotification}
        />
      );

    case ViewType.CONTRACTS:
      return (
        <Contracts
          contracts={contracts}
          setContracts={setContracts}
          clients={clients}
          projects={projects}
          profile={profile}
          showNotification={showNotification}
          initialAction={initialAction}
          setInitialAction={setInitialAction}
          packages={packages}
          onSignContract={(contractId, signatureDataUrl, signer) => {
            setContracts((prev) =>
              prev.map((c) =>
                c.id === contractId
                  ? {
                      ...c,
                      [signer === "vendor" ? "vendorSignature" : "clientSignature"]: signatureDataUrl,
                    }
                  : c,
              ),
            );
          }}
        />
      );

    case ViewType.INVOICES:
      return (
        <Suspense fallback={<LoadingState />}>
          <InvoicePage
            clients={clients}
            setClients={setClients}
            projects={projects}
            setProjects={setProjects}
            transactions={transactions}
            setTransactions={setTransactions}
            packages={packages}
            teamPaymentRecords={teamPaymentRecords}
            setTeamPaymentRecords={setTeamPaymentRecords}
            teamMembers={teamMembers}
            teamProjectPayments={teamProjectPayments}
            userProfile={profile}
            showNotification={showNotification}
            handleNavigation={handleNavigation}
          />
        </Suspense>
      );

    case ViewType.MIGRATION:
      return (
        <Suspense fallback={<LoadingState />}>
          <ExcelMigrationPage
            clients={clients}
            teamMembers={teamMembers}
            setClients={setClients}
            setTransactions={setTransactions}
            setTeamMembers={setTeamMembers}
            showNotification={(msg, type) => showNotification(msg)}
          />
        </Suspense>
      );

    default:
      return <div />;
  }
};

export default AuthenticatedRoutes;
