import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { openDictionary } from "@/lib/dictionary";
import { computeSrs, type SrsGrade } from "@/lib/srs";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, Download, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Language = Database["public"]["Enums"]["app_language"];
const LANGUAGES: Language[] = ["Danish", "Japanese", "Spanish"];

const langColors: Record<Language, string> = {
  Danish: "bg-red-500/20 text-red-400 border-red-500/30",
  Japanese: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Spanish: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const masteryColors: Record<number, string> = {
  0: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  1: "bg-red-500/20 text-red-400 border-red-500/30",
  2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  3: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  4: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  5: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const VocabBank = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [lang, setLang] = useState<Language>("Danish");

  const { data: vocab = [], isLoading } = useQuery({
    queryKey: ["vocabulary", langFilter],
    queryFn: async () => {
      let q = supabase.from("vocabulary").select("*").order("created_at", { ascending: false });
      if (langFilter !== "all") q = q.eq("language", langFilter as Language);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = vocab.filter(
    (v) =>
      v.word.toLowerCase().includes(search.toLowerCase()) ||
      v.translation.toLowerCase().includes(search.toLowerCase())
  );

  const addWord = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vocabulary").insert({
        user_id: user!.id, language: lang, word, translation, context_note: contextNote || null,
      });
      if (error) throw error;
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
      const { error } = await supabase.from("vocabulary").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const gradeWord = useMutation({
    mutationFn: async ({ id, level, grade }: { id: string; level: number; grade: SrsGrade }) => {
      const result = computeSrs(level, grade);
      const { error } = await supabase.from("vocabulary").update(result).eq("id", id);
      if (error) throw error;
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
            <Button variant="outline" onClick={exportCsv} className="gap-2 font-mono text-xs" disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 font-mono text-xs">
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
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
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
                      <Badge variant="outline" className={`text-[10px] font-mono ${langColors[v.language]}`}>
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
            <DialogTitle className="font-mono">Add Vocabulary Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Word</Label>
              <Input placeholder="e.g. hund" value={word} onChange={(e) => setWord(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Translation</Label>
              <Input placeholder="e.g. dog" value={translation} onChange={(e) => setTranslation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context Note (optional)</Label>
              <Input placeholder="Where you encountered this word" value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addWord.mutate()} disabled={!word || !translation || addWord.isPending} className="font-mono text-xs">
              {addWord.isPending ? "Saving…" : "Add Word"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VocabBank;
