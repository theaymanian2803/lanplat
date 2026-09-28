import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BookOpen, ExternalLink, Library, Loader2, Search, X } from 'lucide-react'

import BookReaderDialog from '@/components/books/BookReaderDialog'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  displayAuthorName,
  fetchFrenchBooks,
  getCoverUrl,
  getDownloadLinks,
  type GutendexBook,
} from '@/lib/gutendex'

const BookCard = ({ book, onRead }: { book: GutendexBook; onRead: (book: GutendexBook) => void }) => {
  const cover = getCoverUrl(book)
  const links = getDownloadLinks(book)

  return (
    <Card className="group flex flex-col overflow-hidden border-border/50 transition-colors hover:border-primary/30">
      <div className="relative aspect-[3/4] bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 font-medium text-sm leading-snug">{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.authors.length > 0
            ? book.authors.map((a) => displayAuthorName(a.name)).join(', ')
            : 'Unknown author'}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {links.html || links.text ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] font-mono"
              onClick={() => onRead(book)}>
              <BookOpen className="h-3 w-3" />
              Read
            </Button>
          ) : null}
          {links.epub ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] font-mono"
              asChild>
              <a href={links.epub} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                EPUB
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

const Books = () => {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [readerBook, setReaderBook] = useState<GutendexBook | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 600)
    return () => clearTimeout(handle)
  }, [search])

  const { data, isLoading, isError, error, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['gutendex', 'fr', debounced],
      queryFn: ({ pageParam }) => fetchFrenchBooks(pageParam, debounced),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.next ? allPages.length + 1 : undefined,
    })

  const books = data?.pages.flatMap((page) => page.results) ?? []
  const total = data?.pages[0]?.count

  const errorMessage =
    error instanceof Error ? error.message : 'Could not load books right now.'

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center gap-3">
          <Library className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">Books</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          French literature from Project Gutenberg — free, public-domain books you can read
          in the language you are learning.
        </p>

        <div className="relative mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search French books…"
            aria-label="Search books"
            className="pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {total !== undefined && books.length > 0 ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {total.toLocaleString()} book{total === 1 ? '' : 's'}
            {debounced ? ` matching “${debounced}”` : ' in French'}
          </p>
        ) : null}

        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                <div className="aspect-[3/4] animate-pulse bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <Card className="mt-8 p-6 text-center">
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        ) : books.length === 0 ? (
          <Card className="mt-8 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {debounced ? `No books match “${debounced}”.` : 'No French books found.'}
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onRead={setReaderBook} />
              ))}
            </div>
            {hasNextPage ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more…
                    </>
                  ) : (
                    'Load more books'
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {readerBook ? (
        <BookReaderDialog book={readerBook} onClose={() => setReaderBook(null)} />
      ) : null}
    </Layout>
  )
}

export default Books