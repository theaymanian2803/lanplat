import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { languagesDb, vocabularyDb } from "@/integrations/turso/db";
import { getLangBadgeClasses, getLangDotClass } from "@/lib/langColors";
import { openDictionary } from "@/lib/dictionary";
import { computeSrs, type SrsGrade } from "@/lib/srs";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, Download, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

const masteryColors: Record<number, string> = {
  0: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  1: "bg-red-500/15 text-red-300 border-red-500/30",
  2: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  3: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  4: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  5: "bg-teal-500/15 text-teal-300 border-teal-500/30",
};

const VocabBank = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [lang, setLang] = useState<string>("Danish");

  const { translating, markUserEdit, error } = useAutoTranslate(word, lang, translation, setTranslation);

  const { data: vocab = [], isLoading } = useQuery({
    queryKey: ["vocabulary", langFilter],
    queryFn: () => vocabularyDb.list(langFilter === "all" ? undefined : langFilter),
  });

  const { data: languages = [] } = useQuery({
    queryKey: ["languages"],
    queryFn: languagesDb.list,
  });

  const searchLower = search.toLowerCase();
  const filtered = useMemo(
    () =>
      vocab.filter(
        (v) =>
          v.word.toLowerCase().includes(searchLower) ||
          v.translation.toLowerCase().includes(searchLower) ||
          v.language.toLowerCase().includes(searchLower)
      ),
    [vocab, searchLower]
  );

  const addWord = useMutation({
    mutationFn: async () => {
      await vocabularyDb.insert({
        language: lang, word, translation, context_note: contextNote || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
      setDialogOpen(false);
      setWord(""); setTranslation(""); setContextNote("");
      toast.success("Word added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteWord = useMutation({
    mutationFn: async (id: string) => {
      await vocabularyDb.remove(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const gradeWord = useMutation({
    mutationFn: async ({ id, level, grade }: { id: string; level: number; grade: SrsGrade }) => {
      const result = computeSrs(level, grade);
      await vocabularyDb.updateSrs(id, result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const exportCsv = () => {
    const header = "Word,Translation,Context Note,Language\n";
    const rows = filtered.map((v) =>
      [v.word, v.translation, v.context_note || "", v.language]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lingovault-vocab-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Vocab Bank</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} className="gap-2 text-sm font-medium" disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4" />
              Add Word
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search words…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={langFilter} onValueChange={setLangFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No vocabulary words found.</p>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Word</TableHead>
                  <TableHead className="font-mono text-xs">Translation</TableHead>
                  <TableHead className="font-mono text-xs">Language</TableHead>
                  <TableHead className="font-mono text-xs">Mastery</TableHead>
                  <TableHead className="font-mono text-xs">Review</TableHead>
                  <TableHead className="font-mono text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.word}</TableCell>
                    <TableCell>{v.translation}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(v.language)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(v.language)}`} />
                        {v.language}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-mono ${masteryColors[v.mastery_level] || masteryColors[5]}`}>
                        Lv {v.mastery_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(["fail", "hard", "good", "easy"] as SrsGrade[]).map((g) => (
                          <Button
                            key={g}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] font-mono capitalize"
                            onClick={() => gradeWord.mutate({ id: v.id, level: v.mastery_level, grade: g })}
                            disabled={gradeWord.isPending}
                          >
                            {g}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Look up in dictionary"
                          onClick={() => openDictionary(v.word, v.language)}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteWord.mutate(v.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Word Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vocabulary Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Word</Label>
              <Input placeholder="e.g. hund" value={word} onChange={(e) => setWord(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Translation</Label>
              <div className="relative">
                <Input placeholder="e.g. dog" value={translation} onChange={(e) => { markUserEdit(); setTranslation(e.target.value); }} className="pr-8" />
                {translating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {error && !translating && (
                <p className="text-xs text-destructive mt-1">{error} - type the translation manually.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={lang} onValueChange={(v) => setLang(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context Note (optional)</Label>
              <Input placeholder="Where you encountered this word" value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addWord.mutate()} disabled={!word || !translation || addWord.isPending} className="text-sm font-semibold">
              {addWord.isPending ? "Saving…" : "Add Word"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VocabBank;
