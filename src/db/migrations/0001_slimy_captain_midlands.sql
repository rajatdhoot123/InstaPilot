CREATE TABLE "instagram_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_user_id" uuid,
	"instagram_user_id" varchar(255) NOT NULL,
	"long_lived_access_token" varchar(512) NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_connections_instagram_user_id_unique" UNIQUE("instagram_user_id")
);
