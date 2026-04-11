
ALTER TABLE public.vocabulary
ADD COLUMN mastery_level integer NOT NULL DEFAULT 0,
ADD COLUMN next_review_date timestamp with time zone NOT NULL DEFAULT now();
