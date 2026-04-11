import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, BookOpen, Home, Zap } from "lucide-react";

const Navbar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-mono text-lg font-bold tracking-tight text-primary">
              LingoVault
            </Link>
            <div className="flex items-center gap-1">
              <Link to="/">
                <Button
                  variant={isActive("/") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 font-mono text-xs"
                >
                  <Home className="h-3.5 w-3.5" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/vocab">
                <Button
                  variant={isActive("/vocab") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 font-mono text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Vocab Bank
               </Button>
              </Link>
              <Link to="/quiz">
                <Button
                  variant={isActive("/quiz") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2 font-mono text-xs"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Quiz
                </Button>
              </Link>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-xs text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
