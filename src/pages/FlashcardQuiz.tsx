import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vocabularyDb } from "@/integrations/turso/db";
import { getLangBadgeClasses, getLangDotClass } from "@/lib/langColors";
import { computeSrs, type SrsGrade } from "@/lib/srs";
import { openDictionary } from "@/lib/dictionary";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, RotateCcw, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const gradeConfig: { grade: SrsGrade; label: string; color: string; key: string }[] = [
  { grade: "fail", label: "Fail", color: "bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/30", key: "1" },
  { grade: "hard", label: "Hard", color: "bg-orange-500/15 text-orange-300 border-orange-500/40 hover:bg-orange-500/30", key: "2" },
  { grade: "good", label: "Good", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30", key: "3" },
  { grade: "easy", label: "Easy", color: "bg-teal-500/15 text-teal-300 border-teal-500/40 hover:bg-teal-500/30", key: "4" },
];

const FlashcardQuiz = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);

  const { data: dueWords = [], isLoading } = useQuery({
    queryKey: ["vocabulary-due"],
    queryFn: () => vocabularyDb.listDue(new Date().toISOString()),
  });

  const gradeWord = useMutation({
    mutationFn: async ({ id, level, grade }: { id: string; level: number; grade: SrsGrade }) => {
      const result = computeSrs(level, grade);
      await vocabularyDb.updateSrs(id, result);
    },
    onSuccess: () => {
      setRevealed(false);
      setCompleted((c) => c + 1);
      if (currentIndex < dueWords.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        queryClient.invalidateQueries({ queryKey: ["vocabulary-due"] });
        queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleGrade = useCallback(
    (grade: SrsGrade) => {
      const card = dueWords[currentIndex];
      if (!card) return;
      gradeWord.mutate({ id: card.id, level: card.mastery_level, grade });
    },
    [dueWords, currentIndex, gradeWord]
  );

  // Keyboard shortcuts: 1-4 for grading, Space to reveal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const idx = ["1", "2", "3", "4"].indexOf(e.key);
        if (idx !== -1) {
          e.preventDefault();
          handleGrade(gradeConfig[idx].grade);
        }
      }
    },
    [revealed, handleGrade]
  );

  const card = dueWords[currentIndex];
  const allDone = !isLoading && (dueWords.length === 0 || currentIndex >= dueWords.length);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Flashcard Quiz</h1>
          <div className="flex items-center gap-3">
            {dueWords.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {Math.min(currentIndex + 1, dueWords.length)} / {dueWords.length}
              </span>
            )}
            <Badge variant="outline" className="font-mono text-xs">
              {completed} reviewed
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm animate-pulse">Loading due words…</p>
        ) : allDone ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <h2 className="text-xl font-bold">All caught up!</h2>
              <p className="text-muted-foreground text-sm text-center max-w-sm">
                {completed > 0
                  ? `You reviewed ${completed} word${completed !== 1 ? "s" : ""} this session.`
                  : "No vocabulary words are due for review right now."}
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="text-sm font-medium gap-2" onClick={() => navigate("/vocab")}>
                  <BookOpen className="h-3.5 w-3.5" />
                  Vocab Bank
                </Button>
                {completed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm font-medium gap-2"
                    onClick={() => {
                      setCurrentIndex(0);
                      setCompleted(0);
                      queryClient.invalidateQueries({ queryKey: ["vocabulary-due"] });
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : card ? (
          <div className="space-y-4">
            {/* Flashcard */}
            <Card className="border-border/50 min-h-[280px] flex flex-col">
              <CardContent className="flex-1 flex flex-col items-center justify-center py-12 gap-6">
                <Badge variant="outline" className={`text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(card.language)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(card.language)}`} />
                  {card.language}
                </Badge>
                <p className="text-3xl font-bold tracking-tight text-center">{card.word}</p>

                {revealed ? (
                  <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <p className="text-xl text-primary">{card.translation}</p>
                    {card.context_note && (
                      <p className="text-xs text-muted-foreground italic">"{card.context_note}"</p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm font-medium gap-2"
                    onClick={() => setRevealed(true)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Reveal Answer (Space)
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Grade buttons */}
            {revealed && (
              <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {gradeConfig.map((g) => (
                  <Button
                    key={g.grade}
                    variant="outline"
                    className={`h-12 font-mono text-sm flex flex-col gap-0.5 ${g.color}`}
                    onClick={() => handleGrade(g.grade)}
                    disabled={gradeWord.isPending}
                  >
                    <span>{g.label}</span>
                    <span className="text-[10px] opacity-60">[{g.key}]</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Dictionary link */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5 font-mono"
                onClick={() => openDictionary(card.word, card.language)}
              >
                <BookOpen className="h-3 w-3" />
                Look up in dictionary
              </Button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground font-mono">
              Space to reveal · 1-4 to grade
            </p>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default FlashcardQuiz;
