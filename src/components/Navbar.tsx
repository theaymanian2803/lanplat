import { Link, useLocation } from "react-router-dom";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, Home, Languages, LogOut, Settings2, Zap } from "lucide-react";

interface NavbarProps {
  onOpenSettings: () => void;
  onSignOut: () => void;
  lessonsOpen: boolean;
  onToggleLessons: () => void;
}

const Navbar = ({ onOpenSettings, onSignOut, lessonsOpen, onToggleLessons }: NavbarProps) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
<Link to="/" className="font-display text-xl font-semibold tracking-tight text-primary">
              LingoVault
            </Link>
            <div className="flex items-center gap-1">
              <Link to="/">
                <Button
                  variant={isActive("/") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 text-sm font-medium"
                  data-tour="nav-dashboard"
                >
                  <Home className="h-3.5 w-3.5" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/vocab">
                <Button
                  variant={isActive("/vocab") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 text-sm font-medium"
                  data-tour="nav-vocab"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Vocab Bank
                </Button>
              </Link>
              <Link to="/quiz">
                <Button
                  variant={isActive("/quiz") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 text-sm font-medium"
                  data-tour="nav-quiz"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Quiz
                </Button>
              </Link>
              <Link to="/languages">
                <Button
                  variant={isActive("/languages") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 text-sm font-medium"
                  data-tour="nav-languages"
                >
                  <Languages className="h-3.5 w-3.5" />
                  Languages
                </Button>
              </Link>
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
          <div className="flex items-center gap-1">
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
        </div>
      </div>
    </nav>
  );
};

export default memo(Navbar);
