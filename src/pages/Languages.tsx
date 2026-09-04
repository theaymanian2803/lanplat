import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { languagesDb } from "@/integrations/turso/db";
import { getLangBadgeClasses, getLangDotClass } from "@/lib/langColors";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Languages as LanguagesIcon } from "lucide-react";
import { toast } from "sonner";

const Languages = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [editLang, setEditLang] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: languages = [], isLoading } = useQuery({
    queryKey: ["languages"],
    queryFn: languagesDb.list,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["languages"] });
    queryClient.invalidateQueries({ queryKey: ["videos"] });
    queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
    queryClient.invalidateQueries({ queryKey: ["lessons"] });
  };

  const addLanguage = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      if (languages.some((l) => l.toLowerCase() === trimmed.toLowerCase()))
        throw new Error("That language already exists");
      await languagesDb.add(trimmed);
    },
    onSuccess: () => {
      invalidateAll();
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
      invalidateAll();
      toast.success("Language removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const renameLanguage = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      await languagesDb.rename(oldName, newName);
    },
    onSuccess: () => {
      invalidateAll();
      setEditLang(null);
      setEditName("");
      toast.success("Language renamed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Languages</h1>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Add Language
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/80 font-mono">
          Languages added here are available when adding new media.
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
                <Badge variant="outline" className={`text-[11px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(lang)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(lang)}`} />
                  {lang}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                    title="Rename language"
                    onClick={() => {
                      setEditLang(lang)
                      setEditName(lang)
                    }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    onClick={() => deleteLanguage.mutate(lang)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Language</DialogTitle>
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
              className="text-sm font-semibold">
              {addLanguage.isPending ? "Saving…" : "Add Language"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLang !== null} onOpenChange={(o) => !o && setEditLang(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New name</Label>
            <Input
              placeholder="e.g. Swedish"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editLang && editName.trim()) {
                  renameLanguage.mutate({ oldName: editLang, newName: editName })
                }
              }}
              autoFocus
            />
            {editLang && (
              <p className="text-xs text-muted-foreground/70">
                Renaming &quot;{editLang}&quot; also updates all videos, words, and lessons
                tagged with it.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditLang(null)}
              className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={() => editLang && renameLanguage.mutate({ oldName: editLang, newName: editName })}
              disabled={!editName.trim() || renameLanguage.isPending}
              className="text-sm font-semibold">
              {renameLanguage.isPending ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Languages;
