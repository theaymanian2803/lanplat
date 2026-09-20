import { Link, useLocation } from "react-router-dom";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookOpen, GraduationCap, Home, Languages, LogOut, Menu, Settings2, Zap } from "lucide-react";

interface NavbarProps {
  onOpenSettings: () => void;
  onSignOut: () => void;
  lessonsOpen: boolean;
  onToggleLessons: () => void;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, tour: "nav-dashboard" },
  { to: "/vocab", label: "Vocab Bank", icon: BookOpen, tour: "nav-vocab" },
  { to: "/quiz", label: "Quiz", icon: Zap, tour: "nav-quiz" },
  { to: "/languages", label: "Languages", icon: Languages, tour: "nav-languages" },
];

const Navbar = ({ onOpenSettings, onSignOut, lessonsOpen, onToggleLessons }: NavbarProps) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="font-display text-xl font-semibold tracking-tight text-primary shrink-0">
              LingoVault
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon, tour }) => (
                <Link key={to} to={to}>
                  <Button
                    variant={isActive(to) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2 text-sm font-medium"
                    data-tour={tour}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                </Link>
              ))}
              <Button
                variant={lessonsOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={onToggleLessons}
                className="gap-2 text-sm font-medium"
                aria-pressed={lessonsOpen}
                data-tour="nav-lessons"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Lessons
              </Button>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="gap-2 text-sm font-medium text-muted-foreground hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-foreground"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right">
          <SheetHeader className="text-left border-b border-border/40 pb-4 mb-2">
            <SheetTitle className="font-display text-lg">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon, tour }) => (
              <Link key={to} to={to} onClick={closeMenu}>
                <Button
                  variant={isActive(to) ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 h-11 px-3 text-sm font-medium ${isActive(to) ? "" : "text-muted-foreground"}`}
                  data-tour={tour}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
            <Button
              variant={lessonsOpen ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 h-11 px-3 text-sm font-medium text-muted-foreground"
              aria-pressed={lessonsOpen}
              data-tour="nav-lessons"
              onClick={() => {
                closeMenu()
                onToggleLessons()
              }}
            >
              <GraduationCap className="h-4 w-4" />
              Lessons
            </Button>
          </div>
          <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-border/40">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 px-3 text-sm font-medium text-muted-foreground hover:text-destructive"
              title="Sign out"
              onClick={() => {
                closeMenu()
                onSignOut()
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 px-3 text-sm font-medium text-muted-foreground"
              onClick={() => {
                closeMenu()
                onOpenSettings()
              }}
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
};

export default memo(Navbar);