import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { languagesDb, vocabularyDb } from "@/integrations/turso/db";
import { getLangBadgeClasses, getLangDotClass } from "@/lib/langColors";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Search, Download, Pencil, Loader2, FileText, StickyNote, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import type { VocabWord } from "@/integrations/turso/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const masteryColors: Record<number, string> = {
  0: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  1: "bg-red-500/15 text-red-300 border-red-500/30",
  2: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  3: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  4: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  5: "bg-teal-500/15 text-teal-300 border-teal-500/30",
};

const PAGE_SIZE = 12;

const VocabBank = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextDialog, setContextDialog] = useState<VocabWord | null>(null);
  const [editDialog, setEditDialog] = useState<VocabWord | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editContextNote, setEditContextNote] = useState("");
  const [editLang, setEditLang] = useState<string>("Danish");
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [lang, setLang] = useState<string>("Danish");
  const wordInputRef = useRef<HTMLTextAreaElement>(null);

  const clearForm = () => {
    setWord(""); setTranslation(""); setContextNote("");
    wordInputRef.current?.focus();
  };

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleLangFilter = (value: string) => {
    setLangFilter(value);
    setPage(1);
  };

  const goToPage = (target: number) => {
    setPage(Math.min(Math.max(1, target), totalPages));
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "ellipsis") {
        pages.push("ellipsis");
      }
    }
    return pages;
  }, [totalPages, safePage]);

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

  const openEdit = (v: VocabWord) => {
    setEditWord(v.word);
    setEditTranslation(v.translation);
    setEditContextNote(v.context_note ?? "");
    setEditLang(v.language);
    setEditDialog(v);
  };

  const updateWord = useMutation({
    mutationFn: async () => {
      if (!editDialog) return;
      await vocabularyDb.update(editDialog.id, {
        language: editLang,
        word: editWord,
        translation: editTranslation,
        context_note: editContextNote || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
      setEditDialog(null);
      toast.success("Word updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const gradeWord = useMutation({
    mutationFn: async ({ id, level, grade }: { id: string; level: number; grade: SrsGrade }) => {
      const result = computeSrs(level, grade);
      await vocabularyDb.updateSrs(id, result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const exportCsv = () => {
    const header = "Word,Translation,Context Note,Language,Mastery\n";
    const rows = filtered
      .map((v) =>
        [v.word, v.translation, v.context_note || "", v.language, String(v.mastery_level)]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lingovault-vocab-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("CSV exported");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("LingoVault — Vocabulary", 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Exported ${new Date().toLocaleDateString()} · ${filtered.length} words`, 40, 56);
    autoTable(doc, {
      startY: 70,
      head: [["Word", "Translation", "Context Note", "Language", "Mastery"]],
      body: filtered.map((v) => [
        v.word,
        v.translation,
        v.context_note || "",
        v.language,
        `Lv ${v.mastery_level}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [139, 92, 246] },
    });
    doc.save(`lingovault-vocab-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Vocab Bank</h1>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm font-medium" disabled={filtered.length === 0}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCsv} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <Input placeholder="Search words…" className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          <Select value={langFilter} onValueChange={handleLangFilter}>
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
                {paginated.map((v) => (
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
                          title="Edit word"
                          onClick={() => openEdit(v)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="View context note"
                          onClick={() => setContextDialog(v)}
                        >
                          <StickyNote className="h-3.5 w-3.5" />
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

        {/* Pagination */}
        {!isLoading && filtered.length > PAGE_SIZE && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground font-mono">
              {filtered.length} word{filtered.length !== 1 ? "s" : ""} · page {safePage} of {totalPages}
            </p>
            <nav role="navigation" aria-label="pagination" className="flex w-full justify-center">
              <ul className="flex flex-row items-center gap-1">
                <li>
                  <button
                    type="button"
                    aria-label="Go to previous page"
                    disabled={safePage === 1}
                    onClick={() => goToPage(safePage - 1)}
                    className="inline-flex items-center gap-1 pl-2.5 h-9 rounded-md px-3 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                </li>
                {pageNumbers.map((p, i) =>
                  p === "ellipsis" ? (
                    <li key={`e-${i}`}>
                      <span aria-hidden className="flex h-9 w-9 items-center justify-center">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More pages</span>
                      </span>
                    </li>
                  ) : (
                    <li key={p}>
                      <button
                        type="button"
                        aria-current={p === safePage ? "page" : undefined}
                        onClick={() => goToPage(p)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium ${
                          p === safePage
                            ? "border bg-background shadow-sm"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    </li>
                  )
                )}
                <li>
                  <button
                    type="button"
                    aria-label="Go to next page"
                    disabled={safePage === totalPages}
                    onClick={() => goToPage(safePage + 1)}
                    className="inline-flex items-center gap-1 pr-2.5 h-9 rounded-md px-3 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </li>
              </ul>
            </nav>
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
              <AutoGrowTextarea ref={wordInputRef} placeholder="e.g. hund" value={word} onChange={(e) => setWord(e.target.value.toLowerCase())} />
            </div>
            <div className="space-y-2">
              <Label>Translation</Label>
              <div className="relative">
                <AutoGrowTextarea placeholder="e.g. dog" value={translation} onChange={(e) => { markUserEdit(); setTranslation(e.target.value.toLowerCase()); }} className="pr-8" />
                {translating && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
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
              <AutoGrowTextarea placeholder="Where you encountered this word" value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={clearForm} disabled={!word.trim() && !translation.trim() && !contextNote.trim()} className="text-muted-foreground hover:text-foreground">
              Clear
            </Button>
            <Button onClick={() => addWord.mutate()} disabled={!word || !translation || addWord.isPending} className="text-sm font-semibold">
              {addWord.isPending ? "Saving…" : "Add Word"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Note Dialog */}
      <Dialog open={!!contextDialog} onOpenChange={(o) => !o && setContextDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Context Note</DialogTitle>
          </DialogHeader>
          {contextDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{contextDialog.word}</span>
                <Badge variant="outline" className={`text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(contextDialog.language)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(contextDialog.language)}`} />
                  {contextDialog.language}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{contextDialog.translation}</p>
              <div className="rounded-md bg-muted/50 border border-border/50 p-3 text-sm whitespace-pre-wrap">
                {contextDialog.context_note || <span className="italic text-muted-foreground">No context note for this word.</span>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setContextDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Word Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vocabulary Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Word</Label>
              <AutoGrowTextarea placeholder="e.g. hund" value={editWord} onChange={(e) => setEditWord(e.target.value.toLowerCase())} />
            </div>
            <div className="space-y-2">
              <Label>Translation</Label>
              <AutoGrowTextarea placeholder="e.g. dog" value={editTranslation} onChange={(e) => setEditTranslation(e.target.value.toLowerCase())} />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={editLang} onValueChange={(v) => setEditLang(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context Note (optional)</Label>
              <AutoGrowTextarea placeholder="Where you encountered this word" value={editContextNote} onChange={(e) => setEditContextNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => setEditDialog(null)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <Button onClick={() => updateWord.mutate()} disabled={!editWord.trim() || !editTranslation.trim() || updateWord.isPending} className="text-sm font-semibold">
              {updateWord.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VocabBank;
