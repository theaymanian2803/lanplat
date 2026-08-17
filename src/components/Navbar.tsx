import { Link, useLocation } from "react-router-dom";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Home, Languages, Settings2, Zap } from "lucide-react";

interface NavbarProps {
  onOpenSettings: () => void;
}

const Navbar = ({ onOpenSettings }: NavbarProps) => {
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
                >
                  <Languages className="h-3.5 w-3.5" />
                  Languages
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center">
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
