import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { languagesDb } from "@/integrations/turso/db";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Languages as LanguagesIcon } from "lucide-react";
import { toast } from "sonner";

const langColors: Record<string, string> = {
  Danish: "bg-red-500/20 text-red-400 border-red-500/30",
  Japanese: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Spanish: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const getLangColor = (lang: string) =>
  langColors[lang] || "bg-slate-500/20 text-slate-400 border-slate-500/30";

const Languages = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: languages = [], isLoading } = useQuery({
    queryKey: ["languages"],
    queryFn: languagesDb.list,
  });

  const addLanguage = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      if (languages.some((l) => l.toLowerCase() === trimmed.toLowerCase()))
        throw new Error("That language already exists");
      await languagesDb.add(trimmed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["languages"] });
      setDialogOpen(false);
      setName("");
      toast.success("Language added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLanguage = useMutation({
    mutationFn: async (lang: string) => {
      await languagesDb.remove(lang);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["languages"] });
      toast.success("Language removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Languages</h1>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 font-mono text-xs">
            <Plus className="h-4 w-4" />
            Add Language
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/80 font-mono">
          Languages added here are available when adding new videos.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : languages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/50 rounded-xl bg-card/30">
            <LanguagesIcon className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No languages yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {languages.map((lang) => (
              <div
                key={lang}
                className="group rounded-xl border border-border/40 bg-card p-4 flex items-center justify-between gap-2 hover:border-primary/30 hover:shadow-md transition-all">
                <Badge variant="outline" className={`text-[11px] font-mono ${getLangColor(lang)}`}>
                  {lang}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                  onClick={() => deleteLanguage.mutate(lang)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Add Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g. French"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) addLanguage.mutate();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => addLanguage.mutate()}
              disabled={!name.trim() || addLanguage.isPending}
              className="font-mono text-xs">
              {addLanguage.isPending ? "Saving…" : "Add Language"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Languages;
