import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { BookOpen, Loader2, Search, X } from 'lucide-react'

import BookReaderDialog from '@/components/books/BookReaderDialog'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BOOK_LANGUAGES,
  displayAuthorName,
  fetchAllBooks,
  fetchBookPage,
  getCoverUrl,
  searchBooks,
  type Book,
} from '@/lib/bookCatalog'

const BookCard = ({ book, onRead }: { book: Book; onRead: (book: Book) => void }) => {
  const cover = getCoverUrl(book)

  return (
    <button
      type="button"
      onClick={() => onRead(book)}
      aria-label={`Read ${book.title}`}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border/50 bg-card text-left text-card-foreground shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <span className="relative block aspect-[3/4] bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/40" />
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2">
        <span className="line-clamp-2 block font-medium text-[11px] leading-tight">
          {book.title}
        </span>
        <span className="line-clamp-1 block text-[9px] leading-tight text-muted-foreground">
          {book.authors.length > 0
            ? book.authors.map((a) => displayAuthorName(a.name)).join(', ')
            : 'Unknown author'}
        </span>
      </span>
    </button>
  )
}

const BookGrid = ({ books, onRead }: { books: Book[]; onRead: (book: Book) => void }) => (
  <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
    {books.map((book) => (
      <BookCard key={book.id} book={book} onRead={onRead} />
    ))}
  </div>
)

const ShelfSkeleton = () => (
  <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="overflow-hidden rounded-lg border border-border/50 bg-card">
        <div className="aspect-[3/4] animate-pulse bg-muted" />
        <div className="space-y-1.5 p-2">
          <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-2 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    ))}
  </div>
)

const Books = () => {
  const [languageName, setLanguageName] = useState(BOOK_LANGUAGES[0].name)
  const [readerBook, setReaderBook] = useState<Book | null>(null)
  const [query, setQuery] = useState('')

  const language = BOOK_LANGUAGES.find((item) => item.name === languageName) ?? BOOK_LANGUAGES[0]
  const trimmedQuery = query.trim()
  const searching = trimmedQuery.length > 0

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['books', language.code],
    queryFn: ({ pageParam }) => fetchBookPage(language.code, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
  })

  const {
    data: shelf = [],
    isLoading: shelfLoading,
    isFetching: shelfFetching,
    isSuccess: shelfSuccess,
    isPaused: shelfPaused,
    isLoadingError: shelfLoadError,
    isRefetchError: shelfRefetchError,
    refetch: refetchShelf,
  } = useQuery({
    queryKey: ['books', language.code, 'all'],
    queryFn: () => fetchAllBooks(language.code),
    enabled: searching,
    staleTime: 5 * 60 * 1000,
  })

  const books = data?.pages.flatMap((page) => page.books) ?? []
  const results = searching ? searchBooks(shelf, trimmedQuery) : books

  // A search is only "finished" when the shelf query succeeded. While it is loading,
  // paused offline, or failed without data, the count line must not claim zero matches.
  const searchPending =
    searching && !shelfSuccess && !shelfLoadError && (shelfLoading || shelfPaused || shelfFetching)
  const searchCount = searchPending
    ? 'Searching the shelf…'
    : shelfLoadError
      ? 'Could not search the shelf.'
      : `${results.length} ${results.length === 1 ? 'match' : 'matches'} for “${trimmedQuery}”`

  const errorMessage =
    error instanceof Error ? error.message : 'Could not load books right now.'

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em]">Books</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Public-domain literature from Project Gutenberg. Select a phrase while you read and
              it lands in the vault with the book's language.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search books"
                placeholder="Search title or author…"
                className="h-10 pl-9 pr-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setQuery('')}>
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <span className="mono-label text-muted-foreground">Shelf</span>
            <Select value={languageName} onValueChange={setLanguageName}>
              <SelectTrigger aria-label="Book language" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOK_LANGUAGES.map((item) => (
                  <SelectItem key={item.code} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="mono-label mt-4 text-muted-foreground" aria-live="polite">
          {searching ? searchCount : `${books.length} loaded · five at a time`}
        </p>

        {searching ? (
          searchPending ? (
            <ShelfSkeleton />
          ) : shelfLoadError ? (
            <Card className="mt-8 p-6 text-center">
              <p className="text-sm text-destructive" role="alert">
                Could not search the shelf.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchShelf()}>
                Retry
              </Button>
            </Card>
          ) : results.length === 0 ? (
            <Card className="mt-8 p-6 text-center">
              <p className="text-sm text-muted-foreground">No books match “{trimmedQuery}”.</p>
            </Card>
          ) : (
            <>
              {shelfRefetchError ? (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground" role="alert">
                    Could not refresh the shelf.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetchShelf()}>
                    Retry
                  </Button>
                </div>
              ) : null}
              <BookGrid books={results} onRead={setReaderBook} />
            </>
          )
        ) : isLoading ? (
          <ShelfSkeleton />
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
              No {language.name} books found.
            </p>
          </Card>
        ) : (
          <>
            <BookGrid books={books} onRead={setReaderBook} />
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
        <BookReaderDialog
          book={readerBook}
          language={language.name}
          onClose={() => setReaderBook(null)}
        />
      ) : null}
    </Layout>
  )
}

export default Books
