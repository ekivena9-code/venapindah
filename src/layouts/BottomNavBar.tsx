import React from "react";
import { LayoutGrid as MoreGridIcon, ChevronDown as ChevronDownIcon, Link as LinkIcon } from "lucide-react";
import { ViewType } from "../types";
import { customizeNavigationLabel, useUiTextOverrides } from "../utils/uiTextCustomization";
import {
  HomeIcon,
  UsersIcon,
  DollarSignIcon,
  CalendarIcon,
  BriefcaseIcon,
  PackageIcon,
  SettingsIcon,
  FileTextIcon,
  ChartPieIcon,
  StarIcon,
  LightbulbIcon,
  ImageIcon,
  UserCircleIcon,
  FileSpreadsheetIcon,
} from "../constants";

export { MoreGridIcon, ChevronDownIcon };

// ─── More Menu Bottom Sheet ─────────────────────────────────────────────────
export const MoreMenuSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  activeView: ViewType;
  handleNavigation: (view: ViewType) => void;
}> = ({ isOpen, onClose, activeView, handleNavigation }) => {
  const uiTextOverrides = useUiTextOverrides();
  const menuGroups = [
    {
      label: "Manajemen",
      items: [
        { view: ViewType["Calon Pengantin"], label: "Calon Pengantin", icon: StarIcon },
        { view: ViewType.BOOKING, label: "Booking", icon: CalendarIcon },
        { view: ViewType.TEAM, label: "Tim / Vendor", icon: BriefcaseIcon },
        { view: ViewType.CONTRACTS, label: "Kontrak", icon: FileTextIcon },
      ],
    },
    {
      label: "Produk & Layanan",
      items: [
        { view: ViewType.PACKAGES, label: "Package", icon: PackageIcon },
        { view: ViewType.CLIENT_REPORTS, label: "Laporan Pengantin", icon: ChartPieIcon },
        { view: ViewType.INVOICES, label: "Daftar Invoice", icon: FileTextIcon },
        { view: ViewType.CALENDAR, label: "Kalender", icon: CalendarIcon },
        { view: ViewType.PROMO_CODES, label: "Promo & Katalog", icon: LightbulbIcon },
        { view: ViewType.GALLERY, label: "Pricelist Publik", icon: ImageIcon },
      ],
    },
    {
      label: "Pengaturan",
      items: [
        { view: ViewType.VENDOR_PROFILE, label: "Profil Vendor", icon: UserCircleIcon },
        { view: ViewType.BIO_LINKS, label: "Link Publik", icon: LinkIcon },
        { view: ViewType.MIGRATION, label: "Import Data Excel", icon: FileSpreadsheetIcon },
        { view: ViewType.SETTINGS, label: "Pengaturan", icon: SettingsIcon },
      ],
    },
  ];

  const navigate = (view: ViewType) => {
    handleNavigation(view);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[45] xl:hidden transition-all duration-300 ${
          isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`
          more-menu-sheet fixed bottom-0 left-0 right-0 z-[46]
          xl:hidden
          bg-white
          rounded-t-3xl
          border-t border-[#EAEFF4]
          shadow-2xl
          transition-all duration-300 ease-out
          ${isOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"}
        `}
        style={{
          paddingBottom: "calc(1rem + var(--safe-area-inset-bottom, 0px))",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#EAEFF4] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#EAEFF4]">
          <h3 className="font-extrabold text-base text-[#2A3547]">Menu Lainnya</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4F6F9] hover:bg-[#ECF2FF] flex items-center justify-center text-[#5A6A85] hover:text-[#5D87FF] transition-colors"
            aria-label="Tutup"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Groups */}
        <div className="px-4 pt-3 space-y-4">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A6A85] px-1 mb-2">
                        {customizeNavigationLabel(group.label, uiTextOverrides)}
              </p>
              <div className="more-menu-grid grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const isActive = activeView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => navigate(item.view)}
                      className={`more-menu-item
                        flex flex-col items-center justify-center gap-1.5
                        p-3 rounded-xl
                        border transition-all duration-200
                        min-h-[72px]
                        ${isActive
                          ? "bg-[#5D87FF] text-white border-[#5D87FF] shadow-xs"
                          : "bg-[#F4F6F9] border-[#EAEFF4] text-[#5A6A85] hover:border-[#5D87FF]/30 hover:text-[#2A3547] hover:bg-[#ECF2FF] active:scale-95"
                        }
                      `}
                    >
                      <item.icon className={`more-menu-item-icon w-5 h-5 ${isActive ? "text-white" : "text-[#5D87FF]"}`} />
                      <span className={`more-menu-item-label text-[11px] font-semibold leading-tight text-center ${isActive ? "text-white" : ""}`}>
                        {customizeNavigationLabel(item.label, uiTextOverrides)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export interface BottomNavBarProps {
  activeView: ViewType;
  handleNavigation: (view: ViewType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeView,
  handleNavigation,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);

  const prefetchView = (view: ViewType) => {
    switch (view) {
      case ViewType.DASHBOARD:
        import("../pages/dashboard/DashboardPage");
        break;
      case ViewType["Calon Pengantin"]:
        import("../pages/leads/LeadsPage");
        break;
      case ViewType.BOOKING:
        import("../pages/booking/BookingPage");
        break;
      case ViewType.CLIENTS:
        import("../pages/clients/ClientsPage");
        break;
      case ViewType.TEAM:
        import("../pages/team/TeamPage");
        break;
      case ViewType.FINANCE:
        import("../pages/finance/FinancePage");
        break;
      case ViewType.CALENDAR:
        import("../features/projects/components/CalendarView");
        break;
      case ViewType.PACKAGES:
        import("../features/packages/Packages");
        break;
      case ViewType.PROMO_CODES:
        import("../features/promo/PromoCodes");
        break;
      case ViewType.GALLERY:
        import("../features/public/components/GalleryUpload");
        break;
      case ViewType.CLIENT_REPORTS:
        import("../features/clients/components/ClientKPI");
        break;
      case ViewType.SETTINGS:
        import("../pages/settings/SettingsPage");
        break;
      case ViewType.BIO_LINKS:
        import("../pages/admin/BioLinksPage");
        break;
      default:
        break;
    }
  };

  // Core 4 nav items (always visible)
  const navItems = [
    { view: ViewType.DASHBOARD, label: "Beranda", icon: HomeIcon },
    { view: ViewType.CLIENTS, label: "Pengantin", icon: UsersIcon },
    { view: ViewType.FINANCE, label: "Keuangan", icon: DollarSignIcon },
  ];

  // Detect if current active view is one of the "more" views
  const moreViews = [
    ViewType["Calon Pengantin"],
    ViewType.BOOKING,
    ViewType.TEAM,
    ViewType.CONTRACTS,
    ViewType.PACKAGES,
    ViewType.CLIENT_REPORTS,
    ViewType.CALENDAR,
    ViewType.SETTINGS,
    ViewType.BIO_LINKS,
  ];
  const isMoreActive = moreViews.includes(activeView);

  return (
    <>
      <MoreMenuSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        activeView={activeView}
        handleNavigation={handleNavigation}
      />

      <nav
        className="
          bottom-nav
          xl:hidden
          bg-white/95
          backdrop-blur-xl
          border-t border-[#EAEFF4]
          shadow-[0_-4px_20px_rgba(0,0,0,0.04)]
        "
      >
        <div
          className="flex justify-around items-center h-16 px-1"
          style={{ paddingBottom: "var(--safe-area-inset-bottom, 0px)" }}
        >
          {/* Core nav items */}
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleNavigation(item.view)}
              onMouseEnter={() => prefetchView(item.view)}
              className={`
                flex flex-col items-center justify-center
                w-full h-full
                px-1 py-1.5
                rounded-xl
                transition-all duration-200
                min-w-[52px] sm:min-w-[64px] min-h-[44px]
                relative group overflow-visible
                ${activeView === item.view
                  ? "text-[#5D87FF] bg-[#ECF2FF]"
                  : "text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] active:bg-[#ECF2FF]"
                }
              `}
              aria-label={customizeNavigationLabel(item.label, uiTextOverrides)}
            >
              <div className="relative mb-0.5">
                <item.icon className={`w-5 h-5 transition-all duration-200 ${activeView === item.view ? "scale-110 text-[#5D87FF]" : "group-active:scale-95"}`} />
                {activeView === item.view && (
                  <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#5D87FF] rounded-full" />
                )}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold leading-tight ${activeView === item.view ? "font-bold text-[#5D87FF]" : ""}`}>
                {customizeNavigationLabel(item.label, uiTextOverrides)}
              </span>
            </button>
          ))}

          {/* More button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`
              flex flex-col items-center justify-center
              w-full h-full
              px-1 py-1.5
              rounded-xl
              transition-all duration-200
              min-w-[52px] sm:min-w-[64px] min-h-[44px]
              relative group overflow-visible
              ${isMoreActive
                ? "text-[#5D87FF] bg-[#ECF2FF]"
                : "text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] active:bg-[#ECF2FF]"
              }
            `}
            aria-label="Menu lainnya"
            aria-expanded={isMoreOpen}
          >
            <div className="relative mb-0.5">
              <MoreGridIcon className={`w-5 h-5 transition-all duration-200 ${isMoreActive ? "scale-110 text-[#5D87FF]" : ""}`} />
              {isMoreActive && (
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#5D87FF] rounded-full" />
              )}
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold leading-tight ${isMoreActive ? "font-bold text-[#5D87FF]" : ""}`}>
              Lainnya
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNavBar;
