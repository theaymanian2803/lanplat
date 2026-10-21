import { Link, useLocation } from "react-router-dom";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen,
  Globe,
  GraduationCap,
  Home,
  Languages,
  Library,
  LogOut,
  Menu,
  Settings2,
  Zap,
} from "lucide-react";

interface NavbarProps {
  onOpenSettings: () => void;
  onSignOut: () => void;
  lessonsOpen: boolean;
  onToggleLessons: () => void;
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  tour: string;
  exact?: boolean;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Today",
    items: [{ to: "/dashboard", label: "Carrel", icon: Home, tour: "nav-dashboard" }],
  },
  {
    label: "Study",
    items: [
      { to: "/dashboard#library", label: "Video & text", icon: BookOpen, tour: "nav-library", exact: false },
      { to: "/books", label: "Books", icon: Library, tour: "nav-books" },
    ],
  },
  {
    label: "Capture",
    items: [{ to: "/translate", label: "Translate", icon: Globe, tour: "nav-translate" }],
  },
  {
    label: "Review",
    items: [
      { to: "/quiz", label: "Flashcards", icon: Zap, tour: "nav-quiz" },
      { to: "/vocab", label: "Vocabulary", icon: BookOpen, tour: "nav-vocab" },
    ],
  },
  {
    label: "Reference",
    items: [{ to: "/languages", label: "Languages", icon: Languages, tour: "nav-languages" }],
  },
];

const Navbar = ({ onOpenSettings, onSignOut, lessonsOpen, onToggleLessons }: NavbarProps) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.to.includes("#")) return false;
    return location.pathname === item.to;
  };

  const closeMenu = () => setMenuOpen(false);

  const wordmark = (
    <Link to="/dashboard" className="block shrink-0">
      <span className="block font-display text-[25px] font-extrabold leading-none tracking-[-0.045em] text-foreground">
        LingoVault
      </span>
      <span className="mono-label mt-1.5 block text-muted-foreground">Study carrel</span>
    </Link>
  );

  const navLink = (item: NavItem, onNavigate?: () => void) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <Link
        key={`${item.to}-${item.label}`}
        to={item.to}
        onClick={onNavigate}
        data-tour={item.tour}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors ${
          active
            ? "bg-primary font-semibold text-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        {item.label}
      </Link>
    );
  };

  const groupsMarkup = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-5" aria-label="Primary">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mono-label mb-1.5 px-2.5 text-muted-foreground">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => navLink(item, onNavigate))}
            {group.label === "Reference" ? (
              <button
                type="button"
                onClick={() => {
                  onNavigate?.();
                  onToggleLessons();
                }}
                aria-pressed={lessonsOpen}
                data-tour="nav-lessons"
                className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
                  lessonsOpen
                    ? "bg-sidebar-accent font-semibold text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                Lessons
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </nav>
  );

  const footer = (onNavigate?: () => void) => (
    <div className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onOpenSettings();
        }}
        className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <Settings2 className="h-4 w-4" strokeWidth={1.6} />
        Settings
      </button>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onSignOut();
        }}
        className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.6} />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <Link to="/dashboard" className="font-display text-xl font-extrabold tracking-[-0.04em]">
          LingoVault
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-foreground"
            aria-label="Open settings"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-foreground"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 md:flex">
        <div className="px-2.5">{wordmark}</div>
        <div className="mt-7 flex-1 overflow-y-auto">
          {groupsMarkup()}
        </div>
        {footer()}
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[286px] bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border px-5 py-5 text-left">
            <SheetTitle className="font-display text-lg tracking-[-0.03em]">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-73px)] flex-col overflow-y-auto px-3 py-5">
            {groupsMarkup(closeMenu)}
            {footer(closeMenu)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default memo(Navbar);
