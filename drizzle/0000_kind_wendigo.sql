CREATE TABLE "domain_vertices" (
	"idx" integer PRIMARY KEY NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
